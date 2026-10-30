import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAuth } from '../server/auth.ts';
import { handleCheckout } from '../server/checkout.ts';
const origin = 'https://budteam.net';
const project = 'https://cepmvqqrjcvhyzszqand.supabase.co';
const hostId = '22222222-2222-4222-8222-222222222222';
const env = { BUD_WHOP_SANDBOX_ENABLED: 'true', WHOP_ENVIRONMENT: 'sandbox', WHOP_SANDBOX_API_KEY: 'mock-sandbox-api-key',
  WHOP_SANDBOX_WEBHOOK_SECRET: 'ws_0123456789abcdef0123456789abcdef0123456789abcdef', WHOP_SANDBOX_COMPANY_ID: 'biz_sandbox123',
  WHOP_SANDBOX_PRODUCT_ID: 'prod_sandbox123', WHOP_SANDBOX_PLAN_ID: 'plan_sandbox123', WHOP_SANDBOX_CURRENCY: 'sar', WHOP_SANDBOX_AMOUNT_MINOR: '2500',
  BUD_APP_ORIGIN: origin, BUD_BACKEND_ENABLED: 'true', BUD_AUTH_ENABLED: 'true', SUPABASE_URL: project,
  SUPABASE_SERVICE_ROLE_KEY: 'server-test-key', SUPABASE_PUBLISHABLE_KEY: 'publishable-test', BUD_AUTH_COOKIE_SECRET: 'test-only-secret-not-a-real-secret-0123456789',
  VERCEL: '1', BUD_RATE_LIMIT_ENABLED: 'true', BUD_RATE_LIMIT_SECRET: 'test-only-rate-secret-not-real-0123456789' };
const order = { orderId: '11111111-1111-4111-8111-111111111111', hostId, environment: 'sandbox', companyId: 'biz_sandbox123', productId: 'prod_sandbox123',
  planId: 'plan_sandbox123', currency: 'sar', amountMinor: 2500, checkoutId: 'ch_sandbox123', checkoutUrl: 'https://sandbox.whop.com/checkout/ch_sandbox123/' };
const key = 'test-checkout-request-key';
async function cookie() {
  const transport: typeof fetch = async input => String(input).endsWith('bud_consume_rate_limit') ? Response.json({ allowed: true, retryAfter: 0 })
    : String(input).endsWith('/user') ? Response.json({ id: hostId, identities: [{ provider: 'discord' }] })
    : Response.json({ access_token: 'valid-test-access-token-long-enough', refresh_token: 'valid-test-refresh-token', expires_in: 3600 });
  const begin = await handleAuth(new Request(origin + '/api/auth?action=signin', { method: 'POST', headers: { origin, 'x-vercel-forwarded-for': '203.0.113.10' } }), env, transport);
  const callback = new URL(new URL((await begin.json()).data.url).searchParams.get('redirect_to')!); callback.searchParams.set('code', 'code');
  const response = await handleAuth(new Request(callback, { headers: { 'x-vercel-forwarded-for': '203.0.113.10', cookie: begin.headers.getSetCookie()[0].split(';')[0] } }), env, transport);
  return response.headers.getSetCookie().find(value => value.startsWith('__Host-bud-session='))!.split(';')[0];
}
function request(value: unknown, session?: string, otherOrigin = origin) {
  return new Request(origin + '/api/checkout', { method: 'POST', headers: { origin: otherOrigin, 'x-vercel-forwarded-for': '203.0.113.10', 'content-type': 'application/json', ...(session ? { cookie: session } : {}) }, body: JSON.stringify(value) });
}
function mock(handler: (url: string, params: Record<string, unknown>) => Response): typeof fetch {
  return async (input, init) => {
    const url = String(input);
    if (url.endsWith('bud_consume_rate_limit')) return Response.json({ allowed: true, retryAfter: 0 });
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: hostId, identities: [{ provider: 'discord' }] });
    return handler(url, init?.body ? JSON.parse(String(init.body)) : {});
  };
}
test('checkout has independent sandbox configuration, CSRF, method and authentication gates', async () => {
  assert.equal((await handleCheckout(new Request(origin + '/api/checkout'), env)).status, 405);
  assert.equal((await handleCheckout(request({ idempotencyKey: key }), { ...env, WHOP_ENVIRONMENT: 'production' })).status, 503);
  assert.equal((await handleCheckout(request({ idempotencyKey: key }, undefined, 'https://evil.example'), env)).status, 403);
  assert.equal((await handleCheckout(request({ idempotencyKey: key }), env, mock(() => Response.json({})))).status, 401);
});
test('checkout derives host, price and product server-side and reuses durable checkout', async () => {
  const session = await cookie(); const calls: string[] = [];
  const transport = mock((url, body) => {
    calls.push(url); assert.ok(url.endsWith('bud_create_sandbox_order')); assert.equal(body.p_host, hostId); assert.equal(body.p_amount, 2500); assert.equal(body.p_product, order.productId); return Response.json(order);
  });
  const response = await handleCheckout(request({ idempotencyKey: key }, session), env, transport);
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { code: 'OK', data: { orderId: order.orderId, url: order.checkoutUrl, environment: 'sandbox' } });
  assert.equal(calls.length, 1); assert.equal(response.headers.get('cache-control'), 'no-store');
  for (const injected of [{ amount: 1 }, { hostId }, { productId: 'other' }, { returnUrl: 'https://evil.example' }]) assert.equal((await handleCheckout(request({ idempotencyKey: key, ...injected }, session), env, transport)).status, 400);
  assert.equal(calls.length, 1);
});
test('new checkout is returned only after verified provider plan and durable order attachment', async () => {
  const session = await cookie(); const calls: string[] = [];
  const transport = mock((url, body) => {
    calls.push(url);
    if (url.endsWith('bud_create_sandbox_order')) return Response.json({ ...order, checkoutId: null, checkoutUrl: null });
    if (url.includes('/plans/')) return Response.json({ id: order.planId, company: { id: order.companyId }, product: { id: order.productId }, currency: 'sar', plan_type: 'one_time', initial_price: 25, renewal_price: 0, adaptive_pricing_enabled: false, collect_tax: false });
    if (url.endsWith('/checkout_configurations')) return Response.json({ id: order.checkoutId, purchase_url: order.checkoutUrl, company_id: order.companyId, plan: { id: order.planId, currency:'sar' }, currency: null, mode: 'payment', metadata: body.metadata });
    assert.ok(url.endsWith('bud_attach_sandbox_checkout')); assert.equal(body.p_host, hostId); assert.equal(body.p_order, order.orderId); return Response.json(order);
  });
  assert.equal((await handleCheckout(request({ idempotencyKey: key }, session), env, transport)).status, 200);
  assert.equal(calls.length, 4); assert.ok(calls[0].endsWith('bud_create_sandbox_order')); assert.ok(calls.at(-1)!.endsWith('bud_attach_sandbox_checkout'));
});
test('checkout cannot redirect to production or leak backend diagnostics', async () => {
  const session = await cookie();
  const wrong = await handleCheckout(request({ idempotencyKey: key }, session), env, mock(() => Response.json({ ...order, checkoutUrl: 'https://whop.com/checkout/ch_sandbox123/' })));
  assert.equal(wrong.status, 503); assert.equal((await wrong.json()).code, 'INVALID_CHECKOUT_URL');
  const failure = await handleCheckout(request({ idempotencyKey: key }, session), env, mock(() => Response.json({ message: 'private diagnostic' }, { status: 500 })));
  assert.equal(failure.status, 503); assert.ok(!(await failure.text()).includes('private diagnostic'));
});
