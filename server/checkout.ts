import { resolveSession } from './auth.ts';
import { assertSandboxPaymentMatches, boundedProviderText, createSandboxCheckout, lookupSandboxPayment, orderMatches, verifySandboxWebhook, WhopError, whopSandboxConfig } from './whop.ts';
import type { CommerceEnv, SandboxOrder } from './whop.ts';
import { enforceRateLimit } from './rate-limit.ts';
const PROJECT = 'https://cepmvqqrjcvhyzszqand.supabase.co';
type Transport = typeof fetch;
function environment(): CommerceEnv { return (globalThis as unknown as { process?: { env?: CommerceEnv } }).process?.env ?? {}; }
function backend(env: CommerceEnv) {
  return env.BUD_BACKEND_ENABLED === 'true' && env.SUPABASE_URL === PROJECT && env.SUPABASE_SERVICE_ROLE_KEY ? env.SUPABASE_SERVICE_ROLE_KEY : null;
}
function json(status: number, code: string, data?: unknown, sessionHeaders?: Headers) {
  const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  if (sessionHeaders) for (const value of sessionHeaders.getSetCookie()) headers.append('Set-Cookie', value);
  return Response.json({ code, ...(data === undefined ? {} : { data }) }, { status, headers });
}
async function rpc(name: string, params: object, secret: string, transport: Transport) {
  const response = await transport(PROJECT + '/rest/v1/rpc/' + name, { method: 'POST', headers: { apikey: secret, Authorization: 'Bearer ' + secret, 'Content-Type': 'application/json' },
    body: JSON.stringify(params), signal: AbortSignal.timeout(8000), redirect: 'error' });
  let data: unknown;
  try { data = JSON.parse(await boundedProviderText(response.body)); } catch { throw new WhopError('BACKEND_UNAVAILABLE'); }
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'message' in data ? data.message : null;
    if (message === 'BUD_KEY_REUSED') throw new WhopError('IDEMPOTENCY_KEY_REUSED', 409);
    if (message === 'BUD_ORDER_NOT_FOUND') throw new WhopError('ORDER_NOT_FOUND', 404);
    if (message === 'BUD_ORDER_MISMATCH' || message === 'BUD_CHECKOUT_MISMATCH') throw new WhopError('ORDER_MISMATCH', 409);
    throw new WhopError('BACKEND_UNAVAILABLE');
  }
  return data;
}
export async function handleCheckout(request: Request, env: CommerceEnv = environment(), transport: Transport = fetch): Promise<Response> {
  if (request.method !== 'POST') return json(405, 'METHOD_NOT_ALLOWED');
  const config = whopSandboxConfig(env); const secret = backend(env);
  if (!config || !secret || env.BUD_AUTH_ENABLED !== 'true') return json(503, 'SANDBOX_CHECKOUT_NOT_CONFIGURED');
  if (new URL(request.url).origin !== config.origin || request.headers.get('origin') !== config.origin) return json(403, 'ORIGIN_DENIED');
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return json(415, 'JSON_REQUIRED');
  let sessionHeaders: Headers | undefined;
  try {
    const limited = await enforceRateLimit(request, env, transport, 'checkout'); if (limited) return limited;
    const session = await resolveSession(request, env, transport);
    if (!session) return json(401, 'DISCORD_AUTH_REQUIRED'); sessionHeaders = session.headers;
    let body: unknown; try { body = JSON.parse(await boundedProviderText(request.body, 2048)); } catch (error) { if (error instanceof WhopError) throw error; throw new WhopError('INVALID_JSON', 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || !('idempotencyKey' in body) || typeof body.idempotencyKey !== 'string'
      || !/^[A-Za-z0-9_-]{16,100}$/.test(body.idempotencyKey) || Object.keys(body).some(key => key !== 'idempotencyKey')) throw new WhopError('INVALID_CHECKOUT_REQUEST', 400);
    const order = await rpc('bud_create_sandbox_order', { p_host: session.hostId, p_key: body.idempotencyKey, p_company: config.company, p_product: config.product,
      p_plan: config.plan, p_currency: config.currency, p_amount: config.amount }, secret, transport) as SandboxOrder;
    if (!order || !orderMatches(order, config) || order.hostId !== session.hostId) throw new WhopError('ORDER_CONFIGURATION_MISMATCH', 409);
    let checkout = order.checkoutId && order.checkoutUrl ? { checkoutId: order.checkoutId, url: order.checkoutUrl } : null;
    if (checkout) {
      const url = new URL(checkout.url);
      if (url.origin !== 'https://sandbox.whop.com' || url.username || url.password || ![('/checkout/' + checkout.checkoutId), ('/checkout/' + checkout.checkoutId + '/')].includes(url.pathname)
        || url.search || url.hash) throw new WhopError('INVALID_CHECKOUT_URL');
    } else {
      checkout = await createSandboxCheckout(order, config, transport);
      const saved = await rpc('bud_attach_sandbox_checkout', { p_host: session.hostId, p_order: order.orderId, p_checkout: checkout.checkoutId, p_url: checkout.url }, secret, transport) as SandboxOrder;
      if (!saved || saved.orderId !== order.orderId || saved.hostId !== session.hostId || saved.checkoutId !== checkout.checkoutId || saved.checkoutUrl !== checkout.url || !orderMatches(saved, config)) throw new WhopError('CHECKOUT_BINDING_FAILED');
    }
    return json(200, 'OK', { orderId: order.orderId, url: checkout.url, environment: 'sandbox' }, sessionHeaders);
  } catch (error) { return error instanceof WhopError ? json(error.status, error.code, undefined, sessionHeaders) : json(503, 'SANDBOX_CHECKOUT_UNAVAILABLE', undefined, sessionHeaders); }
}
/** This handler is sandbox-only; the existing production webhook route remains disabled until explicitly wired and reviewed. */
export async function handleSandboxWhopWebhook(request: Request, env: CommerceEnv = environment(), transport: Transport = fetch): Promise<Response> {
  if (request.method !== 'POST') return json(405, 'METHOD_NOT_ALLOWED');
  const config = whopSandboxConfig(env); const secret = backend(env);
  if (!config || !secret) return json(503, 'SANDBOX_WEBHOOK_NOT_CONFIGURED');
  try {
    const limited = await enforceRateLimit(request, env, transport, 'webhook'); if (limited) return limited;
    const envelope = await verifySandboxWebhook(request, config);
    // No silent acknowledgement of refunds/disputes or new event types; they require reviewed reconciliation policy.
    if (envelope.type !== 'payment.succeeded') return json(422, 'UNHANDLED_SANDBOX_EVENT');
    const { payment, orderId } = await lookupSandboxPayment(envelope.paymentId, config, transport);
    const order = await rpc('bud_sandbox_order', { p_order: orderId }, secret, transport) as SandboxOrder;
    if (!order) throw new WhopError('ORDER_NOT_FOUND', 404);
    assertSandboxPaymentMatches(payment, order, config);
    await rpc('bud_credit_verified_purchase', { p_order: order.orderId, p_environment: 'sandbox', p_company: order.companyId, p_product: order.productId,
      p_currency: order.currency.toUpperCase(), p_amount_minor: order.amountMinor, p_payment: envelope.paymentId, p_message: envelope.messageId }, secret, transport);
    return json(200, 'OK', { received: true, environment: 'sandbox' });
  } catch (error) { return error instanceof WhopError ? json(error.status, error.code) : json(503, 'SANDBOX_WEBHOOK_UNAVAILABLE'); }
}
