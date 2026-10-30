import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSandboxPaymentMatches, createSandboxCheckout, verifySandboxWebhook, WhopError, whopSandboxConfig } from '../server/whop.ts';
import { handleSandboxWhopWebhook } from '../server/checkout.ts';
const origin = 'https://budteam.net';
const env = { BUD_WHOP_SANDBOX_ENABLED: 'true', WHOP_ENVIRONMENT: 'sandbox', WHOP_SANDBOX_API_KEY: 'mock-sandbox-api-key',
  WHOP_SANDBOX_WEBHOOK_SECRET: 'ws_0123456789abcdef0123456789abcdef0123456789abcdef', WHOP_SANDBOX_COMPANY_ID: 'biz_sandbox123',
  WHOP_SANDBOX_PRODUCT_ID: 'prod_sandbox123', WHOP_SANDBOX_PLAN_ID: 'plan_sandbox123', WHOP_SANDBOX_CURRENCY: 'sar', WHOP_SANDBOX_AMOUNT_MINOR: '2500',
  BUD_APP_ORIGIN: origin, BUD_BACKEND_ENABLED: 'true', SUPABASE_URL: 'https://cepmvqqrjcvhyzszqand.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-test-key',
  VERCEL: '1', BUD_RATE_LIMIT_ENABLED: 'true', BUD_RATE_LIMIT_SECRET: 'test-only-rate-secret-not-real-0123456789' };
const config = whopSandboxConfig(env)!;
const order = { orderId: '11111111-1111-4111-8111-111111111111', hostId: '22222222-2222-4222-8222-222222222222', environment: 'sandbox' as const,
  companyId: config.company, productId: config.product, planId: config.plan, currency: 'sar', amountMinor: 2500, checkoutId: 'ch_sandbox123', checkoutUrl: 'https://sandbox.whop.com/checkout/ch_sandbox123/' };
const payment = { id: 'pay_sandbox123', company: { id: config.company }, product: { id: config.product }, plan: { id: config.plan, currency: 'sar' }, currency: 'sar',
  status: 'paid', substatus: 'succeeded', paid_at: '2026-10-23T01:00:00Z', total: 25, refunded_amount: 0, refunded_at: null, auto_refunded: false, disputes: [],
  checkout_configuration_id: order.checkoutId, metadata: { bud_order_id: order.orderId } };
async function signed(payload: unknown, offset = 0, rawOverride?: string) {
  const timestamp = String(Math.floor(Date.now() / 1000) + offset); const messageId = 'msg_sandbox123'; const raw = rawOverride ?? JSON.stringify(payload);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(config.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(messageId + '.' + timestamp + '.' + raw)));
  return new Request(origin + '/api/whop-webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-vercel-forwarded-for': '203.0.113.10', 'webhook-id': messageId,
    'webhook-timestamp': timestamp, 'webhook-signature': 'v1,' + btoa(String.fromCharCode(...mac)) }, body: raw });
}
const envelope = { id: 'msg_sandbox123', type: 'payment.succeeded', api_version: 'v1', api_version_date: '2026-08-14', account_id: config.company, data: { id: payment.id } };
test('sandbox configuration rejects production, missing secrets and unsupported money', () => {
  assert.ok(config);
  for (const change of [{ BUD_WHOP_SANDBOX_ENABLED: 'false' }, { WHOP_ENVIRONMENT: 'production' }, { WHOP_SANDBOX_WEBHOOK_SECRET: '' }, { WHOP_SANDBOX_CURRENCY: 'jpy' }, { WHOP_SANDBOX_AMOUNT_MINOR: '25.01' }, { BUD_APP_ORIGIN: origin + '/' }]) assert.equal(whopSandboxConfig({ ...env, ...change }), null);
});
test('webhook verifies raw signature, exact account, version, message binding and replay window', async () => {
  assert.deepEqual(await verifySandboxWebhook(await signed(envelope), config), { messageId: envelope.id, type: envelope.type, paymentId: payment.id });
  for (const invalid of [{ ...envelope, id: 'msg_forged123' }, { ...envelope, account_id: 'biz_other123' }, { ...envelope, api_version_date: '2025-01-01' }, { ...envelope, api_version: 'v2' }]) {
    await assert.rejects(verifySandboxWebhook(await signed(invalid), config), (error: WhopError) => error.code === 'WEBHOOK_SCOPE_MISMATCH');
  }
  for (const offset of [-301, 301]) await assert.rejects(verifySandboxWebhook(await signed(envelope, offset), config), (error: WhopError) => error.status === 401);
  const original = await signed(envelope); const tampered = new Request(original.url, { method: 'POST', headers: original.headers, body: JSON.stringify(envelope) + ' ' });
  await assert.rejects(verifySandboxWebhook(tampered, config), (error: WhopError) => error.status === 401);
});
test('payment matching rejects every commercial authority mismatch without rounding', () => {
  assert.doesNotThrow(() => assertSandboxPaymentMatches(payment, order, config));
  for (const change of [{ company: { id: 'biz_wrong123' } }, { product: { id: 'prod_wrong123' } }, { plan: { id: 'plan_wrong123' } }, { currency: 'usd' },
    { total: 25.001 }, { total: 24.99 }, { status: 'pending' }, { substatus: 'refunded' }, { refunded_amount: 0.01 }, { refunded_at: '2026-10-23' },
    { checkout_configuration_id: 'ch_wrong123' }, { metadata: { bud_order_id: '33333333-3333-4333-8333-333333333333' } }, { disputes: [{ id: 'dispute' }] }]) {
    assert.throws(() => assertSandboxPaymentMatches({ ...payment, ...change }, order, config), (error: WhopError) => error.code === 'PAYMENT_ORDER_MISMATCH');
  }
  assert.throws(() => assertSandboxPaymentMatches(payment, { ...order, environment: 'production' as 'sandbox' }, config));
});
test('provider creates only sandbox checkout with server order metadata and verified plan', async () => {
  const calls: string[] = [];
  const transport: typeof fetch = async (input, init) => {
    const url = String(input); calls.push(url); assert.ok(url.startsWith('https://sandbox-api.whop.com/api/v1/'));
    const headers = new Headers(init?.headers); assert.equal(headers.get('api-version-date'), '2025-01-01'); assert.equal(init?.redirect, 'error');
    if (url.includes('/plans/')) return Response.json({ id: config.plan, company: { id: config.company }, product: { id: config.product }, plan_type: 'one_time', currency: 'sar', initial_price: 25, renewal_price: 0, adaptive_pricing_enabled: false, collect_tax: false });
    const body = JSON.parse(String(init?.body)); assert.deepEqual(body.metadata, { bud_order_id: order.orderId }); assert.equal(body.plan_id, config.plan); assert.equal(body.redirect_url, origin + '/?screen=host');
    return Response.json({ id: order.checkoutId, purchase_url: order.checkoutUrl, company_id: config.company, plan: { id: config.plan, currency: 'sar' }, currency: 'sar', mode: 'payment', metadata: body.metadata });
  };
  assert.deepEqual(await createSandboxCheckout({ ...order, checkoutId: null, checkoutUrl: null }, config, transport), { checkoutId: order.checkoutId, url: order.checkoutUrl });
  assert.equal(calls.length, 2);
  await assert.rejects(createSandboxCheckout(order, config, async () => Response.json({ id: config.plan, initial_price: 0 })), (error: WhopError) => error.code === 'PROVIDER_PLAN_MISMATCH');
});
test('signed webhook credits only after authoritative provider relookup and durable order binding', async () => {
  const calls: string[] = []; const credited = new Set<string>(); let credits = 0;
  const transport: typeof fetch = async (input, init) => {
    const url = String(input); if (url.endsWith('bud_consume_rate_limit')) return Response.json({ allowed: true, retryAfter: 0 }); calls.push(url);
    if (url.startsWith('https://sandbox-api.whop.com')) return Response.json(payment);
    const body = JSON.parse(String(init?.body));
    if (url.endsWith('bud_sandbox_order')) { assert.equal(body.p_order, order.orderId); return Response.json(order); }
    assert.ok(url.endsWith('bud_credit_verified_purchase')); assert.equal(body.p_environment, 'sandbox'); assert.equal(body.p_amount_minor, 2500);
    if (!credited.has(body.p_payment)) { credited.add(body.p_payment); credits++; } return Response.json({ credited: true });
  };
  for (let attempt = 0; attempt < 2; attempt++) assert.equal((await handleSandboxWhopWebhook(await signed(envelope), env, transport)).status, 200);
  assert.equal(credits, 1); assert.ok(calls[0].startsWith('https://sandbox-api.whop.com')); assert.ok(calls[1].endsWith('bud_sandbox_order')); assert.ok(calls[2].endsWith('bud_credit_verified_purchase'));
});
test('disabled, wrong upstream payment and unhandled events never credit', async () => {
  let calls = 0;
  const never: typeof fetch = async input => { if (String(input).endsWith('bud_consume_rate_limit')) return Response.json({ allowed: true, retryAfter: 0 }); calls++; throw new Error('private provider diagnostic'); };
  assert.equal((await handleSandboxWhopWebhook(await signed(envelope), { ...env, BUD_WHOP_SANDBOX_ENABLED: 'false' }, never)).status, 503);
  assert.equal((await handleSandboxWhopWebhook(await signed({ ...envelope, type: 'payment.failed' }), env, never)).status, 422); assert.equal(calls, 0);
  let credited = false;
  const bad: typeof fetch = async (input) => {
    const url = String(input); if (url.endsWith('bud_consume_rate_limit')) return Response.json({ allowed: true, retryAfter: 0 }); if (url.startsWith('https://sandbox-api.whop.com')) return Response.json({ ...payment, total: 1 });
    if (url.endsWith('bud_sandbox_order')) return Response.json(order); credited = true; return Response.json({});
  };
  assert.equal((await handleSandboxWhopWebhook(await signed(envelope), env, bad)).status, 409); assert.equal(credited, false);
});
