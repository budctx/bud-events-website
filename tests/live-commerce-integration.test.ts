import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { handleAuth } from '../server/auth.ts';
import { handleProductionCheckout, handleProductionWebhook, runProductionPaymentJob } from '../server/live-commerce.ts';
import { handleHost, handleLiveHost } from '../server/host.ts';
import { handleCheckoutRoute, handleHostRoute, handleWebhookRoute } from '../server/commerce-routing.ts';
import { handlePaymentStatus } from '../server/payment-status.ts';

const origin = 'https://bud-events-website.vercel.app', host = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const edge = { 'x-vercel-forwarded-for': '192.0.2.1' };
const env = { VERCEL: '1', BUD_AUTH_ENABLED: 'true', BUD_BACKEND_ENABLED: 'true', BUD_RATE_LIMIT_ENABLED: 'true',
  BUD_RATE_LIMIT_SECRET: 'fixture-rate-secret-with-at-least-32-bytes', BUD_AUTH_COOKIE_SECRET: 'fixture-cookie-secret-with-at-least-32-bytes',
  BUD_APP_ORIGIN: origin, BUD_LIVE_HOST_ENABLED: 'true', BUD_WHOP_PRODUCTION_PROCESSING_ENABLED: 'true', SUPABASE_URL: 'https://cepmvqqrjcvhyzszqand.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'fixture-public',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', BUD_WHOP_PRODUCTION_ENABLED: 'true', BUD_WHOP_PRODUCTION_MODE: 'pilot', WHOP_ENVIRONMENT: 'production',
  BUD_WHOP_PILOT_HOST_ID: host, WHOP_PRODUCTION_API_KEY: 'fixture-production-key', WHOP_PRODUCTION_COMPANY_ID: 'biz_fixture123',
  WHOP_PRODUCTION_PLAN_ID: 'plan_fixture123', WHOP_PRODUCTION_PRODUCT_ID: 'prod_fixture123', WHOP_PRODUCTION_CURRENCY: 'sar',
  WHOP_PRODUCTION_AMOUNT_MINOR: '200', WHOP_PRODUCTION_WEBHOOK_SECRET: 'ws_' + 'x'.repeat(48),
  WHOP_PRODUCTION_WEBHOOK_API_VERSION: '2026-10-15-1' };

test('isolated production orchestration: real SQL, authenticated pilot, durable checkout, signed authoritative payment and crash recovery', async t => {
  const db = new PGlite();
  let cookie = '', orderId = '', checkoutPosts = 0, providerCalls = 0, authHost = host;
  let attachFailure: 'before' | 'after' | null = null, creditFailure: 'before' | 'after' | null = null;
  let total = 2, paymentId = 'pay_fixture123', refund = 0, badReceipt = false;
  let currentCheckoutId = 'ch_fixture123';
  let loseHostResponse = false, queueFailure: 'before' | 'after' | null = null;
  const providerKeys: string[] = [];
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/user')) return Response.json({ id: authHost, identities: [{ provider: 'discord' }] });
    if (url.pathname.includes('/auth/v1/token')) return Response.json({ access_token: 'fixture-access-token-long-enough', refresh_token: 'fixture-refresh-token-long-enough', expires_in: 3600 });
    if (url.pathname.includes('/rest/v1/rpc/')) {
      assert.equal(url.origin, env.SUPABASE_URL);
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY);
      const name = url.pathname.split('/').at(-1)!;
      assert.match(name, /^bud_[a-z_]+$/);
      const isAttach = name === 'bud_live_attach_checkout', isCredit = name === 'bud_live_finish_payment', isQueue = name === 'bud_live_enqueue_payment';
      if ((isAttach && attachFailure === 'before') || (isCredit && creditFailure === 'before') || (isQueue && queueFailure === 'before')) {
        attachFailure = null; creditFailure = null; queueFailure = null; throw Error('fixture-lost-before-commit');
      }
      const entries = Object.entries(JSON.parse(String(init?.body)));
      try {
        const data = await db.query<{ result: unknown }>(`select public.${name}(${entries.map(([key], i) => {
          assert.match(key, /^p_[a-z_]+$/); return key + ' => $' + (i + 1);
        }).join(',')}) as result`, entries.map(([, value]) => value));
        if ((isAttach && attachFailure === 'after') || (isCredit && creditFailure === 'after') || (isQueue && queueFailure === 'after')
          || (name === 'bud_live_host_start_draw' && loseHostResponse)) {
          attachFailure = null; creditFailure = null; queueFailure = null; loseHostResponse = false; throw Error('fixture-lost-after-commit');
        }
        if (isCredit && badReceipt) return Response.json({ credited: true, replayed: true });
        return Response.json(data.rows[0].result);
      } catch (error) { return Response.json({ message: (error as Error).message }, { status: 400 }); }
    }
    assert.equal(url.origin, 'https://api.whop.com'); providerCalls++;
    assert.equal(new Headers(init?.headers).get('api-version-date'), url.pathname.includes('/plans/') ? '2026-10-15-1' : '2025-01-01');
    if (url.pathname.includes('/plans/')) return Response.json({ id: env.WHOP_PRODUCTION_PLAN_ID, company: { id: env.WHOP_PRODUCTION_COMPANY_ID },
      product: { id: env.WHOP_PRODUCTION_PRODUCT_ID }, plan_type: 'one_time', currency: 'sar', initial_price: 2, renewal_price: 0,
      adaptive_pricing_enabled: false, collect_tax: false });
    if (url.pathname.endsWith('/checkout_configurations')) {
      checkoutPosts++;
      const body = JSON.parse(String(init?.body)); orderId = body.metadata.bud_order_id;
      assert.deepEqual(body.metadata, { bud_order_id: orderId, bud_environment: 'production' });
      assert.equal(body.redirect_url, origin + '/?screen=events&lang=en&order=' + orderId);
      providerKeys.push(new Headers(init?.headers).get('idempotency-key')!);
      return Response.json({ id: currentCheckoutId, company_id: env.WHOP_PRODUCTION_COMPANY_ID, plan: { id: env.WHOP_PRODUCTION_PLAN_ID, currency: 'sar' },
        mode: 'payment', purchase_url: 'https://whop.com/checkout/'+currentCheckoutId+'/', metadata: body.metadata });
    }
    assert.equal(url.pathname, '/api/v1/payments/' + paymentId);
    return Response.json({ id: paymentId, status: 'paid', substatus: 'succeeded', paid_at: new Date().toISOString(),
      company: { id: env.WHOP_PRODUCTION_COMPANY_ID }, product: { id: env.WHOP_PRODUCTION_PRODUCT_ID }, plan: { id: env.WHOP_PRODUCTION_PLAN_ID },
      total, currency: 'sar', refunded_amount: refund, refunded_at: null, auto_refunded: false, disputes: [],
      checkout_configuration_id: currentCheckoutId, metadata: { bud_order_id: orderId, bud_environment: 'production' } });
  };
  const checkoutRequest = (body: unknown = { idempotencyKey: 'fixture-production-request-123', locale: 'en' }, extraHeaders = {}) =>
    new Request(origin + '/api/checkout', { method: 'POST', headers: { origin, ...edge, cookie, 'content-type': 'application/json', ...extraHeaders }, body: JSON.stringify(body) });
  const checkout = (body?: unknown) => handleProductionCheckout(checkoutRequest(body), env, transport);
  const webhook = async (messageId = 'msg_fixture123', changes = {}) => {
    const stamp = String(Math.floor(Date.now() / 1000));
    const raw = JSON.stringify({ id: messageId, api_version: 'v1', api_version_date: env.WHOP_PRODUCTION_WEBHOOK_API_VERSION,
      account_id: env.WHOP_PRODUCTION_COMPANY_ID, type: 'payment.succeeded', data: { id: paymentId }, ...changes });
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.WHOP_PRODUCTION_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(messageId + '.' + stamp + '.' + raw)));
    return new Request(origin + '/api/whop-webhook', { method: 'POST', headers: { ...edge, 'content-type': 'application/json',
      'webhook-id': messageId, 'webhook-timestamp': stamp, 'webhook-signature': 'v1,' + btoa(String.fromCharCode(...mac)) }, body: raw });
  };
  const deliver = async (messageId?: string, changes?: object) => handleProductionWebhook(await webhook(messageId, changes), env, transport);
  const resetLimits = async () => { await db.exec('reset role;delete from bud_platform.rate_limits;set role service_role'); };
  const due = async () => { await db.exec("reset role;update bud_platform.live_payment_jobs set available_at=clock_timestamp()-interval '1 second' where status='pending';set role service_role"); };
  const work = () => runProductionPaymentJob(env, transport);
  const hostAction = (body: unknown, live = true, changedEnv = env) => (live ? handleLiveHost : handleHost)(new Request(origin + '/api/host', {
    method: 'POST', headers: { origin, ...edge, cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) }), changedEnv, transport);
  const credits = async () => (await db.query<{ credits: number }>('select credits from bud_platform.live_wallets where host_id=$1', [host])).rows[0]?.credits ?? 0;
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${host}'),('${other}');`);
    for (const name of ['20261022215208_host_persistence_foundation.sql', '20261023083912_launch_sandbox_hardening.sql', '20261023173930_production_commerce_foundation.sql', '20261023193330_live_payment_queue_and_event_consumption.sql', '20261023202259_live_payment_operations_and_receipts.sql', '20261025093000_question_condition_activity_draw.sql','20261025093001_question_condition_live_draw.sql'])
      await db.exec(await readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8'));
    await db.query('insert into bud_platform.wallets(host_id,credits) values($1,5)', [host]);
    await db.exec('set role service_role');
    const begin = await handleAuth(new Request(origin + '/api/auth?action=signin', { method: 'POST', headers: { origin, ...edge } }), env, transport);
    const callback = new URL(new URL((await begin.json()).data.url).searchParams.get('redirect_to')!); callback.searchParams.set('code', 'fixture-code');
    const signedIn = await handleAuth(new Request(callback, { headers: { ...edge, cookie: begin.headers.getSetCookie()[0].split(';')[0] } }), env, transport);
    cookie = signedIn.headers.getSetCookie().find(v => v.startsWith('__Host-bud-session='))!.split(';')[0];

    await t.test('saved secrets, a foreign origin, non-pilot identity and disabled SQL never create a checkout', async () => {
      const noNetwork: typeof fetch = async () => { throw Error('unexpected network'); };
      assert.equal((await handleProductionCheckout(checkoutRequest(), { ...env, BUD_WHOP_PRODUCTION_ENABLED: 'false' }, noNetwork)).status, 503);
      assert.equal((await handleProductionCheckout(checkoutRequest(undefined, { origin: 'https://evil.test' }), env, noNetwork)).status, 403);
      assert.equal((await handleProductionCheckout(checkoutRequest(), { ...env, BUD_WHOP_PILOT_HOST_ID: other }, transport)).status, 403);
      assert.equal((await checkout()).status, 503); assert.equal(providerCalls, 0);
      await db.exec('reset role;update bud_platform.live_commerce_control set enabled=true,fulfillment_enabled=true;set role service_role');
      await resetLimits();
    });
    await t.test('browser cannot supply price, host, quantity or success; request locale is bound durably', async () => {
      for (const change of [{ amount: 2 }, { hostId: other }, { quantity: 2 }, { paid: true }, { locale: 'xx' }, { locale: ['en'] }]) {
        assert.equal((await checkout({ idempotencyKey: 'fixture-production-request-123', locale: 'en', ...change })).status, 400);
      }
      assert.equal(providerCalls, 0); await resetLimits();
    });
    await t.test('lost attach response before commit returns no checkout URL, retries use the same provider key', async () => {
      attachFailure = 'before';
      const failed = await checkout(); assert.equal(failed.status, 503); assert.equal((await failed.json()).data, undefined);
      attachFailure = 'after'; assert.equal((await checkout()).status, 503); assert.equal(checkoutPosts, 2);
      assert.equal(providerKeys[0], providerKeys[1]);
      assert.equal((await checkout()).status, 200); assert.equal(checkoutPosts, 2);
      assert.equal((await checkout({ idempotencyKey: 'fixture-production-request-123', locale: 'ar' })).status, 409);
      assert.equal(await credits(), 0); await resetLimits();
    });
    await t.test('bad signatures, wrong amount and refunded payments grant nothing', async () => {
      const request = await webhook(); request.headers.set('webhook-signature', 'v1,invalid');
      const before = providerCalls; assert.equal((await handleProductionWebhook(request, env, transport)).status, 401); assert.equal(providerCalls, before);
      queueFailure = 'before'; assert.equal((await deliver()).status, 503);
      queueFailure = 'after'; assert.equal((await deliver()).status, 503);
      assert.equal((await deliver()).status, 202);
      total = 1.99; assert.equal((await work()).retryRecorded, 1); total = 2; await due();
      refund = 0.01; assert.equal((await work()).retryRecorded, 1); refund = 0; await due();
      assert.equal(await credits(), 0);
    });
    await t.test('commit failure retries and lost committed response each result in exactly one live credit', async () => {
      creditFailure = 'before'; assert.equal((await work()).retryRecorded, 1); assert.equal(await credits(), 0); await due();
      creditFailure = 'after'; assert.equal((await work()).unconfirmed, 1); assert.equal(await credits(), 1);
      assert.equal((await deliver()).status, 202); assert.equal((await work()).processed, 0);
      assert.equal((await deliver('msg_another123')).status, 202); assert.equal((await work()).completed, 1); assert.equal(await credits(), 1);
      const many = await Promise.all(Array.from({ length: 3 }, (_, i) => deliver('msg_parallel' + i)));
      for (const response of many) assert.equal(response.status, 202);
      const workers = await Promise.all(Array.from({ length: 3 }, () => work()));
      assert.equal(workers.reduce((n, r) => n + r.completed, 0), 3);
      assert.equal(await credits(), 1);
      assert.equal((await checkout()).status, 409); assert.equal(checkoutPosts, 2);
      assert.equal((await db.query<{ n: number }>('select count(*)::int n from bud_platform.live_credit_ledger')).rows[0].n, 1);
      assert.equal((await db.query<{ credits: number }>('select credits from bud_platform.wallets where host_id=$1', [host])).rows[0].credits, 5);
      await db.exec('reset role');
      assert.equal((await db.query<{ n: number }>('select count(*)::int n from auth.users')).rows[0].n, 2);
      await db.exec('set role service_role');
    });
    await t.test('conflicting payments and unconfirmed SQL response never receive a successful acknowledgment', async () => {
      paymentId = 'pay_other123'; assert.equal((await deliver('msg_conflict123')).status, 202); assert.equal((await work()).retryRecorded, 1); paymentId = 'pay_fixture123';
      assert.equal((await deliver('msg_receipt123')).status, 202);
      badReceipt = true; assert.equal((await work()).unconfirmed, 1); badReceipt = false;
      assert.equal(await credits(), 1);
    });
    await t.test('checkout can be paused while signed intake and already paid orders continue draining', async () => {
      const paused = { ...env, BUD_WHOP_PRODUCTION_ENABLED: 'false' };
      await db.exec('reset role;update bud_platform.live_commerce_control set enabled=false;set role service_role');
      assert.equal((await handleProductionCheckout(checkoutRequest(), paused, transport)).status, 503);
      assert.equal((await handleProductionWebhook(await webhook('msg_draining123'), paused, transport)).status, 202);
      assert.equal((await runProductionPaymentJob(paused, transport)).completed, 1);
      assert.equal(await credits(), 1);
    });
    await t.test('live start spends one live key once, lost response and resume never debit again, sandbox stays isolated', async () => {
      await resetLimits();
      const start = { action: 'start', idempotencyKey: 'fixture-live-event-request-123', title: 'Fixture event',
        config: { duration: 5, timerEnabled: true, attempts: 2 }, prizeText: 'Gift' };
      assert.equal((await hostAction(start)).status, 503); assert.equal(await credits(), 1);
      await db.exec("reset role;update bud_platform.live_commerce_control set host_enabled=true;set role service_role");
      // Draft inventory stays blocked even with a purchased live key.
      assert.equal((await hostAction(start)).status, 503); assert.equal(await credits(), 1);
      await db.exec("reset role;update bud_platform.content_versions set eligible_pairs='[[\"0\",\"0\"],[\"1\",\"1\"],[\"2\",\"2\"]]'::jsonb,status='published';update bud_platform.products set status='published';set role service_role");
      assert.equal((await hostAction(start, true, { ...env, BUD_WHOP_PILOT_HOST_ID: other })).status, 403);
      assert.equal((await hostAction({ ...start, environment: 'sandbox' })).status, 400);
      loseHostResponse = true; assert.equal((await hostAction(start)).status, 503); assert.equal(await credits(), 0);
      const replay = await hostAction(start); assert.equal(replay.status, 200); const event = (await replay.json()).data;
      assert.equal((await hostAction(start)).status, 200);
      assert.equal((await hostAction({ ...start, title: 'Changed' })).status, 409);
      assert.equal((await hostAction({ ...start, idempotencyKey: 'fixture-other-start-request' })).status, 409);
      assert.equal((await hostAction({ action: 'resume', eventId: event.eventId }, true, { ...env, BUD_WHOP_PILOT_HOST_ID: other })).status, 403);
      await db.exec('reset role;update bud_platform.live_commerce_control set host_enabled=false;set role service_role');
      assert.equal((await hostAction(start)).status, 200);
      assert.equal((await hostAction({ action: 'resume', eventId: event.eventId })).status, 200);
      const dispatch = { action: 'dispatch', eventId: event.eventId, version: 1, idempotencyKey: 'fixture-live-command-request', command: { type: 'add-winner', name: 'Fixture' } };
      assert.equal((await hostAction(dispatch)).status, 200); assert.equal((await hostAction(dispatch)).status, 200);
      assert.equal(await credits(), 0);
      assert.equal((await db.query<{ n: number }>('select count(*)::int n from bud_platform.live_event_debits')).rows[0].n, 1);
      assert.equal((await (await hostAction({ action: 'dashboard' }, false)).json()).data.credits, 5);
      assert.equal((await (await hostAction({ action: 'dashboard' })).json()).data.credits, 0);
      await db.exec('reset role');
      await db.query("update bud_platform.live_events set started_at=clock_timestamp()-interval '4 hours 1 second' where id=$1", [event.eventId]);
      await db.exec('set role service_role');
      const expired = await hostAction({ action: 'resume', eventId: event.eventId }); assert.equal(expired.status, 200);
      assert.equal((await expired.json()).data.phase, 'completed');
      assert.equal(await credits(), 0);
    });
    await t.test('public production route stays disabled regardless of preparation handler flags', async () => {
      const { POST } = await import('../api/whop-webhook.ts');
      assert.equal((await POST(await webhook())).status, 503);
    });
    await t.test('verified public customer uses routed live orders, own receipts and one start debit without crossing tenants', async () => {
      const ownerOrder = orderId;
      const ownerEvent = (await db.query<{id:string}>('select id from bud_platform.live_events where host_id=$1',[host])).rows[0].id;
      const publicEnv = {...env, BUD_COMMERCE_MODE:'live',VERCEL_ENV:'production',BUD_WHOP_PRODUCTION_MODE:'public',BUD_PUBLIC_COMMERCE_ENABLED:'true',BUD_LIVE_RECEIPTS_ENABLED:'true'};
      await db.exec('reset role;update bud_platform.live_commerce_control set enabled=true,host_enabled=true;set role service_role');
      await resetLimits(); authHost = other; currentCheckoutId = 'ch_publiccustomer123';
      const login = await handleAuth(new Request(origin+'/api/auth?action=signin',{method:'POST',headers:{origin,...edge}}),publicEnv,transport);
      const callback = new URL(new URL((await login.json()).data.url).searchParams.get('redirect_to')!);callback.searchParams.set('code','fixture-other-code');
      const response = await handleAuth(new Request(callback,{headers:{...edge,cookie:login.headers.getSetCookie()[0].split(';')[0]}}),publicEnv,transport);
      cookie = response.headers.getSetCookie().find(value=>value.startsWith('__Host-bud-session='))!.split(';')[0];
      assert.equal((await handleCheckoutRoute(checkoutRequest(),{...publicEnv,BUD_PUBLIC_COMMERCE_ENABLED:'false'},transport)).status,503);
      assert.equal((await handleCheckoutRoute(checkoutRequest({idempotencyKey:'fixture-forged-public-key',locale:'en',hostId:host}),publicEnv,transport)).status,400);
      const purchase = await handleCheckoutRoute(checkoutRequest(),publicEnv,transport);assert.equal(purchase.status,200);
      const purchaseData = (await purchase.json()).data; assert.equal(purchaseData.environment,'production');
      assert.equal(purchaseData.url,'https://whop.com/checkout/ch_publiccustomer123/');
      paymentId = 'pay_publiccustomer123';refund = 0;total = 2;
      assert.equal((await handleWebhookRoute(await webhook('msg_publiccustomer123'),publicEnv,transport)).status,202);
      assert.equal((await runProductionPaymentJob(publicEnv,transport)).completed,1);
      const receipt = (id:string)=>handlePaymentStatus(new Request(origin+'/api/payment-status',{method:'POST',headers:{origin,...edge,cookie,'content-type':'application/json'},body:JSON.stringify({orderId:id})}),publicEnv,transport);
      assert.equal((await (await receipt(orderId)).json()).data.state,'confirmed');assert.equal((await receipt(ownerOrder)).status,404);
      const pausedReceipt = await handlePaymentStatus(new Request(origin+'/api/payment-status',{method:'POST',headers:{origin,...edge,cookie,'content-type':'application/json'},body:JSON.stringify({orderId})}),{...publicEnv,BUD_WHOP_PRODUCTION_ENABLED:'false'},transport);
      assert.equal(pausedReceipt.status,200);
      const routedHost = (body:unknown)=>handleHostRoute(new Request(origin+'/api/host',{method:'POST',headers:{origin,...edge,cookie,'content-type':'application/json'},body:JSON.stringify(body)}),publicEnv,transport);
      assert.equal((await (await routedHost({action:'dashboard'})).json()).data.credits,1);
      assert.equal((await routedHost({action:'resume',eventId:ownerEvent})).status,404);
      const start = {action:'start',idempotencyKey:'fixture-public-start-request',title:'Customer event',config:{duration:5,timerEnabled:true,attempts:2},prizeText:'Gift'};
      const first=await routedHost(start);assert.equal(first.status,200);const event=(await first.json()).data;
      const second=await routedHost(start);assert.equal((await second.json()).data.eventId,event.eventId);
      assert.equal((await routedHost({action:'resume',eventId:event.eventId})).status,200);
      assert.equal((await (await routedHost({action:'dashboard'})).json()).data.credits,0);
      assert.equal((await db.query<{n:number}>('select count(*)::int n from bud_platform.live_event_debits where host_id=$1',[other])).rows[0].n,1);
      assert.equal(await credits(),0);
      assert.equal((await db.query<{credits:number}>('select credits from bud_platform.wallets where host_id=$1',[host])).rows[0].credits,5);
    });
  } finally { await db.close(); }
});
