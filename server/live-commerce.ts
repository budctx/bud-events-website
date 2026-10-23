// Preparation only: no api/ entrypoint imports these handlers.
import { resolveSession } from './auth.ts';
import { enforceRateLimit } from './rate-limit.ts';
import { boundedProviderText, WhopError } from './whop.ts';
import type { CommerceEnv } from './whop.ts';
import { assertProductionCheckoutUrl, assertProductionPaymentMatches, createProductionCheckout, lookupProductionPayment,
  productionOrderMatches, verifyProductionWebhook, whopProductionConfig } from './whop-production.ts';
import type { ProductionConfig, ProductionOrder } from './whop-production.ts';

const PROJECT = 'https://cepmvqqrjcvhyzszqand.supabase.co';
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
    if (message === 'BUD_ORDER_NOT_FOUND') throw new WhopError('ORDER_NOT_FOUND', 404);
    // Never return SQL, provider bodies, service credentials or financial identifiers on errors.
    throw new WhopError('LIVE_BACKEND_UNAVAILABLE');
  }
  return data;
}
function order(value: unknown, config: ProductionConfig): StoredOrder {
  if (!object(value) || !productionOrderMatches(value as StoredOrder, config) || typeof value.fulfilled !== 'boolean'
    || !((value.checkoutId === null && value.checkoutUrl === null) || (typeof value.checkoutId === 'string' && typeof value.checkoutUrl === 'string')))
    throw new WhopError('LIVE_ORDER_MISMATCH', 409);
  const stored = value as StoredOrder;
  if (stored.checkoutId !== null) assertProductionCheckoutUrl(stored.checkoutId, stored.checkoutUrl!);
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
    if (session.hostId !== config.pilotHostId) return result(403, 'PILOT_HOST_REQUIRED', undefined, sessionHeaders);
    const hostLimited = await enforceRateLimit(request, env, transport, 'checkout', session.hostId);
    if (hostLimited) {
      for (const cookie of sessionHeaders.getSetCookie()) hostLimited.headers.append('Set-Cookie', cookie);
      return hostLimited;
    }
    let body: unknown;
    try { body = JSON.parse(await boundedProviderText(request.body, 2048)); }
    catch { throw new WhopError('INVALID_CHECKOUT_REQUEST', 400); }
    if (!object(body) || typeof body.idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(body.idempotencyKey)
      || typeof body.locale !== 'string' || !['ar', 'en'].includes(body.locale) || Object.keys(body).some(key => !['idempotencyKey', 'locale'].includes(key)))
      throw new WhopError('INVALID_CHECKOUT_REQUEST', 400);
    const stored = order(await rpc('bud_live_create_order', { p_host: session.hostId, p_key: body.idempotencyKey, p_company: config.company,
      p_product: config.product, p_plan: config.plan, p_currency: config.currency, p_amount: config.amount, p_locale: body.locale }, secret, transport), config);
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
    return result(200, 'OK', { orderId: stored.orderId, url: checkout.url, environment: 'production' }, sessionHeaders);
  } catch (error) {
    return error instanceof WhopError ? result(error.status, error.code, undefined, sessionHeaders) : result(503, 'LIVE_CHECKOUT_UNAVAILABLE', undefined, sessionHeaders);
  }
}

/** Future synchronous pilot fulfillment. No 2xx until the SQL receipt has committed. Not a durable queue. */
export async function handleProductionWebhook(request: Request, env: CommerceEnv = environment(), transport: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'POST') return result(405, 'METHOD_NOT_ALLOWED');
  const config = whopProductionConfig(env), secret = backend(env);
  if (!config || !secret) return result(503, 'LIVE_WEBHOOK_NOT_CONFIGURED');
  try {
    const limited = await enforceRateLimit(request, env, transport, 'webhook'); if (limited) return limited;
    const envelope = await verifyProductionWebhook(request, config);
    const { orderId, payment } = await lookupProductionPayment(envelope.paymentId, config, transport);
    const stored = order(await rpc('bud_live_order', { p_order: orderId }, secret, transport), config);
    if (stored.orderId !== orderId) throw new WhopError('LIVE_ORDER_MISMATCH', 409);
    assertProductionPaymentMatches(payment, stored, config);
    const receipt = await rpc('bud_live_credit_purchase', { p_order: stored.orderId, p_company: stored.companyId, p_product: stored.productId,
      p_plan: stored.planId, p_currency: stored.currency, p_amount: stored.amountMinor, p_checkout: stored.checkoutId,
      p_payment: envelope.paymentId, p_message: envelope.messageId }, secret, transport);
    if (!object(receipt) || !((receipt.credited === true && receipt.replayed === false) || (receipt.credited === false && receipt.replayed === true)))
      throw new WhopError('LIVE_FULFILLMENT_UNCONFIRMED');
    return result(200, 'OK', { received: true, environment: 'production' });
  } catch (error) { return error instanceof WhopError ? result(error.status, error.code) : result(503, 'LIVE_WEBHOOK_UNAVAILABLE'); }
}
