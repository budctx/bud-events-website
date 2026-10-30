import {findPromo,normalizePromo} from './whop-promos.ts';
// Live handlers require runtime routing, explicit controls and verified customer identity.
import { resolveSession } from './auth.ts';
import { enforceRateLimit } from './rate-limit.ts';
import { boundedProviderText, WhopError } from './whop.ts';
import type { CommerceEnv } from './whop.ts';
import { assertProductionCheckoutUrl, assertProductionPaymentIdentity, assertProductionPaymentMatches, createProductionCheckout, lookupProductionPayment,
  ProductionPlanMismatch, productionOrderMatches, verifyProductionWebhook, whopProductionConfig, whopProductionProcessingConfig } from './whop-production.ts';
import type { ProductionConfig, ProductionOrder } from './whop-production.ts';
import { liveHostAllowed } from './live-access.ts';

const PROJECT = 'https://cepmvqqrjcvhyzszqand.supabase.co';
export { backend as liveBackend, rpc as liveRpc, result as liveResponse };
type StoredOrder = ProductionOrder & { fulfilled: boolean };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function environment(): CommerceEnv { return (globalThis as unknown as { process?: { env?: CommerceEnv } }).process?.env ?? {}; }
function backend(env: CommerceEnv): string | null {
  return env.BUD_BACKEND_ENABLED === 'true' && env.SUPABASE_URL === PROJECT && env.SUPABASE_SERVICE_ROLE_KEY ? env.SUPABASE_SERVICE_ROLE_KEY : null;
}
function result(status: number, code: string, data?: unknown, sessionHeaders?: Headers) {
  const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  if (sessionHeaders) for (const cookie of sessionHeaders.getSetCookie()) headers.append('Set-Cookie', cookie);
  return Response.json({ code, ...(data === undefined ? {} : { data }) }, { status, headers });
}
async function rpc(name: string, params: object, secret: string, transport: typeof fetch): Promise<unknown> {
  let response: Response;
  try {
    response = await transport(PROJECT + '/rest/v1/rpc/' + name, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
      headers: { apikey: secret, Authorization: 'Bearer ' + secret, 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
  } catch { throw new WhopError('LIVE_BACKEND_UNAVAILABLE'); }
  let data: unknown;
  try { data = JSON.parse(await boundedProviderText(response.body)); } catch { throw new WhopError('LIVE_BACKEND_UNAVAILABLE'); }
  if (!response.ok) {
    const message = object(data) ? data.message : null;
    if (message === 'BUD_LIVE_COMMERCE_DISABLED') throw new WhopError('LIVE_COMMERCE_DISABLED');
    if (message === 'BUD_KEY_REUSED') throw new WhopError('IDEMPOTENCY_KEY_REUSED', 409);
    if (message === 'BUD_PAYMENT_REVIEW') throw new WhopError('PAYMENT_UNDER_REVIEW', 409);
    if (message === 'BUD_ORDER_NOT_FOUND') throw new WhopError('ORDER_NOT_FOUND', 404);
    // Never return SQL, provider bodies, service credentials or financial identifiers on errors.
    throw new WhopError('LIVE_BACKEND_UNAVAILABLE');
  }
  return data;
}
function order(value: unknown, config: ProductionConfig, historicalPayment = false): StoredOrder {
  if (!object(value) || !productionOrderMatches(value as StoredOrder, config, historicalPayment) || typeof value.fulfilled !== 'boolean'
    || !((value.checkoutId === null && value.checkoutUrl === null) || (typeof value.checkoutId === 'string' && typeof value.checkoutUrl === 'string')))
    throw new WhopError('LIVE_ORDER_MISMATCH', 409);
  const stored = value as StoredOrder;
  if (stored.checkoutId !== null) assertProductionCheckoutUrl(stored.checkoutId, stored.checkoutUrl!, config.plan);
  if (stored.fulfilled && stored.checkoutId === null) throw new WhopError('LIVE_ORDER_MISMATCH', 409);
  return stored;
}

/** Future pilot endpoint. Caller identity/price/environment never come from the submitted JSON. */
export async function handleProductionCheckout(request: Request, env: CommerceEnv = environment(), transport: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'POST') return result(405, 'METHOD_NOT_ALLOWED');
  const config = whopProductionConfig(env), secret = backend(env);
  if (!config || !secret || env.BUD_AUTH_ENABLED !== 'true') return result(503, 'LIVE_CHECKOUT_NOT_CONFIGURED');
  const url = new URL(request.url);
  if (url.origin !== config.origin || request.headers.get('origin') !== config.origin) return result(403, 'ORIGIN_DENIED');
  if (url.search) return result(400, 'INVALID_CHECKOUT_REQUEST');
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return result(415, 'JSON_REQUIRED');
  let sessionHeaders: Headers | undefined;
  try {
    const limited = await enforceRateLimit(request, env, transport, 'checkout'); if (limited) return limited;
    const session = await resolveSession(request, env, transport);
    if (!session) return result(401, 'DISCORD_AUTH_REQUIRED');
    sessionHeaders = session.headers;
    if (!liveHostAllowed(session.hostId, env)) return result(403, 'PILOT_HOST_REQUIRED', undefined, sessionHeaders);
    const hostLimited = await enforceRateLimit(request, env, transport, 'checkout', session.hostId);
    if (hostLimited) {
      for (const cookie of sessionHeaders.getSetCookie()) hostLimited.headers.append('Set-Cookie', cookie);
      return hostLimited;
    }
    let body: unknown;
    try { body = JSON.parse(await boundedProviderText(request.body, 2048)); }
    catch { throw new WhopError('INVALID_CHECKOUT_REQUEST', 400); }
    if (!object(body) || typeof body.idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(body.idempotencyKey)
      || typeof body.locale !== 'string' || !['ar', 'en'].includes(body.locale) || Object.keys(body).some(key => !['idempotencyKey', 'locale','promoCode'].includes(key)))
      throw new WhopError('INVALID_CHECKOUT_REQUEST', 400);
    const promotion=body.promoCode===undefined?undefined:env.BUD_PROMO_CODES_ENABLED==='true'
      ?await findPromo(normalizePromo(body.promoCode),config,transport):(()=>{throw new WhopError('PROMO_NOT_CONFIGURED');})();
    const stored = order(await rpc(promotion?'bud_live_create_promo_order':'bud_live_create_order', { p_host: session.hostId, p_key: body.idempotencyKey, p_company: config.company,
      p_product: config.product, p_plan: config.plan, p_currency: config.currency, p_amount: promotion?config.amount-promotion.discountMinor:config.amount, p_locale: body.locale,...(promotion?{p_promotion:promotion}:{}) }, secret, transport), config);
    if((stored.promotion?.id??null)!==(promotion?.id??null)|| (stored.promotion?.code??null)!==(promotion?.code??null)) throw new WhopError('LIVE_ORDER_MISMATCH',409);
    if (stored.locale !== body.locale) throw new WhopError('LIVE_ORDER_MISMATCH', 409);
    if (stored.fulfilled) throw new WhopError('ORDER_ALREADY_PAID', 409);
    let checkout = stored.checkoutId ? { checkoutId: stored.checkoutId, url: stored.checkoutUrl! } : null;
    if (!checkout) {
      checkout = await createProductionCheckout(stored, config, transport);
      const saved = order(await rpc('bud_live_attach_checkout', { p_host: session.hostId, p_order: stored.orderId,
        p_checkout: checkout.checkoutId, p_url: checkout.url }, secret, transport), config);
      if (saved.orderId !== stored.orderId || saved.locale !== stored.locale || saved.checkoutId !== checkout.checkoutId || saved.checkoutUrl !== checkout.url)
        throw new WhopError('LIVE_CHECKOUT_BINDING_FAILED');
      if (saved.fulfilled) throw new WhopError('ORDER_ALREADY_PAID', 409);
    }
    // A URL is returned only after its durable binding is confirmed. Lost responses reuse the same order/provider key.
    const destination=new URL(checkout.url);if(stored.promotion)destination.searchParams.set('promoCode',stored.promotion.code);
    return result(200, 'OK', { orderId: stored.orderId, url: destination.href, environment: 'production' }, sessionHeaders);
  } catch (error) {
    // Operational diagnostics without names, tokens, order IDs, provider payloads or buyer data.
    // Existing client contract and retry/idempotency semantics remain unchanged.
    console.error(JSON.stringify({
      event: 'bud_live_checkout_failure',
      code: error instanceof WhopError ? error.code : 'UNEXPECTED',
      status: error instanceof WhopError ? error.status : 503,
      providerOperation: error instanceof WhopError && 'request' in error &&
        typeof (error as WhopError & { request?: { operation?: string } }).request?.operation === 'string'
        ? (error as WhopError & { request: { operation: string } }).request.operation : undefined,
      ...(error instanceof ProductionPlanMismatch ? { mismatches: error.fields, settings: error.settings } : {}),
    }));
    return error instanceof WhopError ? result(error.status, error.code, undefined, sessionHeaders) : result(503, 'LIVE_CHECKOUT_UNAVAILABLE', undefined, sessionHeaders);
  }
}

/** Future pilot intake. Acknowledge only durable signed references; worker rechecks authoritative payment. */
export async function handleProductionWebhook(request: Request, env: CommerceEnv = environment(), transport: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'POST') return result(405, 'METHOD_NOT_ALLOWED');
  const config = whopProductionProcessingConfig(env), secret = backend(env);
  if (!config || !secret) return result(503, 'LIVE_WEBHOOK_NOT_CONFIGURED');
  try {
    const limited = await enforceRateLimit(request, env, transport, 'webhook'); if (limited) return limited;
    const envelope = await verifyProductionWebhook(request, config);
    const receipt = await rpc('bud_live_enqueue_payment', { p_message: envelope.messageId, p_payment: envelope.paymentId }, secret, transport);
    if (!object(receipt) || receipt.queued !== true) throw new WhopError('LIVE_QUEUE_UNCONFIRMED');
    return result(202, 'PAYMENT_QUEUED', { received: true, credited: false, environment: 'production' });
  } catch (error) { return error instanceof WhopError ? result(error.status, error.code) : result(503, 'LIVE_WEBHOOK_UNAVAILABLE'); }
}

/** Internal bounded worker. No public endpoint or scheduler is installed by this module. */
export async function runProductionPaymentJob(env: CommerceEnv, transport: typeof fetch = fetch) {
  const config = whopProductionProcessingConfig(env), secret = backend(env);
  if (!config || !secret) throw new WhopError('LIVE_WORKER_NOT_CONFIGURED');
  const jobs = await rpc('bud_live_claim_payments', { p_limit: 1 }, secret, transport);
  if (!Array.isArray(jobs) || jobs.length > 1) throw new WhopError('LIVE_QUEUE_UNCONFIRMED');
  if (jobs.length === 0) return { processed: 0, completed: 0, retryRecorded: 0, unconfirmed: 0 };
  const job: unknown = jobs[0];
  if (!object(job) || typeof job.messageId !== 'string' || !/^msg_[A-Za-z0-9]{5,100}$/.test(job.messageId)
    || typeof job.paymentId !== 'string' || !/^pay_[A-Za-z0-9]{5,80}$/.test(job.paymentId)
    || typeof job.leaseToken !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(job.leaseToken))
    throw new WhopError('LIVE_QUEUE_UNCONFIRMED');
  // Deliberately fixed stage names only: no payment IDs, body, PII, tokens, or amounts in logs.
  let verificationStage: 'provider_lookup' | 'order_lookup' | 'order_binding' | 'payment_identity' | 'payment_status' | 'ledger_write' = 'provider_lookup';
  try {
    const { orderId, payment } = await lookupProductionPayment(job.paymentId, config, transport);
    verificationStage = 'order_lookup';
    const stored = order(await rpc('bud_live_order', { p_order: orderId }, secret, transport), config, true);
    verificationStage = 'order_binding';
    if (stored.orderId !== orderId) throw new WhopError('LIVE_ORDER_MISMATCH', 409);
    verificationStage = 'payment_identity';
    assertProductionPaymentIdentity(payment, stored, config);
    verificationStage = 'payment_status';
    assertProductionPaymentMatches(payment, stored, config);
    verificationStage = 'ledger_write';
    const receipt = await rpc('bud_live_finish_payment', { p_message: job.messageId, p_lease: job.leaseToken, p_order: stored.orderId,
      p_company: stored.companyId, p_product: stored.productId, p_plan: stored.planId, p_currency: stored.currency,
      p_amount: stored.amountMinor, p_checkout: stored.checkoutId, p_payment: job.paymentId }, secret, transport);
    if (!object(receipt) || !((receipt.credited === true && receipt.replayed === false) || (receipt.credited === false && receipt.replayed === true)))
      throw new WhopError('LIVE_FULFILLMENT_UNCONFIRMED');
    return { processed: 1, completed: 1, retryRecorded: 0, unconfirmed: 0 };
  } catch (error) {
    if (error instanceof WhopError && error.status === 409) {
      console.warn(JSON.stringify({ event: 'bud_payment_verification_blocked', stage: verificationStage }));
    }
    const code = error instanceof WhopError && error.code.startsWith('WHOP_PRODUCTION') ? 'PROVIDER_RETRY'
      : error instanceof WhopError && error.status === 409 ? 'PAYMENT_REVIEW' : 'BACKEND_RETRY';
    try {
      const retry = await rpc('bud_live_retry_payment', { p_message: job.messageId, p_lease: job.leaseToken, p_code: code }, secret, transport);
      if (!object(retry) || retry.recorded !== true) throw new Error();
      return { processed: 1, completed: 0, retryRecorded: 1, unconfirmed: 0 };
    } catch {
      // A lost response may have committed. Do not guess: a done receipt or lease expiry resolves the next run.
      return { processed: 1, completed: 0, retryRecorded: 0, unconfirmed: 1 };
    }
  }
}
