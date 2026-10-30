// Server-only provider preparation. No HTTP route or database fulfillment is activated by this module.
import { boundedProviderText, verifyWhopEnvelope, WhopError } from './whop.ts';
import type { CommerceEnv } from './whop.ts';
import type {PromoSnapshot} from './whop-promos.ts';
import { liveAudience } from './live-access.ts';

const API = 'https://api.whop.com/api/v1';
// Explicit compatibility pin: never inherit the API key's changing response model.
const VERSION = '2025-01-01';
// Plan reads use the documented Account model; financial writes/reads retain their existing pin.
export const PLAN_VERSION = '2026-10-15-1';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export type ProductionPlanExpectation = { token: string; company: string; plan: string; currency: 'sar'; amount: number; product?: string };
export type PlanEvidence = { apiVersion:string; resource:'plans'; checkedAt:string; providerDate:string|null; cacheAgeSeconds:number|null;
  expected:{companyId:string;planId:string;productId:string|null}; observed:{companyId:string|null;planId:string|null;productId:string|null};
  productBinding:'matched'|'mismatched'|'not_configured'; quoteChecked:false };
export type ProductionPlan = { companyId: string; productId: string; planId: string; currency: 'sar'; amountMinor: number };
export class ProductionPlanMismatch extends WhopError {
  readonly fields: string[];
  readonly settings: Record<string, string>;
  constructor(fields: string[], settings: Record<string, string>) { super('PRODUCTION_PLAN_MISMATCH', 409); this.fields = fields; this.settings = settings; }
}
export class ProductionProviderRejection extends WhopError {
  request:{operation:'plan_read'|'quote_preview'|'checkout'|'payment_read'|'other';apiVersion:string;providerStatus:number;reason:string;field:string|null};
  constructor(code:string,path:string,apiVersion:string,providerStatus:number,reason='unclassified',field:string|null=null) {
    super(code);
    this.request={operation:path==='/payment_quotes'?'quote_preview':(path.startsWith('/variants/')||path.startsWith('/plans/'))?'plan_read':path==='/checkout_configurations'?'checkout':path.startsWith('/payments/')?'payment_read':'other',
      apiVersion,providerStatus,reason,field};
  }
}
/** Classify a rejected request in memory. Return only fixed enums, never provider text. */
export function classifyProductionRejection(data:unknown):{reason:string;field:string|null} {
  const error=object(data)&&object(data.error)?data.error:object(data)?data:{};
  const message=typeof error.message==='string'?error.message.slice(0,2048):'';
  const codes:Record<string,string>={invalid_api_version:'version',unsupported_api_version:'version',quote_location_required:'location',
    quote_currency_unsupported:'currency',quote_currency_not_supported:'currency',quote_tax_unavailable:'tax',promo_invalid:'promo'};
  let reason=typeof error.code==='string'&&Object.hasOwn(codes,error.code)?codes[error.code]:'unclassified';
  if(reason==='unclassified'&&/api[-_ ]?version|api-version-date/i.test(message)&&/unsupported|unknown|invalid|not supported/i.test(message))reason='version';
  const fields=['account_id','company_id','plan_id','line_items','presentment_country','presentment_currency','address','currency','amount'];
  let field=typeof error.param==='string'&&fields.includes(error.param)?error.param:null;
  if(/required|missing|must be provided/i.test(message)) {
    field??=fields.find(value=>new RegExp('\\b'+value+'\\b').test(message))??null;
    if(reason==='unclassified'&&field)reason='required_field';
  }
  return {reason,field};
}
export type ProductionConfig = ProductionPlanExpectation & { product: string; origin: string; pilotHostId: string; audience: 'pilot' | 'public'; secret: string; webhookVersion: string };
export type ProductionOrder = { orderId: string; hostId: string; environment: 'production'; companyId: string; productId: string;
  planId: string; currency: string; amountMinor: number; locale: 'ar' | 'en'; checkoutId: string | null; checkoutUrl: string | null; promotion?:PromoSnapshot };

function money(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const match = /^(0|[1-9][0-9]{0,6})(?:\.([0-9]{1,2}))?$/.exec(String(value));
  return match ? Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0')) : null;
}
/** Read-only expectations. Owner-approved current price comes from server configuration; base plan price stays separate from each stored promotion. */
export function productionPlanExpectation(env: CommerceEnv): ProductionPlanExpectation | null {
  if (!env.WHOP_PRODUCTION_API_KEY || !/^biz_[A-Za-z0-9]{5,80}$/.test(env.WHOP_PRODUCTION_COMPANY_ID ?? '')
    || !/^plan_[A-Za-z0-9]{5,80}$/.test(env.WHOP_PRODUCTION_PLAN_ID ?? '')
    || env.WHOP_PRODUCTION_CURRENCY !== 'sar' || !/^[1-9][0-9]{0,7}$/.test(env.WHOP_PRODUCTION_AMOUNT_MINOR ?? '')
    || (env.WHOP_PRODUCTION_PRODUCT_ID !== undefined && !/^prod_[A-Za-z0-9]{5,80}$/.test(env.WHOP_PRODUCTION_PRODUCT_ID))) return null;
  return { token: env.WHOP_PRODUCTION_API_KEY, company: env.WHOP_PRODUCTION_COMPANY_ID!, plan: env.WHOP_PRODUCTION_PLAN_ID!,
    currency: 'sar', amount: Number(env.WHOP_PRODUCTION_AMOUNT_MINOR), ...(env.WHOP_PRODUCTION_PRODUCT_ID ? {product:env.WHOP_PRODUCTION_PRODUCT_ID} : {}) };
}
/** Additional explicit pilot gates. Existing saved credentials alone cannot enable checkout. */
export function whopProductionConfig(env: CommerceEnv): ProductionConfig | null {
  if (env.BUD_WHOP_PRODUCTION_ENABLED !== 'true') return null;
  return whopProductionProcessingConfig(env);
}
/** Receipt ingestion/drain remains separately enabled when NEW checkout creation is paused. */
export function whopProductionProcessingConfig(env: CommerceEnv): ProductionConfig | null {
  const plan = productionPlanExpectation(env);
  const audience = liveAudience(env);
  if (!plan || env.BUD_WHOP_PRODUCTION_PROCESSING_ENABLED !== 'true' || env.WHOP_ENVIRONMENT !== 'production'
    || !audience
    || !/^prod_[A-Za-z0-9]{5,80}$/.test(env.WHOP_PRODUCTION_PRODUCT_ID ?? '')
    || !/^ws_[A-Za-z0-9]{32,128}$/.test(env.WHOP_PRODUCTION_WEBHOOK_SECRET ?? '')
    || !['2026-08-14', '2026-10-15-1'].includes(env.WHOP_PRODUCTION_WEBHOOK_API_VERSION ?? '')) return null;
  try {
    const origin = new URL(env.BUD_APP_ORIGIN ?? '');
    if (origin.protocol !== 'https:' || origin.origin !== env.BUD_APP_ORIGIN) return null;
    return { ...plan, product: env.WHOP_PRODUCTION_PRODUCT_ID!, origin: origin.origin, pilotHostId: env.BUD_WHOP_PILOT_HOST_ID ?? '', audience,
      secret: env.WHOP_PRODUCTION_WEBHOOK_SECRET!, webhookVersion: env.WHOP_PRODUCTION_WEBHOOK_API_VERSION! };
  } catch { return null; }
}
export async function productionProvider(path: string, config: ProductionPlanExpectation, transport: typeof fetch, init: RequestInit = {}, version = VERSION,
  observe?: (response:Response)=>void) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', 'Bearer ' + config.token); headers.set('Api-Version-Date', version);
  let response: Response;
  try { response = await transport(API + path, { ...init, headers, cache:'no-store', redirect: 'error', signal: AbortSignal.timeout(8000) }); }
  catch { throw new WhopError('WHOP_PRODUCTION_UNAVAILABLE'); }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new ProductionProviderRejection('WHOP_PRODUCTION_ACCESS_DENIED',path,version,response.status,'access');
    if (response.status === 404) throw new ProductionProviderRejection('WHOP_PRODUCTION_RESOURCE_NOT_FOUND',path,version,404,'resource_not_found');
    if (response.status === 429) throw new WhopError('WHOP_PRODUCTION_RATE_LIMITED');
    if (response.status === 400 || response.status === 422) {
      let classification={reason:'unclassified',field:null as string|null};
      try {classification=classifyProductionRejection(JSON.parse(await boundedProviderText(response.body)));}catch{/* Never echo an invalid rejection body. */}
      throw new ProductionProviderRejection('WHOP_PRODUCTION_REQUEST_REJECTED',path,version,response.status,classification.reason,classification.field);
    }
    throw new WhopError('WHOP_PRODUCTION_UNAVAILABLE');
  }
  observe?.(response);
  try {
    const data: unknown = JSON.parse(await boundedProviderText(response.body));
    if (!object(data)) throw new Error();
    return data;
  } catch { throw new WhopError('INVALID_PRODUCTION_PROVIDER_RESPONSE'); }
}
const provider = productionProvider;
/** GET only: discover the product from the verified plan, without requesting broad catalogue access or logging the raw response. */
export async function inspectProductionPlan(config: ProductionPlanExpectation, transport: typeof fetch = fetch,
  observe?: (evidence:PlanEvidence)=>void): Promise<ProductionPlan> {
  let providerDate:string|null=null, cacheAgeSeconds:number|null=null;
  const plan = await provider('/plans/' + encodeURIComponent(config.plan), config, transport, {}, PLAN_VERSION, response=>{
    const date = response.headers.get('date'), age = response.headers.get('age');
    if(date && Number.isFinite(Date.parse(date))) providerDate=new Date(date).toISOString();
    if(age && /^[0-9]{1,9}$/.test(age)) cacheAgeSeconds=Number(age);
  });
  const safeId=(value:unknown,prefix:string)=>typeof value==='string' && new RegExp('^'+prefix+'_[A-Za-z0-9]{5,80}$').test(value)?value:null;
  const productId=object(plan.product)?safeId(plan.product.id,'prod'):null;
  observe?.({apiVersion:PLAN_VERSION,resource:'plans',checkedAt:new Date().toISOString(),providerDate,cacheAgeSeconds,
    expected:{companyId:config.company,planId:config.plan,productId:config.product??null},
    observed:{companyId:object(plan.account)?safeId(plan.account.id,'biz'):null,planId:safeId(plan.id,'plan'),productId},
    productBinding:config.product?(productId===config.product?'matched':'mismatched'):'not_configured',quoteChecked:false});
  const checks: Record<string, boolean> = {
    plan: plan.id === config.plan,
    company: object(plan.account) && plan.account.id === config.company,
    product: productId!==null && (config.product===undefined || productId===config.product),
    billing: plan.plan_type === 'one_time', currency: plan.currency === config.currency,
    price: money(plan.initial_price) === config.amount, renewal: money(plan.renewal_price) === 0,
    conversion: plan.adaptive_pricing_enabled === false, tax: typeof plan.collect_tax === 'boolean'
      && (!plan.collect_tax || plan.tax_type === 'inclusive'),
  };
  const mismatches = Object.keys(checks).filter(field => !checks[field]);
  if (mismatches.length) {
    const flag = (value: unknown) => value === true ? 'enabled' : value === false ? 'disabled' : value === undefined ? 'missing' : 'invalid';
    throw new ProductionPlanMismatch(mismatches, { conversion: flag(plan.adaptive_pricing_enabled), taxCollection: flag(plan.collect_tax),
      taxType: ['inclusive','exclusive','unspecified'].includes(String(plan.tax_type)) ? String(plan.tax_type) : plan.tax_type === undefined ? 'missing' : 'invalid' });
  }
  // The product shape has been checked above; expose only its validated identifier.
  const product = plan.product as { id: string };
  return { companyId: config.company, productId: product.id, planId: config.plan, currency: config.currency, amountMinor: config.amount };
}
export function productionOrderMatches(order: ProductionOrder, config: ProductionConfig, historicalPayment = false): boolean {
  const promo=order.promotion;
  const promoted=!!promo && /^promo_[A-Za-z0-9]{5,80}$/.test(promo.id) && /^[a-z0-9_-]{3,40}$/.test(promo.code)
    && promo.baseAmountMinor===config.amount && Number.isInteger(promo.percent)&&promo.percent>=1&&promo.percent<=99
    && Number.isSafeInteger(promo.discountMinor)&&promo.discountMinor>0&&promo.baseAmountMinor*promo.percent===promo.discountMinor*100
    && order.amountMinor===promo.baseAmountMinor-promo.discountMinor;
  const amountMatches = (promo ? promoted : order.amountMinor === config.amount) || (historicalPayment && [1800,2000].includes(config.amount) && order.amountMinor === 300);
  return uuid.test(order.orderId) && uuid.test(order.hostId) && (config.audience === 'public' || order.hostId === config.pilotHostId) && order.environment === 'production'
    && order.companyId === config.company && order.productId === config.product && order.planId === config.plan
    && order.currency === config.currency && amountMatches && (order.locale === 'ar' || order.locale === 'en');
}
export function assertProductionCheckoutUrl(checkoutId: string, value: string, expectedPlanId?: string): void {
  let url: URL; try { url = new URL(value); } catch { throw new WhopError('INVALID_PRODUCTION_CHECKOUT_URL'); }
  const validSession = /^ch_[A-Za-z0-9]{5,80}$/.test(checkoutId);
  const legacy = [('/checkout/' + checkoutId), ('/checkout/' + checkoutId + '/')].includes(url.pathname) && !url.search;
  // Whop's official purchase_url is /checkout/plan_<id>?session=ch_<id>.
  // Never accept an unbound direct plan checkout or arbitrary redirect/query parameters.
  const plan = url.pathname.match(/^\/checkout\/(plan_[A-Za-z0-9]{5,80})\/?$/);
  const boundSession = !!plan && (!expectedPlanId || plan[1] === expectedPlanId)
    && url.searchParams.size === 1 && url.searchParams.get('session') === checkoutId;
  if (!validSession || url.origin !== 'https://whop.com' || url.username || url.password || url.hash || !(legacy || boundSession))
    throw new WhopError('INVALID_PRODUCTION_CHECKOUT_URL');
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
    || !object(checkout.plan) || checkout.plan.id !== config.plan || (checkout.plan.currency != null && checkout.plan.currency !== config.currency)
    || (checkout.currency != null && checkout.currency !== config.currency) || checkout.mode !== 'payment' || !object(checkout.metadata)
    || checkout.metadata.bud_order_id !== order.orderId || checkout.metadata.bud_environment !== 'production') throw new WhopError('PRODUCTION_CHECKOUT_MISMATCH');
  assertProductionCheckoutUrl(checkout.id, checkout.purchase_url, config.plan);
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
  if (!productionOrderMatches(order, config, true) || !order.checkoutId || !order.checkoutUrl) throw new WhopError('PRODUCTION_PAYMENT_MISMATCH', 409);
  assertProductionCheckoutUrl(order.checkoutId, order.checkoutUrl);
  if(order.promotion){
    const promoId=typeof payment.promo_code_id==='string'?payment.promo_code_id:object(payment.promo_code)?payment.promo_code.id:null;
    if(promoId!==order.promotion.id||money(payment.subtotal)!==order.promotion.baseAmountMinor)throw new WhopError('PRODUCTION_PAYMENT_MISMATCH',409);
  }
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
