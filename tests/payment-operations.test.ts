import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { handleAuth } from '../server/auth.ts';
import { handlePaymentStatus } from '../server/payment-status.ts';
import { handlePaymentWorker } from '../server/payment-operations.ts';
import { handleLiveHost } from '../server/host.ts';
import { productionPaymentCondition } from '../server/whop-production.ts';

test('payment operations: protected worker, own receipts, authoritative refund hold and lease fencing use real SQL', async t => {
  const db = new PGlite(), host = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
  const origin = 'https://bud-events-website.vercel.app', edge = { 'x-vercel-forwarded-for': '192.0.2.10' };
  const env = { BUD_APP_ORIGIN: origin, BUD_AUTH_ENABLED: 'true', BUD_BACKEND_ENABLED: 'true', BUD_RATE_LIMIT_ENABLED: 'true',
    BUD_RATE_LIMIT_SECRET: 'fixture-only-rate-secret-at-least-32-bytes', BUD_AUTH_COOKIE_SECRET: 'fixture-only-cookie-secret-at-least-32-bytes', VERCEL: '1', VERCEL_ENV: 'production',
    SUPABASE_URL: 'https://cepmvqqrjcvhyzszqand.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'fixture-public', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
    WHOP_ENVIRONMENT: 'production', BUD_WHOP_PRODUCTION_MODE: 'pilot', BUD_WHOP_PRODUCTION_PROCESSING_ENABLED: 'true', BUD_WHOP_PRODUCTION_ENABLED: 'false',
    WHOP_PRODUCTION_API_KEY: 'fixture-provider-key', WHOP_PRODUCTION_WEBHOOK_SECRET: 'ws_0123456789abcdef0123456789abcdef0123456789abcdef',
    WHOP_PRODUCTION_COMPANY_ID: 'biz_fixture123', WHOP_PRODUCTION_PRODUCT_ID: 'prod_fixture123', WHOP_PRODUCTION_PLAN_ID: 'plan_fixture123',
    WHOP_PRODUCTION_CURRENCY: 'sar', WHOP_PRODUCTION_AMOUNT_MINOR: '200', WHOP_PRODUCTION_WEBHOOK_API_VERSION: '2026-10-15-1', BUD_WHOP_PILOT_HOST_ID: host,
    BUD_PAYMENT_WORKER_ENABLED: 'true', BUD_LIVE_RECEIPTS_ENABLED: 'true', BUD_LIVE_HOST_ENABLED: 'true', CRON_SECRET: 'fixture-only-cron-secret-with-32-characters' };
  let cookie = '', orderId = '', providerCalls = 0, refunded = false, unavailable = false;
  const value = async (name: string, params: Record<string, unknown>) => {
    const entries = Object.entries(params);
    return (await db.query<{ result: any }>(`select public.${name}(${entries.map(([key], i) => key + ' => $' + (i + 1)).join(',')}) as result`, entries.map(([, v]) => v))).rows[0].result;
  };
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ id: host, identities: [{ provider: 'discord' }] });
    if (url.pathname.endsWith('/auth/v1/token')) return Response.json({ access_token: 'fixture-access-token-long-enough', refresh_token: 'fixture-refresh-token-long-enough', expires_in: 3600 });
    if (url.pathname.includes('/rest/v1/rpc/')) {
      const name = url.pathname.split('/').at(-1)!; assert.match(name, /^bud_[a-z_]+$/);
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY);
      try { return Response.json(await value(name, JSON.parse(String(init?.body)))); }
      catch (error) { return Response.json({ message: (error as Error).message }, { status: 400 }); }
    }
    assert.equal(url.origin, 'https://api.whop.com'); assert.equal(init?.method ?? 'GET', 'GET'); providerCalls++;
    if (unavailable) return new Response('fixture-provider-secret', { status: 503 });
    assert.equal(url.pathname, '/api/v1/payments/pay_operations123');
    return Response.json({ id: 'pay_operations123', company: { id: env.WHOP_PRODUCTION_COMPANY_ID }, product: { id: env.WHOP_PRODUCTION_PRODUCT_ID },
      plan: { id: env.WHOP_PRODUCTION_PLAN_ID }, metadata: { bud_order_id: orderId, bud_environment: 'production' }, total: 2, currency: 'sar',
      checkout_configuration_id: 'ch_operations123', status: refunded ? 'refunded' : 'paid', substatus: 'succeeded', paid_at: '2026-10-23T10:00:00Z',
      refunded_amount: refunded ? 2 : 0, refunded_at: refunded ? '2026-10-23T11:00:00Z' : null, auto_refunded: false, disputes: [], customer_email: 'must-not-leak@example.test' });
  };
  const workerRequest = (query = '') => new Request(origin + '/api/payment-worker' + query, { headers: { authorization: 'Bearer ' + env.CRON_SECRET } });
  const receiptRequest = (id = orderId) => new Request(origin + '/api/payment-status', { method: 'POST', headers: { origin, ...edge, cookie, 'content-type': 'application/json' }, body: JSON.stringify({ orderId: id }) });
  const status = () => handlePaymentStatus(receiptRequest(), env, transport);
  const reconcile = () => handlePaymentWorker(workerRequest(), env, transport, 'reconcile');
  const due = async () => { await db.exec("reset role;update bud_platform.live_reconciliation set next_check_at=clock_timestamp()-interval '1 second';set role service_role"); };
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${host}'),('${other}');`);
    for (const migration of ['20261022215208_host_persistence_foundation.sql','20261023083912_launch_sandbox_hardening.sql','20261023173930_production_commerce_foundation.sql','20261023193330_live_payment_queue_and_event_consumption.sql','20261023202259_live_payment_operations_and_receipts.sql','20261025093000_question_condition_activity_draw.sql','20261025093001_question_condition_live_draw.sql'])
      await db.exec(await readFile(new URL('../supabase/migrations/' + migration, import.meta.url), 'utf8'));
    await db.exec("update bud_platform.live_commerce_control set enabled=true,fulfillment_enabled=true,host_enabled=true;update bud_platform.content_versions set eligible_pairs='[[\"0\",\"0\"],[\"1\",\"1\"]]'::jsonb,status='published';update bud_platform.products set status='published';set role service_role");
    const begin = await handleAuth(new Request(origin + '/api/auth?action=signin', { method: 'POST', headers: { origin, ...edge } }), env, transport);
    const callback = new URL(new URL((await begin.json()).data.url).searchParams.get('redirect_to')!); callback.searchParams.set('code', 'fixture-code');
    const signedIn = await handleAuth(new Request(callback, { headers: { ...edge, cookie: begin.headers.getSetCookie()[0].split(';')[0] } }), env, transport);
    cookie = signedIn.headers.getSetCookie().find(v => v.startsWith('__Host-bud-session='))!.split(';')[0];
    const order = await value('bud_live_create_order', { p_host: host, p_key: 'fixture-operations-order-key', p_company: env.WHOP_PRODUCTION_COMPANY_ID, p_product: env.WHOP_PRODUCTION_PRODUCT_ID,
      p_plan: env.WHOP_PRODUCTION_PLAN_ID, p_currency: 'sar', p_amount: 200, p_locale: 'ar' }); orderId = order.orderId;
    await value('bud_live_attach_checkout', { p_host: host, p_order: orderId, p_checkout: 'ch_operations123', p_url: 'https://whop.com/checkout/ch_operations123/' });
    await t.test('no header/query token/browser cookie can invoke the disabled or unauthorized worker', async () => {
      const noNetwork: typeof fetch = async () => { throw Error('unexpected fetch'); };
      assert.equal((await handlePaymentWorker(new Request(origin + '/api/payment-worker?token=' + env.CRON_SECRET), env, noNetwork)).status, 401);
      assert.equal((await handlePaymentWorker(new Request(origin + '/api/payment-worker', { headers: { cookie } }), env, noNetwork)).status, 401);
      assert.equal((await handlePaymentWorker(workerRequest(), { ...env, BUD_PAYMENT_WORKER_ENABLED: 'false' }, noNetwork)).status, 200);
      assert.equal((await handlePaymentWorker(workerRequest(), { ...env, VERCEL_ENV: 'preview' }, noNetwork)).status, 503);
      assert.equal((await handlePaymentWorker(new Request(origin + '/api/payment-worker', { method: 'POST' }), env, noNetwork)).status, 405);
    });
    await t.test('pending comes from a scoped SQL order; missing/foreign orders never leak', async () => {
      assert.equal((await (await status()).json()).data.state, 'pending');
      assert.equal((await handlePaymentStatus(receiptRequest(other), env, transport)).status, 404);
      const foreign = await value('bud_live_create_order', { p_host: other, p_key: 'fixture-foreign-operations-key', p_company: env.WHOP_PRODUCTION_COMPANY_ID, p_product: env.WHOP_PRODUCTION_PRODUCT_ID,
        p_plan: env.WHOP_PRODUCTION_PLAN_ID, p_currency: 'sar', p_amount: 200, p_locale: 'ar' });
      assert.equal((await handlePaymentStatus(receiptRequest(foreign.orderId), env, transport)).status, 404);
      assert.equal((await handlePaymentStatus(receiptRequest(), { ...env, BUD_WHOP_PILOT_HOST_ID: other }, transport)).status, 403);
    });
    await t.test('authorized worker grants once, heartbeat and sanitized health show progress', async () => {
      await value('bud_live_enqueue_payment', { p_message: 'msg_operations123', p_payment: 'pay_operations123' });
      assert.equal((await handlePaymentWorker(workerRequest(), env, transport)).status, 200);
      assert.equal((await (await status()).json()).data.state, 'confirmed');
      const health = await handlePaymentWorker(workerRequest('?health=1'), env, transport); assert.equal(health.status, 503);
      const data = await health.json(); assert.equal(data.data.queue.done, 1); assert.equal(data.data.stale, true);
      assert.doesNotMatch(JSON.stringify(data), /fixture-service|customer_email|pay_operations|leaseToken/);
    });
    await t.test('reconciliation checks only GET and stores no raw customer/provider data', async () => {
      const result = await reconcile(); assert.equal(result.status, 200);
      assert.equal((await db.query<{ state: string }>('select state from bud_platform.live_reconciliation')).rows[0].state, 'clear');
      assert.equal((await handlePaymentWorker(workerRequest('?health=1'), env, transport)).status, 200);
      await due(); unavailable = true; const unavailableResult = await reconcile(); unavailable = false;
      assert.equal((await unavailableResult.json()).data.attention, true);
      assert.equal((await (await status()).json()).data.state, 'confirmed');
      assert.ok(providerCalls >= 3);
    });
    await t.test('authoritative refund is visible, blocks NEW starts and preserves credits for manual review', async () => {
      await due(); refunded = true; assert.equal((await reconcile()).status, 200);
      const response = await status(); assert.equal((await response.json()).data.state, 'refunded');
      const blocked = await handleLiveHost(new Request(origin + '/api/host', { method: 'POST', headers: { origin, ...edge, cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start', idempotencyKey: 'fixture-held-start-request', title: 'Fixture', config: { duration: 5, timerEnabled: false, attempts: 1 }, prizeText: '' }) }), env, transport);
      assert.equal(blocked.status, 409); assert.equal((await blocked.json()).code, 'PAYMENT_UNDER_REVIEW');
      assert.equal((await value('bud_live_balance', { p_host: host })).credits, 1);
      assert.equal((await db.query<{ n: number }>('select count(*)::int n from bud_platform.live_event_debits')).rows[0].n, 0);
      const health = await handlePaymentWorker(workerRequest('?health=1'), env, transport); assert.equal(health.status, 503);
      await due(); refunded = false; await reconcile();
      // No automatic release of a historic financial hold even if a later read looks clear.
      assert.equal((await (await status()).json()).data.state, 'refunded');
    });
    await t.test('missing/null/stale reconciliation lease cannot record any financial condition', async () => {
      await assert.rejects(value('bud_live_record_reconciliation', { p_order: orderId, p_lease: null, p_state: 'clear' }), /BUD_LIVE_LEASE_LOST/);
      await due(); const claim = (await value('bud_live_claim_reconciliation', {}))[0];
      await assert.rejects(value('bud_live_record_reconciliation', { p_order: orderId, p_lease: other, p_state: 'clear' }), /BUD_LIVE_LEASE_LOST/);
      await db.exec("reset role;update bud_platform.live_reconciliation set lease_until=clock_timestamp()-interval '1 second';set role service_role");
      await assert.rejects(value('bud_live_record_reconciliation', { p_order: orderId, p_lease: claim.leaseToken, p_state: 'clear' }), /BUD_LIVE_LEASE_LOST/);
      for (const role of ['anon','authenticated']) {
        await db.exec('reset role;set role ' + role);
        await assert.rejects(value('bud_live_payment_status', { p_host: host, p_order: orderId }), /permission denied/);
        await assert.rejects(value('bud_live_operations_health', {}), /permission denied/);
      }
    });
  } finally { await db.close(); }
});

test('payment condition never treats missing/partial/refunded/disputed fields as a confirmed key', () => {
  const clear = { status:'paid', substatus:'succeeded', paid_at:'2026-10-23T10:00:00Z', total:2, refunded_amount:0, refunded_at:null, auto_refunded:false, disputes:[] };
  assert.equal(productionPaymentCondition(clear), 'clear');
  assert.equal(productionPaymentCondition({ ...clear, refunded_amount:2 }), 'refunded');
  assert.equal(productionPaymentCondition({ ...clear, refunded_amount:0.5 }), 'review');
  assert.equal(productionPaymentCondition({ ...clear, disputes:[{ id:'fixture' }] }), 'disputed');
  for (const change of [{ disputes:undefined }, { refunded_amount:undefined }, { total:0 }, { refunded_at:undefined }, { status:'pending' }])
    assert.equal(productionPaymentCondition({ ...clear, ...change }), 'review');
});
