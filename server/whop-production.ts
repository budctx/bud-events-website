// Server-only provider preparation. No HTTP route or database fulfillment is activated by this module.
import { boundedProviderText, verifyWhopEnvelope, WhopError } from './whop.ts';
import type { CommerceEnv } from './whop.ts';

const API = 'https://api.whop.com/api/v1';
// Explicit compatibility pin: never inherit the API key's changing response model.
const VERSION = '2025-01-01';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export type ProductionPlanExpectation = { token: string; company: string; plan: string; currency: 'sar'; amount: number };
export type ProductionPlan = { companyId: string; productId: string; planId: string; currency: 'sar'; amountMinor: number };
export type ProductionConfig = ProductionPlanExpectation & { product: string; origin: string; pilotHostId: string; secret: string; webhookVersion: string };
export type ProductionOrder = { orderId: string; hostId: string; environment: 'production'; companyId: string; productId: string;
  planId: string; currency: string; amountMinor: number; locale: 'ar' | 'en'; checkoutId: string | null; checkoutUrl: string | null };

function money(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const match = /^(0|[1-9][0-9]{0,6})(?:\.([0-9]{1,2}))?$/.exec(String(value));
  return match ? Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0')) : null;
}
/** Read-only preparation. The owner approved SAR 2 for a pilot, not an eventual retail price. */
export function productionPlanExpectation(env: CommerceEnv): ProductionPlanExpectation | null {
  if (!env.WHOP_PRODUCTION_API_KEY || !/^biz_[A-Za-z0-9]{5,80}$/.test(env.WHOP_PRODUCTION_COMPANY_ID ?? '')
    || !/^plan_[A-Za-z0-9]{5,80}$/.test(env.WHOP_PRODUCTION_PLAN_ID ?? '')
    || env.WHOP_PRODUCTION_CURRENCY !== 'sar' || !/^[1-9][0-9]{0,7}$/.test(env.WHOP_PRODUCTION_AMOUNT_MINOR ?? '')) return null;
  return { token: env.WHOP_PRODUCTION_API_KEY, company: env.WHOP_PRODUCTION_COMPANY_ID!, plan: env.WHOP_PRODUCTION_PLAN_ID!,
    currency: 'sar', amount: Number(env.WHOP_PRODUCTION_AMOUNT_MINOR) };
}
/** Additional explicit pilot gates. Existing saved credentials alone cannot enable checkout. */
export function whopProductionConfig(env: CommerceEnv): ProductionConfig | null {
  if (env.BUD_WHOP_PRODUCTION_ENABLED !== 'true') return null;
  return whopProductionProcessingConfig(env);
}
/** Receipt ingestion/drain remains separately enabled when NEW checkout creation is paused. */
export function whopProductionProcessingConfig(env: CommerceEnv): ProductionConfig | null {
  const plan = productionPlanExpectation(env);
  if (!plan || env.BUD_WHOP_PRODUCTION_PROCESSING_ENABLED !== 'true' || env.WHOP_ENVIRONMENT !== 'production'
    || env.BUD_WHOP_PRODUCTION_MODE !== 'pilot' || !uuid.test(env.BUD_WHOP_PILOT_HOST_ID ?? '')
    || !/^prod_[A-Za-z0-9]{5,80}$/.test(env.WHOP_PRODUCTION_PRODUCT_ID ?? '')
    || !/^ws_[A-Za-z0-9]{32,128}$/.test(env.WHOP_PRODUCTION_WEBHOOK_SECRET ?? '')
    || !['2026-08-14', '2026-10-15-1'].includes(env.WHOP_PRODUCTION_WEBHOOK_API_VERSION ?? '')) return null;
  try {
    const origin = new URL(env.BUD_APP_ORIGIN ?? '');
    if (origin.protocol !== 'https:' || origin.origin !== env.BUD_APP_ORIGIN) return null;
    return { ...plan, product: env.WHOP_PRODUCTION_PRODUCT_ID!, origin: origin.origin, pilotHostId: env.BUD_WHOP_PILOT_HOST_ID!,
      secret: env.WHOP_PRODUCTION_WEBHOOK_SECRET!, webhookVersion: env.WHOP_PRODUCTION_WEBHOOK_API_VERSION! };
  } catch { return null; }
}
async function provider(path: string, config: ProductionPlanExpectation, transport: typeof fetch, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', 'Bearer ' + config.token); headers.set('Api-Version-Date', VERSION);
  let response: Response;
  try { response = await transport(API + path, { ...init, headers, redirect: 'error', signal: AbortSignal.timeout(8000) }); }
  catch { throw new WhopError('WHOP_PRODUCTION_UNAVAILABLE'); }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new WhopError('WHOP_PRODUCTION_ACCESS_DENIED');
    if (response.status === 404) throw new WhopError('WHOP_PRODUCTION_RESOURCE_NOT_FOUND');
    if (response.status === 429) throw new WhopError('WHOP_PRODUCTION_RATE_LIMITED');
    if (response.status === 400 || response.status === 422) throw new WhopError('WHOP_PRODUCTION_REQUEST_REJECTED');
    throw new WhopError('WHOP_PRODUCTION_UNAVAILABLE');
  }
  try {
    const data: unknown = JSON.parse(await boundedProviderText(response.body));
    if (!object(data)) throw new Error();
    return data;
  } catch { throw new WhopError('INVALID_PRODUCTION_PROVIDER_RESPONSE'); }
}
/** GET only: discover the product from the verified plan, without requesting broad catalogue access or logging the raw response. */
export async function inspectProductionPlan(config: ProductionPlanExpectation, transport: typeof fetch = fetch): Promise<ProductionPlan> {
  const plan = await provider('/plans/' + encodeURIComponent(config.plan), config, transport);
  if (plan.id !== config.plan || !object(plan.company) || plan.company.id !== config.company || !object(plan.product)
    || typeof plan.product.id !== 'string' || !/^prod_[A-Za-z0-9]{5,80}$/.test(plan.product.id)
    || plan.plan_type !== 'one_time' || plan.currency !== config.currency || money(plan.initial_price) !== config.amount
    || money(plan.renewal_price) !== 0 || plan.adaptive_pricing_enabled !== false || typeof plan.collect_tax !== 'boolean'
    || (plan.collect_tax && plan.tax_type !== 'inclusive')) throw new WhopError('PRODUCTION_PLAN_MISMATCH', 409);
  return { companyId: config.company, productId: plan.product.id, planId: config.plan, currency: config.currency, amountMinor: config.amount };
}
export function productionOrderMatches(order: ProductionOrder, config: ProductionConfig): boolean {
  return uuid.test(order.orderId) && uuid.test(order.hostId) && order.hostId === config.pilotHostId && order.environment === 'production'
    && order.companyId === config.company && order.productId === config.product && order.planId === config.plan
    && order.currency === config.currency && order.amountMinor === config.amount && (order.locale === 'ar' || order.locale === 'en');
}
export function assertProductionCheckoutUrl(checkoutId: string, value: string): void {
  let url: URL; try { url = new URL(value); } catch { throw new WhopError('INVALID_PRODUCTION_CHECKOUT_URL'); }
  if (!/^ch_[A-Za-z0-9]{5,80}$/.test(checkoutId) || url.origin !== 'https://whop.com' || url.username || url.password || url.search || url.hash
    || ![('/checkout/' + checkoutId), ('/checkout/' + checkoutId + '/')].includes(url.pathname)) throw new WhopError('INVALID_PRODUCTION_CHECKOUT_URL');
}
export async function createProductionCheckout(order: ProductionOrder, config: ProductionConfig, transport: typeof fetch = fetch) {
  if (!productionOrderMatches(order, config)) throw new WhopError('PRODUCTION_ORDER_MISMATCH', 409);
  const plan = await inspectProductionPlan(config, transport);
  if (plan.productId !== config.product) throw new WhopError('PRODUCTION_PLAN_MISMATCH', 409);
  const checkout = await provider('/checkout_configurations', config, transport, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'bud-production-' + order.orderId },
    body: JSON.stringify({ plan_id: config.plan, mode: 'payment', metadata: { bud_order_id: order.orderId, bud_environment: 'production' },
      redirect_url: config.origin + '/?screen=events&lang=' + order.locale + '&order=' + order.orderId }) });
  if (typeof checkout.id !== 'string' || typeof checkout.purchase_url !== 'string' || checkout.company_id !== config.company
    || !object(checkout.plan) || checkout.plan.id !== config.plan || checkout.plan.currency !== config.currency
    || (checkout.currency != null && checkout.currency !== config.currency) || checkout.mode !== 'payment' || !object(checkout.metadata)
    || checkout.metadata.bud_order_id !== order.orderId || checkout.metadata.bud_environment !== 'production') throw new WhopError('PRODUCTION_CHECKOUT_MISMATCH');
  assertProductionCheckoutUrl(checkout.id, checkout.purchase_url);
  return { checkoutId: checkout.id, url: checkout.purchase_url };
}
export async function verifyProductionWebhook(request: Request, config: ProductionConfig, now = Date.now()) {
  const envelope = await verifyWhopEnvelope(request, config.secret, config.company, config.webhookVersion, now);
  if (envelope.type !== 'payment.succeeded') throw new WhopError('UNHANDLED_PRODUCTION_EVENT', 422);
  return envelope;
}
export async function lookupProductionPayment(paymentId: string, config: ProductionConfig, transport: typeof fetch = fetch) {
  if (!/^pay_[A-Za-z0-9]{5,80}$/.test(paymentId)) throw new WhopError('INVALID_PRODUCTION_PAYMENT', 400);
  const payment = await provider('/payments/' + encodeURIComponent(paymentId), config, transport);
  if (payment.id !== paymentId || !object(payment.metadata) || typeof payment.metadata.bud_order_id !== 'string'
    || !uuid.test(payment.metadata.bud_order_id) || payment.metadata.bud_environment !== 'production') throw new WhopError('PRODUCTION_PAYMENT_MISMATCH', 409);
  return { orderId: payment.metadata.bud_order_id, payment };
}
/** Call only after an authoritative payment lookup and durable server-order lookup; this function never grants credit. */
export function assertProductionPaymentMatches(payment: Record<string, unknown>, order: ProductionOrder, config: ProductionConfig): void {
  assertProductionPaymentIdentity(payment, order, config);
  if (payment.status !== 'paid' || payment.substatus !== 'succeeded' || typeof payment.paid_at !== 'string' || !Number.isFinite(Date.parse(payment.paid_at))
    || money(payment.refunded_amount) !== 0 || payment.auto_refunded !== false || payment.refunded_at !== null
    || !Array.isArray(payment.disputes) || payment.disputes.length !== 0) throw new WhopError('PRODUCTION_PAYMENT_MISMATCH', 409);
}
/** Stable binding checks also apply when the authoritative payment has since been refunded/disputed. */
export function assertProductionPaymentIdentity(payment: Record<string, unknown>, order: ProductionOrder, config: ProductionConfig): void {
  if (!productionOrderMatches(order, config) || !order.checkoutId || !order.checkoutUrl) throw new WhopError('PRODUCTION_PAYMENT_MISMATCH', 409);
  assertProductionCheckoutUrl(order.checkoutId, order.checkoutUrl);
  if (typeof payment.id !== 'string' || !/^pay_[A-Za-z0-9]{5,80}$/.test(payment.id) || payment.checkout_configuration_id !== order.checkoutId
    || !object(payment.company) || payment.company.id !== order.companyId || !object(payment.product) || payment.product.id !== order.productId
    || !object(payment.plan) || payment.plan.id !== order.planId || payment.currency !== order.currency || money(payment.total) !== order.amountMinor
    || !object(payment.metadata) || payment.metadata.bud_order_id !== order.orderId || payment.metadata.bud_environment !== 'production') throw new WhopError('PRODUCTION_PAYMENT_MISMATCH', 409);
}

export function productionPaymentCondition(payment: Record<string, unknown>): 'clear' | 'review' | 'refunded' | 'disputed' {
  if (!Array.isArray(payment.disputes) || typeof payment.auto_refunded !== 'boolean') return 'review';
  if (payment.disputes.length > 0) return 'disputed';
  const refunded = money(payment.refunded_amount), total = money(payment.total);
  if (refunded === null || total === null || total < 1 || refunded > total) return 'review';
  if (refunded === total) return 'refunded';
  if (refunded > 0 || payment.auto_refunded || payment.refunded_at !== null) return 'review';
  return payment.status === 'paid' && payment.substatus === 'succeeded' && typeof payment.paid_at === 'string'
    && Number.isFinite(Date.parse(payment.paid_at)) ? 'clear' : 'review';
}
