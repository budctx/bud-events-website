import { createHash, timingSafeEqual } from 'node:crypto';
import { liveBackend, liveResponse, liveRpc, runProductionPaymentJob } from './live-commerce.ts';
import { assertProductionPaymentIdentity, assertProductionPaymentMatches, lookupProductionPayment, productionOrderMatches, productionPaymentCondition, productionProvider, whopProductionProcessingConfig } from './whop-production.ts';
import type { ProductionOrder } from './whop-production.ts';
import { WhopError } from './whop.ts';
import type { CommerceEnv } from './whop.ts';
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const environment = (): CommerceEnv => (globalThis as unknown as { process?: { env?: CommerceEnv } }).process?.env ?? {};

export async function reconcileProductionPayment(env: CommerceEnv, transport: typeof fetch = fetch) {
  const secret = liveBackend(env), config = whopProductionProcessingConfig(env);
  if (!secret || !config) throw new WhopError('RECONCILIATION_NOT_CONFIGURED');
  const jobs = await liveRpc('bud_live_claim_reconciliation', {}, secret, transport);
  if (!Array.isArray(jobs) || jobs.length > 1) throw new WhopError('RECONCILIATION_UNCONFIRMED');
  if (!jobs.length) return { processed: 0, attention: false };
  const job: unknown = jobs[0];
  if (!object(job) || typeof job.orderId !== 'string' || !uuid.test(job.orderId) || typeof job.leaseToken !== 'string' || !uuid.test(job.leaseToken)
    || typeof job.paymentId !== 'string' || !/^pay_[A-Za-z0-9]{5,80}$/.test(job.paymentId)) throw new WhopError('RECONCILIATION_UNCONFIRMED');
  let state: 'clear' | 'review' | 'refunded' | 'disputed' | 'unavailable';
  try {
    const lookup = await lookupProductionPayment(job.paymentId, config, transport);
    if (lookup.orderId !== job.orderId) throw new WhopError('RECONCILIATION_BINDING_MISMATCH', 409);
    const stored = await liveRpc('bud_live_order', { p_order: job.orderId }, secret, transport);
    if (!object(stored) || stored.orderId !== job.orderId || stored.fulfilled !== true) throw new WhopError('RECONCILIATION_BINDING_MISMATCH', 409);
    assertProductionPaymentIdentity(lookup.payment, stored as ProductionOrder, config);
    state = productionPaymentCondition(lookup.payment);
  } catch (error) { state = error instanceof WhopError && error.status === 409 ? 'review' : 'unavailable'; }
  const receipt = await liveRpc('bud_live_record_reconciliation', { p_order: job.orderId, p_lease: job.leaseToken, p_state: state }, secret, transport);
  if (!object(receipt) || receipt.recorded !== true) throw new WhopError('RECONCILIATION_UNCONFIRMED');
  return { processed: 1, attention: state !== 'clear' };
}


/**
 * Read-only diagnosis for an exhausted payment. This never claims a lease,
 * restarts a job, creates an order, grants credit or returns provider data.
 * Only fixed field names are returned to the authenticated cron caller.
 */
export async function diagnoseReviewedPayment(env: CommerceEnv, transport: typeof fetch = fetch) {
  const secret = liveBackend(env), config = whopProductionProcessingConfig(env);
  if (!secret || !config) throw new WhopError('DIAGNOSIS_NOT_CONFIGURED');
  const candidate = await liveRpc('bud_live_review_candidate', {}, secret, transport);
  if (candidate === null) return { stage: 'no_review', fields: [] as string[] };
  if (!object(candidate) || typeof candidate.paymentId !== 'string' || !/^pay_[A-Za-z0-9]{5,80}$/.test(candidate.paymentId))
    throw new WhopError('DIAGNOSIS_UNCONFIRMED');
  let stage = 'provider_read';
  try {
    const payment = await productionProvider('/payments/' + encodeURIComponent(candidate.paymentId), config, transport);
    if (payment.id !== candidate.paymentId) return { stage: 'provider_identity', fields: ['payment_id'] };
    const metadata = object(payment.metadata) ? payment.metadata : null;
    const orderId = metadata?.bud_order_id;
    if (typeof orderId !== 'string' || !uuid.test(orderId) || metadata?.bud_environment !== 'production') {
      const fields: string[] = [];
      if (typeof orderId !== 'string' || !uuid.test(orderId)) fields.push('order_metadata');
      if (metadata?.bud_environment !== 'production') fields.push('environment_metadata');
      return { stage: 'provider_metadata', fields };
    }
    stage = 'server_order';
    const stored = await liveRpc('bud_live_order', { p_order: orderId }, secret, transport);
    if (!object(stored) || !productionOrderMatches(stored as ProductionOrder, config)
      || stored.orderId !== orderId || stored.fulfilled !== false
      || typeof stored.checkoutId !== 'string' || typeof stored.checkoutUrl !== 'string')
      return { stage: 'server_order', fields: ['order_contract'] };
    stage = 'payment_contract';
    const fields: string[] = [];
    const check = (name: string, passes: boolean) => { if (!passes) fields.push(name); };
    check('checkout', payment.checkout_configuration_id === stored.checkoutId);
    check('company', object(payment.company) && payment.company.id === stored.companyId);
    check('product', object(payment.product) && payment.product.id === stored.productId);
    check('plan', object(payment.plan) && payment.plan.id === stored.planId);
    check('currency', payment.currency === stored.currency);
    check('amount', typeof payment.total === 'number' && Number.isFinite(payment.total)
      && /^\d{1,7}(?:\.\d{1,2})?$/.test(String(payment.total)) && Math.round(payment.total * 100) === stored.amountMinor);
    check('status', payment.status === 'paid');
    check('substatus', payment.substatus === 'succeeded');
    check('paid_at', typeof payment.paid_at === 'string' && Number.isFinite(Date.parse(payment.paid_at)));
    check('refund_amount', payment.refunded_amount === 0);
    check('auto_refund', payment.auto_refunded === false);
    check('refunded_at', payment.refunded_at === null);
    if (!Array.isArray(payment.disputes)) fields.push(payment.disputes === null ? 'disputes_null' :
      payment.disputes === undefined ? 'disputes_absent' : 'disputes_format');
    else check('disputes_nonempty', payment.disputes.length === 0);
    try { assertProductionPaymentMatches(payment, stored as ProductionOrder, config); }
    catch { if (fields.length === 0) fields.push('additional_contract'); }
    // A second strictly read-only GET tests whether the explicitly supported newer
    // Whop API pin supplies authoritative dispute data that the legacy pin omitted.
    // Never use the diagnostic response to fulfill or restart the payment.
    let alternateDisputes: 'clear' | 'active' | 'missing' | 'identity_mismatch' | 'unavailable' | undefined;
    if (fields.some(field => ['disputes_null','disputes_absent','disputes_format'].includes(field))) {
      try {
        const newer = await productionProvider('/payments/' + encodeURIComponent(candidate.paymentId), config, transport, {}, '2026-10-15-1');
        if (newer.id !== candidate.paymentId || !object(newer.metadata) || newer.metadata.bud_order_id !== orderId
          || newer.metadata.bud_environment !== 'production') alternateDisputes = 'identity_mismatch';
        else if (!Array.isArray(newer.disputes)) alternateDisputes = 'missing';
        else alternateDisputes = newer.disputes.length === 0 ? 'clear' : 'active';
      } catch { alternateDisputes = 'unavailable'; }
    }
    // Whop may omit a disputes array in payment GET. Test its separate dispute
    // listing API using a bounded, payment-date-scoped, read-only complete scan.
    let disputeList: 'clear' | 'active' | 'incomplete' | 'unavailable' | undefined;
    if (fields.some(field => ['disputes_null','disputes_absent','disputes_format'].includes(field))) {
      try {
        const when = typeof payment.created_at === 'string' && Number.isFinite(Date.parse(payment.created_at))
          ? payment.created_at : payment.paid_at;
        if (typeof when !== 'string' || !Number.isFinite(Date.parse(when))) throw new Error();
        const start = new Date(Date.parse(when) - 86_400_000).toISOString();
        let after: string | null = null;
        for (let page = 0; page < 5; page++) {
          const query = new URLSearchParams({ account_id: config.company, first: '50', created_after: start });
          if (after) query.set('after', after);
          const listing = await productionProvider('/disputes?' + query.toString(), config, transport);
          if (!Array.isArray(listing.data) || !object(listing.page_info)
            || typeof listing.page_info.has_next_page !== 'boolean') throw new Error();
          for (const item of listing.data) {
            if (!object(item) || !object(item.payment) || !object(item.company)
              || item.company.id !== config.company || typeof item.payment.id !== 'string') throw new Error();
            if (item.payment.id === candidate.paymentId) disputeList = 'active';
          }
          if (disputeList === 'active') break;
          if (!listing.page_info.has_next_page) { disputeList = 'clear'; break; }
          if (typeof listing.page_info.end_cursor !== 'string' || !listing.page_info.end_cursor
            || listing.page_info.end_cursor === after) throw new Error();
          after = listing.page_info.end_cursor;
        }
        disputeList ??= 'incomplete';
      } catch { disputeList = 'unavailable'; }
    }
    return { stage: fields.length ? 'payment_contract' : 'verified_unfulfilled', fields,
      ...(alternateDisputes ? { alternateDisputes } : {}), ...(disputeList ? { disputeList } : {}) };
  } catch {
    // A provider/network/backend error is not proof that a paid invoice is invalid.
    return { stage, fields: ['unavailable'] };
  }
}

function authorized(request: Request, secret: string | undefined) {
  const header = request.headers.get('authorization') ?? '';
  if (!secret || !/^[A-Za-z0-9_-]{32,128}$/.test(secret) || header.length > 256) return false;
  const hash = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(header), hash('Bearer ' + secret));
}
/** Scheduled/manual server-to-server endpoint; never uses browser session cookies or query-string credentials. */
export async function handlePaymentWorker(request: Request, env: CommerceEnv = environment(), transport: typeof fetch = fetch,
  task: 'payments' | 'reconcile' = 'payments'): Promise<Response> {
  if (request.method !== 'GET') return liveResponse(405, 'METHOD_NOT_ALLOWED');
  if (!authorized(request, env.CRON_SECRET)) return liveResponse(401, 'WORKER_AUTH_REQUIRED');
  if (env.BUD_PAYMENT_WORKER_ENABLED !== 'true') return liveResponse(200, 'WORKER_DISABLED', { active: false });
  const secret = liveBackend(env);
  if (!secret || !whopProductionProcessingConfig(env) || env.VERCEL_ENV !== 'production') return liveResponse(503, 'WORKER_NOT_CONFIGURED');
  const url = new URL(request.url);
  if (url.origin !== env.BUD_APP_ORIGIN || [...url.searchParams.keys()].some(key => key !== 'health' && key !== 'diagnose') || request.body !== null)
    return liveResponse(400, 'INVALID_WORKER_REQUEST');
  try {
    if (url.search === '?diagnose=1' && task === 'payments') {
      const diagnosis = await diagnoseReviewedPayment(env, transport);
      return liveResponse(200, 'PAYMENT_DIAGNOSIS', diagnosis);
    }
    if (url.search) {
      if (url.search !== '?health=1') return liveResponse(400, 'INVALID_WORKER_REQUEST');
      const health = await liveRpc('bud_live_operations_health', {}, secret, transport);
      if (!object(health) || !object(health.queue) || !Number.isSafeInteger(health.reconciliationReview) || typeof health.queue.review !== 'number'
        || !Array.isArray(health.workers) || health.workers.length !== 2) throw new WhopError('WORKER_HEALTH_UNCONFIRMED');
      const workers = health.workers.map((value: unknown) => {
        if (!object(value) || !['payments','reconcile'].includes(String(value.task)) || !['never','running','ok','attention','failed'].includes(String(value.status))
          || !(value.lastSuccessAt === null || (typeof value.lastSuccessAt === 'string' && Number.isFinite(Date.parse(value.lastSuccessAt))))) throw new Error();
        return { task: String(value.task), status: String(value.status), lastSuccessAt: value.lastSuccessAt as string | null };
      });
      if (new Set(workers.map(worker => worker.task)).size !== 2) throw new Error();
      const stale = workers.some(worker => worker.lastSuccessAt === null || Date.now() - Date.parse(worker.lastSuccessAt) > 5 * 60_000);
      const oldPending = typeof health.queue.oldestPendingAt === 'string' && Date.now() - Date.parse(health.queue.oldestPendingAt) > 10 * 60_000;
      const attention = stale || oldPending || health.queue.review > 0 || Number(health.reconciliationReview) > 0
        || Number(health.reconciliationStale) > 0 || workers.some(worker => worker.status === 'failed' || worker.status === 'attention');
      const counts: Record<string, number> = {};
      for (const name of ['pending','processing','done','review']) {
        const value = health.queue[name]; if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(); counts[name] = Number(value);
      }
      if (!Number.isSafeInteger(health.due) || !Number.isSafeInteger(health.reconciliationStale)) throw new Error();
      return liveResponse(attention ? 503 : 200, attention ? 'WORKER_ATTENTION' : 'OK', { queue: counts, due: health.due,
        reconciliationReview: health.reconciliationReview, reconciliationStale: health.reconciliationStale,
        workers, stale, attention });
    }
    const begin = await liveRpc('bud_live_worker_heartbeat', { p_task: task, p_status: 'running' }, secret, transport);
    if (!object(begin) || begin.recorded !== true) throw new WhopError('WORKER_HEARTBEAT_UNCONFIRMED');
    const outcome = task === 'payments' ? await runProductionPaymentJob(env, transport) : await reconcileProductionPayment(env, transport);
    const attention = 'unconfirmed' in outcome ? outcome.unconfirmed > 0 || outcome.retryRecorded > 0 : outcome.attention;
    const end = await liveRpc('bud_live_worker_heartbeat', { p_task: task, p_status: attention ? 'attention' : 'ok' }, secret, transport);
    if (!object(end) || end.recorded !== true) throw new WhopError('WORKER_HEARTBEAT_UNCONFIRMED');
    if (attention) console.warn(JSON.stringify({ event: 'bud_payment_worker_attention', task, ...outcome }));
    return liveResponse(200, attention ? 'WORKER_ATTENTION' : 'OK', { ...outcome, attention });
  } catch {
    console.error(JSON.stringify({ event: 'bud_payment_worker_failed', task }));
    return liveResponse(503, 'WORKER_UNAVAILABLE');
  }
}
