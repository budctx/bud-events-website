import test from 'node:test';
import assert from 'node:assert/strict';
import auth from '../api/auth.ts';
import host from '../api/host.ts';

test('deployed fetch entrypoints ignore runtime context and read server environment', async () => {
  const origin = 'https://bud-events-website.vercel.app';
  const values = {
    BUD_AUTH_ENABLED: 'true', BUD_BACKEND_ENABLED: 'true', BUD_APP_ORIGIN: origin,
    SUPABASE_URL: 'https://cepmvqqrjcvhyzszqand.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'test-publishable',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service', BUD_AUTH_COOKIE_SECRET: 'test-cookie-secret-at-least-thirty-two-bytes',
    BUD_RATE_LIMIT_ENABLED: 'true', BUD_RATE_LIMIT_SECRET: 'test-rate-secret-at-least-thirty-two-bytes', VERCEL: '1',
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
    assert.equal(limiterCalls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
