import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAuth } from '../server/auth.ts';
import { handleWhopPreflight, handleWhopQuote } from '../server/whop-preflight.ts';

const origin = 'https://bud-events-website.vercel.app';
const project = 'https://cepmvqqrjcvhyzszqand.supabase.co';
const hostId = '22222222-2222-4222-8222-222222222222';
const env = { BUD_WHOP_PREFLIGHT_ENABLED: 'true', BUD_WHOP_PRODUCTION_ENABLED: 'false', BUD_WHOP_PILOT_HOST_ID: hostId,
  WHOP_PRODUCTION_API_KEY: 'fixture-production-key', WHOP_PRODUCTION_COMPANY_ID: 'biz_fixture123', WHOP_PRODUCTION_PLAN_ID: 'plan_fixture123',
  WHOP_PRODUCTION_CURRENCY: 'sar', WHOP_PRODUCTION_AMOUNT_MINOR: '200', BUD_APP_ORIGIN: origin,
  BUD_BACKEND_ENABLED: 'true', BUD_AUTH_ENABLED: 'true', SUPABASE_URL: project, SUPABASE_SERVICE_ROLE_KEY: 'fixture-service-key',
  SUPABASE_PUBLISHABLE_KEY: 'fixture-public-key', BUD_AUTH_COOKIE_SECRET: 'fixture-cookie-secret-at-least-thirty-two-bytes',
  VERCEL: '1', BUD_RATE_LIMIT_ENABLED: 'true', BUD_RATE_LIMIT_SECRET: 'fixture-limiter-secret-at-least-thirty-two-bytes' };
const plan = { id: env.WHOP_PRODUCTION_PLAN_ID, company: { id: env.WHOP_PRODUCTION_COMPANY_ID }, product: { id: 'prod_fixture123' },
  currency: 'sar', plan_type: 'one_time', initial_price: 2, renewal_price: 0, adaptive_pricing_enabled: false, collect_tax: false };
function request(cookie?: string, change: RequestInit = {}, query = '') {
  return new Request(origin + '/api/whop-preflight' + query, { method: 'POST', ...change,
    headers: { origin, 'x-vercel-forwarded-for': '192.0.2.1', ...(cookie ? { cookie } : {}), ...change.headers } });
}
async function session() {
  const transport: typeof fetch = async input => String(input).endsWith('bud_consume_rate_limit') ? Response.json({ allowed: true, retryAfter: 0 })
    : String(input).endsWith('/user') ? Response.json({ id: hostId, identities: [{ provider: 'discord' }] })
    : Response.json({ access_token: 'fixture-access-token-long-enough', refresh_token: 'fixture-refresh-token', expires_in: 3600 });
  const start = await handleAuth(new Request(origin + '/api/auth?action=signin', { method: 'POST', headers: { origin, 'x-vercel-forwarded-for': '192.0.2.1' } }), env, transport);
  const callback = new URL(new URL((await start.json()).data.url).searchParams.get('redirect_to')!); callback.searchParams.set('code', 'fixture-code');
  const response = await handleAuth(new Request(callback, { headers: { 'x-vercel-forwarded-for': '192.0.2.1', cookie: start.headers.getSetCookie()[0].split(';')[0] } }), env, transport);
  return response.headers.getSetCookie().find(c => c.startsWith('__Host-bud-session='))!.split(';')[0];
}
function mock(provider: typeof fetch, limit = true): typeof fetch {
  return async (input, init) => {
    if (String(input) === project + '/rest/v1/rpc/bud_consume_rate_limit') return Response.json({ allowed: limit, retryAfter: limit ? 0 : 60 });
    if (String(input) === project + '/auth/v1/user') return Response.json({ id: hostId, identities: [{ provider: 'discord' }] });
    return provider(input, init);
  };
}

test('preflight requires independent opt-in, backend, exact origin, POST and no caller-supplied parameters before network', async () => {
  const noNetwork: typeof fetch = async () => { assert.fail('network must not run'); };
  for (const change of [{ BUD_WHOP_PREFLIGHT_ENABLED: 'false' }, { BUD_WHOP_PILOT_HOST_ID: '' }, { BUD_BACKEND_ENABLED: 'false' },
    { BUD_AUTH_ENABLED: 'false' }, { SUPABASE_URL: 'https://another.example' }, { WHOP_PRODUCTION_AMOUNT_MINOR: '' }]) {
    assert.equal((await handleWhopPreflight(request(), { ...env, ...change }, noNetwork)).status, 503);
  }
  assert.equal((await handleWhopPreflight(request(undefined, { method: 'GET' }), env, noNetwork)).status, 405);
  assert.equal((await handleWhopPreflight(request(undefined, { headers: { origin: 'https://evil.test' } }), env, noNetwork)).status, 403);
  assert.equal((await handleWhopPreflight(request(undefined, { body: '{}' }), env, noNetwork)).status, 400);
  assert.equal((await handleWhopPreflight(request(undefined, {}, '?plan=plan_other123'), env, noNetwork)).status, 400);
});

test('preflight rejects guests, a different verified pilot host and unavailable/rate-limited requests without contacting Whop', async () => {
  const noProvider: typeof fetch = async () => { assert.fail('provider must not run'); };
  assert.equal((await handleWhopPreflight(request(), env, mock(noProvider))).status, 401);
  assert.equal((await handleWhopPreflight(request(undefined, { body: '' }), env, mock(noProvider))).status, 401);
  const cookie = await session();
  assert.equal((await handleWhopPreflight(request(cookie), { ...env, BUD_WHOP_PILOT_HOST_ID: '33333333-3333-4333-8333-333333333333' }, mock(noProvider))).status, 403);
  assert.equal((await handleWhopPreflight(request(cookie), env, mock(noProvider, false))).status, 429);
  assert.equal((await handleWhopPreflight(request(cookie), { ...env, BUD_RATE_LIMIT_ENABLED: 'false' }, mock(noProvider))).status, 503);
});

test('authenticated pilot preflight performs only a provider GET with stored expectations while selling is disabled', async () => {
  const cookie = await session(); let providerCalls = 0;
  const response = await handleWhopPreflight(request(cookie, { body: '' }), env, mock(async (input, init) => {
    providerCalls++;
    assert.equal(String(input), 'https://api.whop.com/api/v1/plans/' + env.WHOP_PRODUCTION_PLAN_ID);
    assert.equal(init?.method ?? 'GET', 'GET');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer ' + env.WHOP_PRODUCTION_API_KEY);
    return Response.json({ ...plan, privateCustomer: 'must-not-be-returned' });
  }));
  assert.equal(response.status, 200); assert.equal(providerCalls, 1); assert.equal(response.headers.get('cache-control'), 'no-store');
  const body=await response.json(); const evidence=body.data.evidence; delete body.data.evidence;
  assert.equal(evidence.productBinding,'not_configured'); assert.equal(evidence.quoteChecked,false);
  assert.deepEqual(evidence.observed,{companyId:env.WHOP_PRODUCTION_COMPANY_ID,planId:env.WHOP_PRODUCTION_PLAN_ID,productId:'prod_fixture123'});
  assert.deepEqual(body, { code: 'OK', data: { companyId: env.WHOP_PRODUCTION_COMPANY_ID, productId: 'prod_fixture123',
    planId: env.WHOP_PRODUCTION_PLAN_ID, currency: 'sar', amountMinor: 200, checkoutCreated: false, paymentCreated: false, creditGranted: false } });
});

test('preflight rejects commercial mismatch and sanitizes provider/network diagnostics', async () => {
  const cookie = await session();
  const mismatch = await handleWhopPreflight(request(cookie), env, mock(async () => Response.json({ ...plan, initial_price: 18 })));
  assert.equal(mismatch.status, 409); assert.equal((await mismatch.json()).code, 'PRODUCTION_PLAN_MISMATCH');
  const fields = await handleWhopPreflight(request(cookie), env, mock(async () => Response.json({ ...plan, account:null,
    initial_price:18, privateCustomer:'must-not-return' })));
  const body=await fields.json(); assert.equal(body.data.evidence.observed.companyId,null); delete body.data.evidence;
  assert.deepEqual(body, { code:'PRODUCTION_PLAN_MISMATCH',data:{mismatches:['company','price'],settings:{conversion:'disabled',taxCollection:'disabled',taxType:'missing'}} });
  const failed = await handleWhopPreflight(request(cookie), env, mock(async () => { throw Error(env.WHOP_PRODUCTION_API_KEY); }));
  assert.equal(failed.status, 503); assert.doesNotMatch(await failed.text(), /fixture-production-key/);
  for (const [status, code] of [[401, 'WHOP_PRODUCTION_ACCESS_DENIED'], [403, 'WHOP_PRODUCTION_ACCESS_DENIED'],
    [404, 'WHOP_PRODUCTION_RESOURCE_NOT_FOUND'], [429, 'WHOP_PRODUCTION_RATE_LIMITED'],
    [400, 'WHOP_PRODUCTION_REQUEST_REJECTED'], [422, 'WHOP_PRODUCTION_REQUEST_REJECTED']] as const) {
    const denied = await handleWhopPreflight(request(cookie), env, mock(async () => new Response('private provider details', { status })));
    assert.equal(denied.status, 503); assert.deepEqual(await denied.json(), { code });
  }
});

test('quote opt-in never expands guest access or accepts caller pricing/location',async()=>{
  const never:typeof fetch=async()=>{assert.fail('provider must not run');};
  assert.equal((await handleWhopQuote(request(),env,never)).status,503);
  const quoteEnv={...env,BUD_WHOP_QUOTE_PREFLIGHT_ENABLED:'true',WHOP_PRODUCTION_PRODUCT_ID:'prod_fixture123'};
  assert.equal((await handleWhopQuote(request(),quoteEnv,mock(never))).status,401);
  const cookie=await session();
  assert.equal((await handleWhopQuote(request(cookie,{body:'{"country":"US","amount":1}'}),quoteEnv,never)).status,400);
  assert.equal((await handleWhopQuote(request(cookie),{...quoteEnv,BUD_WHOP_PILOT_HOST_ID:'33333333-3333-4333-8333-333333333333'},mock(never))).status,403);
  const wrong=await handleWhopQuote(request(cookie),{...quoteEnv,WHOP_PRODUCTION_PRODUCT_ID:'prod_wrong123'},mock(async()=>Response.json(plan)));
  assert.equal(wrong.status,409);
});
