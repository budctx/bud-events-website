import test from 'node:test';
import assert from 'node:assert/strict';
import auth from '../api/auth.ts';
import host from '../api/host.ts';
import preflight from '../api/whop-preflight.ts';
import worker from '../api/payment-worker.ts';
import reconcile from '../api/payment-reconcile.ts';
import receipt from '../api/payment-status.ts';

test('deployed fetch entrypoints ignore runtime context and read server environment', async () => {
  const origin = 'https://bud-events-website.vercel.app';
  const values = {
    BUD_AUTH_ENABLED: 'true', BUD_BACKEND_ENABLED: 'true', BUD_APP_ORIGIN: origin,
    SUPABASE_URL: 'https://cepmvqqrjcvhyzszqand.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'test-publishable',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service', BUD_AUTH_COOKIE_SECRET: 'test-cookie-secret-at-least-thirty-two-bytes',
    BUD_RATE_LIMIT_ENABLED: 'true', BUD_RATE_LIMIT_SECRET: 'test-rate-secret-at-least-thirty-two-bytes', VERCEL: '1',
    BUD_WHOP_PREFLIGHT_ENABLED: 'true', BUD_WHOP_PILOT_HOST_ID: '22222222-2222-4222-8222-222222222222',
    BUD_COMMERCE_MODE: 'sandbox', BUD_WHOP_PRODUCTION_MODE: 'pilot',
    WHOP_PRODUCTION_API_KEY: 'test-production-key', WHOP_PRODUCTION_COMPANY_ID: 'biz_fixture123',
    WHOP_PRODUCTION_PLAN_ID: 'plan_fixture123', WHOP_PRODUCTION_CURRENCY: 'sar', WHOP_PRODUCTION_AMOUNT_MINOR: '200',
    BUD_LIVE_RECEIPTS_ENABLED: 'true', CRON_SECRET: 'fixture-only-cron-secret-with-32-characters', BUD_PAYMENT_WORKER_ENABLED: 'false',
  };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  let limiterCalls = 0;
  try {
    Object.assign(process.env, values);
    globalThis.fetch = async input => {
      assert.equal(String(input), values.SUPABASE_URL + '/rest/v1/rpc/bud_consume_rate_limit');
      limiterCalls++;
      return Response.json({allowed: true, retryAfter: 0});
    };
    const context = {waitUntil: () => {}, BUD_AUTH_ENABLED: 'false'};
    const session = await Reflect.apply(auth.fetch, undefined, [new Request(origin + '/api/auth?action=session', {
      headers: {'x-vercel-forwarded-for': '192.0.2.1'},
    }), context]);
    assert.equal(session.status, 401);
    assert.equal((await session.json()).code, 'DISCORD_AUTH_REQUIRED');
    const dashboard = await Reflect.apply(host.fetch, undefined, [new Request(origin + '/api/host', {
      method: 'POST', headers: {Origin: origin, 'Content-Type': 'application/json', 'x-vercel-forwarded-for': '192.0.2.1'},
      body: JSON.stringify({action: 'dashboard'}),
    }), context]);
    assert.equal(dashboard.status, 401);
    assert.equal((await dashboard.json()).code, 'DISCORD_AUTH_REQUIRED');
    const inspection = await Reflect.apply(preflight.fetch, undefined, [new Request(origin + '/api/whop-preflight', {
      method: 'POST', headers: { Origin: origin, 'x-vercel-forwarded-for': '192.0.2.1' },
    }), context]);
    assert.equal(inspection.status, 401);
    assert.equal((await inspection.json()).code, 'DISCORD_AUTH_REQUIRED');
    const payment = await Reflect.apply(receipt.fetch, undefined, [new Request(origin + '/api/payment-status', {
      method:'POST',headers:{origin,'content-type':'application/json','x-vercel-forwarded-for':'192.0.2.1'},body:JSON.stringify({orderId:'22222222-2222-4222-8222-222222222222'}),
    }), context]);
    assert.equal(payment.status, 401);
    for (const entry of [worker,reconcile]) {
      const response = await Reflect.apply(entry.fetch, undefined, [new Request(origin + '/api/payment-worker', { headers:{authorization:'Bearer ' + values.CRON_SECRET} }), context]);
      assert.equal(response.status, 200); assert.equal((await response.json()).code, 'WORKER_DISABLED');
    }
    assert.equal(limiterCalls, 4);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
