// Sandbox provider adapter only. It cannot address production Whop hosts.
export type CommerceEnv = Record<string, string | undefined>;
export type SandboxOrder = { orderId: string; hostId: string; environment: 'sandbox'; companyId: string; productId: string; planId: string;
  currency: string; amountMinor: number; checkoutId: string | null; checkoutUrl: string | null };
export type WhopSandboxConfig = { token: string; secret: string; company: string; product: string; plan: string; currency: string; amount: number; origin: string };
const API = 'https://sandbox-api.whop.com/api/v1';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export class WhopError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 503) { super(code); this.code = code; this.status = status; }
}
export function whopSandboxConfig(env: CommerceEnv): WhopSandboxConfig | null {
  if (env.BUD_WHOP_SANDBOX_ENABLED !== 'true' || env.WHOP_ENVIRONMENT !== 'sandbox' || !env.WHOP_SANDBOX_API_KEY
    || !/^ws_[A-Za-z0-9]{32,128}$/.test(env.WHOP_SANDBOX_WEBHOOK_SECRET ?? '') || !/^biz_[A-Za-z0-9]{5,80}$/.test(env.WHOP_SANDBOX_COMPANY_ID ?? '')
    || !/^prod_[A-Za-z0-9]{5,80}$/.test(env.WHOP_SANDBOX_PRODUCT_ID ?? '') || !/^plan_[A-Za-z0-9]{5,80}$/.test(env.WHOP_SANDBOX_PLAN_ID ?? '')
    || !['usd', 'sar'].includes(env.WHOP_SANDBOX_CURRENCY ?? '') || !/^[1-9][0-9]{0,7}$/.test(env.WHOP_SANDBOX_AMOUNT_MINOR ?? '') || !env.BUD_APP_ORIGIN) return null;
  try {
    const origin = new URL(env.BUD_APP_ORIGIN);
    if (origin.protocol !== 'https:' || origin.origin !== env.BUD_APP_ORIGIN) return null;
    return { token: env.WHOP_SANDBOX_API_KEY, secret: env.WHOP_SANDBOX_WEBHOOK_SECRET!, company: env.WHOP_SANDBOX_COMPANY_ID!,
      product: env.WHOP_SANDBOX_PRODUCT_ID!, plan: env.WHOP_SANDBOX_PLAN_ID!, currency: env.WHOP_SANDBOX_CURRENCY!, amount: Number(env.WHOP_SANDBOX_AMOUNT_MINOR), origin: origin.origin };
  } catch { return null; }
}
export async function boundedProviderText(body: ReadableStream<Uint8Array> | null, limit = 131072): Promise<string> {
  if (!body) throw new WhopError('INVALID_PROVIDER_BODY', 400);
  const reader = body.getReader(); const decoder = new TextDecoder('utf-8', { fatal: true }); let size = 0; let text = '';
  while (true) {
    const next = await reader.read(); if (next.done) break;
    size += next.value.length;
    if (size > limit) { await reader.cancel(); throw new WhopError('BODY_TOO_LARGE', 413); }
    text += decoder.decode(next.value, { stream: true });
  }
  return text + decoder.decode();
}
// Legacy resource monetary values are decimal major units; never round mismatches into acceptance.
function minor(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const match = /^(0|[1-9][0-9]{0,8})(?:\.([0-9]{1,2}))?$/.exec(String(value));
  return match ? Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0')) : null;
}
export function orderMatches(order: SandboxOrder, config: WhopSandboxConfig): boolean {
  return uuid.test(order.orderId) && uuid.test(order.hostId) && order.environment === 'sandbox' && order.companyId === config.company
    && order.productId === config.product && order.planId === config.plan && order.currency === config.currency && order.amountMinor === config.amount;
}
async function provider(path: string, config: WhopSandboxConfig, transport: typeof fetch, init: RequestInit = {}) {
  const headers = new Headers(init.headers); headers.set('Authorization', 'Bearer ' + config.token);
  // Documented legacy resources remain supported. Explicit original pin avoids silently adopting new monetary/identity shapes.
  headers.set('Api-Version-Date', '2025-01-01');
  const response = await transport(API + path, { ...init, headers, redirect: 'error', signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new WhopError('WHOP_SANDBOX_UNAVAILABLE');
  let data: unknown;
  try { data = JSON.parse(await boundedProviderText(response.body)); } catch { throw new WhopError('INVALID_PROVIDER_RESPONSE'); }
  if (!object(data)) throw new WhopError('INVALID_PROVIDER_RESPONSE');
  return data;
}
export async function createSandboxCheckout(order: SandboxOrder, config: WhopSandboxConfig, transport: typeof fetch = fetch): Promise<{ checkoutId: string; url: string }> {
  if (!orderMatches(order, config)) throw new WhopError('ORDER_CONFIGURATION_MISMATCH', 409);
  const plan = await provider('/plans/' + encodeURIComponent(config.plan), config, transport);
  if (plan.id !== config.plan || !object(plan.company) || plan.company.id !== config.company || !object(plan.product) || plan.product.id !== config.product
    || plan.plan_type !== 'one_time' || plan.currency !== config.currency || minor(plan.initial_price) !== config.amount || minor(plan.renewal_price) !== 0
    || plan.adaptive_pricing_enabled !== false || (plan.collect_tax === true && plan.tax_type !== 'inclusive')) throw new WhopError('PROVIDER_PLAN_MISMATCH', 409);
  const checkout = await provider('/checkout_configurations', config, transport, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'bud-sandbox-' + order.orderId },
    body: JSON.stringify({ plan_id: config.plan, mode: 'payment', metadata: { bud_order_id: order.orderId }, redirect_url: config.origin + '/?screen=host' }) });
  if (typeof checkout.id !== 'string' || !/^ch_[A-Za-z0-9]{5,80}$/.test(checkout.id) || checkout.company_id !== config.company
    || !object(checkout.plan) || checkout.plan.id !== config.plan || checkout.plan.currency !== config.currency || (checkout.currency != null && checkout.currency !== config.currency) || checkout.mode !== 'payment'
    || !object(checkout.metadata) || checkout.metadata.bud_order_id !== order.orderId || typeof checkout.purchase_url !== 'string') throw new WhopError('PROVIDER_CHECKOUT_MISMATCH');
  let url: URL; try { url = new URL(checkout.purchase_url); } catch { throw new WhopError('INVALID_CHECKOUT_URL'); }
  if (url.origin !== 'https://sandbox.whop.com' || url.username || url.password || ![('/checkout/' + checkout.id), ('/checkout/' + checkout.id + '/')].includes(url.pathname)
    || url.search || url.hash) throw new WhopError('INVALID_CHECKOUT_URL');
  return { checkoutId: checkout.id, url: url.href };
}
export type VerifiedWhopEnvelope = { messageId: string; paymentId: string; type: string };
export async function verifySandboxWebhook(request: Request, config: WhopSandboxConfig, now = Date.now()): Promise<VerifiedWhopEnvelope> {
  if (request.method !== 'POST') throw new WhopError('METHOD_NOT_ALLOWED', 405);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new WhopError('JSON_REQUIRED', 415);
  const messageId = request.headers.get('webhook-id') ?? ''; const stamp = request.headers.get('webhook-timestamp') ?? '';
  const signatures = request.headers.get('webhook-signature') ?? '';
  if (!/^msg_[A-Za-z0-9]{5,100}$/.test(messageId) || !/^[0-9]{10}$/.test(stamp) || Math.abs(Number(stamp) * 1000 - now) > 300000
    || signatures.length > 2048) throw new WhopError('INVALID_WEBHOOK_SIGNATURE', 401);
  const raw = await boundedProviderText(request.body);
  // Official current verifier contract uses the ws_ secret verbatim as UTF-8 HMAC key.
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(config.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const signed = new TextEncoder().encode(messageId + '.' + stamp + '.' + raw);
  let valid = false;
  for (const signature of signatures.split(' ').slice(0, 8)) {
    const match = /^v1,([A-Za-z0-9+/]{43}=)$/.exec(signature); if (!match) continue;
    const bytes = Uint8Array.from(atob(match[1]), char => char.charCodeAt(0));
    // WebCrypto comparison is constant-time; no string equality for MAC bytes.
    if (await crypto.subtle.verify('HMAC', key, bytes, signed)) valid = true;
  }
  if (!valid) throw new WhopError('INVALID_WEBHOOK_SIGNATURE', 401);
  let envelope: unknown; try { envelope = JSON.parse(raw); } catch { throw new WhopError('INVALID_WEBHOOK_BODY', 400); }
  if (!object(envelope) || envelope.id !== messageId || envelope.api_version !== 'v1' || envelope.api_version_date !== '2026-08-14'
    || envelope.account_id !== config.company || typeof envelope.type !== 'string' || !object(envelope.data)
    || typeof envelope.data.id !== 'string' || !/^pay_[A-Za-z0-9]{5,80}$/.test(envelope.data.id)) throw new WhopError('WEBHOOK_SCOPE_MISMATCH', 400);
  return { messageId, paymentId: envelope.data.id, type: envelope.type };
}
export async function lookupSandboxPayment(paymentId: string, config: WhopSandboxConfig, transport: typeof fetch = fetch): Promise<{ orderId: string; payment: Record<string, unknown> }> {
  if (!/^pay_[A-Za-z0-9]{5,80}$/.test(paymentId)) throw new WhopError('INVALID_PAYMENT', 400);
  const payment = await provider('/payments/' + encodeURIComponent(paymentId), config, transport);
  if (payment.id !== paymentId || !object(payment.metadata) || typeof payment.metadata.bud_order_id !== 'string' || !uuid.test(payment.metadata.bud_order_id)) throw new WhopError('PAYMENT_ORDER_MISMATCH', 409);
  return { orderId: payment.metadata.bud_order_id, payment };
}
export function assertSandboxPaymentMatches(payment: Record<string, unknown>, order: SandboxOrder, config: WhopSandboxConfig): void {
  if (!orderMatches(order, config) || !order.checkoutId || payment.checkout_configuration_id !== order.checkoutId
    || payment.status !== 'paid' || payment.substatus !== 'succeeded' || typeof payment.paid_at !== 'string' || !Number.isFinite(Date.parse(payment.paid_at))
    || !object(payment.company) || payment.company.id !== order.companyId || !object(payment.product) || payment.product.id !== order.productId
    || !object(payment.plan) || payment.plan.id !== order.planId || payment.currency !== order.currency || minor(payment.total) !== order.amountMinor
    || !object(payment.metadata) || payment.metadata.bud_order_id !== order.orderId || minor(payment.refunded_amount) !== 0
    || payment.auto_refunded === true || payment.refunded_at != null || (Array.isArray(payment.disputes) && payment.disputes.length > 0)) throw new WhopError('PAYMENT_ORDER_MISMATCH', 409);
}
