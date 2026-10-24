import test from 'node:test';
import assert from 'node:assert/strict';
import { assertProductionCheckoutUrl, assertProductionPaymentMatches, createProductionCheckout, inspectProductionPlan,
  lookupProductionPayment, productionPlanExpectation, verifyProductionWebhook, whopProductionConfig, whopProductionProcessingConfig } from '../server/whop-production.ts';
import { WhopError } from '../server/whop.ts';

const env = { WHOP_PRODUCTION_API_KEY: 'test-only-production-key', WHOP_PRODUCTION_COMPANY_ID: 'biz_production123',
  WHOP_PRODUCTION_PLAN_ID: 'plan_production123', WHOP_PRODUCTION_PRODUCT_ID: 'prod_production123', WHOP_PRODUCTION_CURRENCY: 'sar',
  WHOP_PRODUCTION_AMOUNT_MINOR: '200', WHOP_PRODUCTION_WEBHOOK_SECRET: 'ws_0123456789abcdef0123456789abcdef0123456789abcdef',
  WHOP_PRODUCTION_WEBHOOK_API_VERSION: '2026-10-15-1', BUD_APP_ORIGIN: 'https://bud-events-website.vercel.app',
  WHOP_ENVIRONMENT: 'production', BUD_WHOP_PRODUCTION_ENABLED: 'true', BUD_WHOP_PRODUCTION_PROCESSING_ENABLED: 'true', BUD_WHOP_PRODUCTION_MODE: 'pilot',
  BUD_WHOP_PILOT_HOST_ID: '22222222-2222-4222-8222-222222222222' };
const config = whopProductionConfig(env)!;
const plan = { id: config.plan, company: { id: config.company }, product: { id: config.product }, plan_type: 'one_time', currency: 'sar',
  initial_price: 2, renewal_price: 0, adaptive_pricing_enabled: false, collect_tax: false };
const order = { orderId: '11111111-1111-4111-8111-111111111111', hostId: config.pilotHostId, environment: 'production' as const,
  companyId: config.company, productId: config.product, planId: config.plan, currency: 'sar', amountMinor: 200, locale: 'en' as const,
  checkoutId: 'ch_production123', checkoutUrl: 'https://whop.com/checkout/ch_production123/' };
const payment = { id: 'pay_production123', status: 'paid', substatus: 'succeeded', paid_at: '2026-10-23T10:00:00Z',
  company: { id: config.company }, product: { id: config.product }, plan: { id: config.plan }, total: 2, currency: 'sar',
  refunded_amount: 0, auto_refunded: false, refunded_at: null, disputes: [], checkout_configuration_id: order.checkoutId,
  metadata: { bud_order_id: order.orderId, bud_environment: 'production' } };

test('production credentials alone cannot activate pilot configuration; all environment, host and version gates are explicit', () => {
  assert.ok(config);
  const installed = { WHOP_PRODUCTION_API_KEY: env.WHOP_PRODUCTION_API_KEY, WHOP_PRODUCTION_COMPANY_ID: env.WHOP_PRODUCTION_COMPANY_ID,
    WHOP_PRODUCTION_PLAN_ID: env.WHOP_PRODUCTION_PLAN_ID, WHOP_PRODUCTION_WEBHOOK_SECRET: env.WHOP_PRODUCTION_WEBHOOK_SECRET };
  assert.equal(whopProductionConfig(installed), null);
  assert.equal(productionPlanExpectation(installed), null);
  for (const change of [{ BUD_WHOP_PRODUCTION_ENABLED: 'false' }, { BUD_WHOP_PRODUCTION_PROCESSING_ENABLED: 'false' }, { WHOP_ENVIRONMENT: 'sandbox' }, { BUD_WHOP_PRODUCTION_MODE: 'public' },
    { BUD_WHOP_PILOT_HOST_ID: '' }, { WHOP_PRODUCTION_WEBHOOK_API_VERSION: '' }, { WHOP_PRODUCTION_PRODUCT_ID: '' },
    { WHOP_PRODUCTION_WEBHOOK_SECRET: '' }, { WHOP_PRODUCTION_CURRENCY: 'usd' }, { WHOP_PRODUCTION_AMOUNT_MINOR: '2.00' },
    { BUD_APP_ORIGIN: env.BUD_APP_ORIGIN + '/' }, { BUD_APP_ORIGIN: 'http://localhost' }]) assert.equal(whopProductionConfig({ ...env, ...change }), null);
});

test('stopping new purchases preserves separately configured signed intake and processing', () => {
  const paused = { ...env, BUD_WHOP_PRODUCTION_ENABLED: 'false' };
  assert.equal(whopProductionConfig(paused), null);
  assert.ok(whopProductionProcessingConfig(paused));
  assert.equal(whopProductionProcessingConfig({ ...paused, BUD_WHOP_PRODUCTION_PROCESSING_ENABLED: 'false' }), null);
});
test('read-only plan discovery uses only production GET, pins the legacy shape and returns no token or customer details', async () => {
  const calls: string[] = [];
  const result = await inspectProductionPlan(config, async (input, init) => {
    calls.push(String(input)); assert.equal(String(input), 'https://api.whop.com/api/v1/plans/' + config.plan);
    assert.equal(init?.method ?? 'GET', 'GET'); assert.equal(init?.redirect, 'error');
    const headers = new Headers(init?.headers); assert.equal(headers.get('api-version-date'), '2025-01-01');
    assert.equal(headers.get('authorization'), 'Bearer ' + env.WHOP_PRODUCTION_API_KEY);
    return Response.json({ ...plan, customer_email: 'must-not-return@example.test' });
  });
  assert.deepEqual(result, { companyId: config.company, productId: config.product, planId: config.plan, currency: 'sar', amountMinor: 200 });
  assert.equal(calls.length, 1); assert.doesNotMatch(JSON.stringify(result), /token|customer|key/i);
});
test('production plan rejects wrong identity, price, recurring charge, automatic conversion and additive tax before checkout', async () => {
  for (const change of [{ id: 'plan_wrong123' }, { company: { id: 'biz_wrong123' } }, { product: null }, { currency: 'usd' },
    { initial_price: 18 }, { initial_price: 2.001 }, { renewal_price: 2 }, { plan_type: 'renewal' }, { adaptive_pricing_enabled: true },
    { collect_tax: true, tax_type: 'exclusive' }, { collect_tax: undefined }]) {
    let calls = 0;
    await assert.rejects(createProductionCheckout(order, config, async () => { calls++; return Response.json({ ...plan, ...change }); }),
      (error: WhopError) => error.code === 'PRODUCTION_PLAN_MISMATCH');
    assert.equal(calls, 1);
  }
});
test('pilot rejects sandbox orders and another host without making provider requests', async () => {
  let calls = 0; const transport: typeof fetch = async () => { calls++; return Response.json(plan); };
  for (const change of [{ environment: 'sandbox' as 'production' }, { hostId: '33333333-3333-4333-8333-333333333333' },
    { amountMinor: 1800 }, { productId: 'prod_other123' }, { locale: 'https://evil.test' as 'en' }]) await assert.rejects(createProductionCheckout({ ...order, ...change }, config, transport));
  assert.equal(calls, 0);
});
test('production checkout binds environment, server order, verified product and deterministic idempotency key', async () => {
 for (const locale of ['ar', 'en'] as const) {
  let calls = 0;
  const result = await createProductionCheckout({ ...order, locale }, config, async (input, init) => {
    assert.ok(String(input).startsWith('https://api.whop.com/api/v1/')); calls++;
    if (calls === 1) return Response.json(plan);
    assert.equal(init?.method, 'POST'); assert.equal(new Headers(init?.headers).get('idempotency-key'), 'bud-production-' + order.orderId);
    const body = JSON.parse(String(init?.body)); assert.equal(body.plan_id, config.plan); assert.equal(body.redirect_url, config.origin + '/?screen=events&lang=' + locale + '&order=' + order.orderId);
    assert.deepEqual(body.metadata, { bud_order_id: order.orderId, bud_environment: 'production' });
    return Response.json({ id: order.checkoutId, company_id: config.company, plan: { id: config.plan, currency: 'sar' }, currency: null,
      purchase_url: order.checkoutUrl, mode: 'payment', metadata: body.metadata });
  });
  assert.deepEqual(result, { checkoutId: order.checkoutId, url: order.checkoutUrl }); assert.equal(calls, 2);
 }
});
test('production checkout rejects sandbox hosts, hostile URLs, unbound checkout IDs and query redirects', () => {
  for (const url of ['https://sandbox.whop.com/checkout/ch_production123/', 'https://whop.com.evil.test/checkout/ch_production123/',
    'https://whop.com/checkout/plan_production123/', 'https://whop.com/checkout/ch_production123/?redirect=evil',
    'https://name:secret@whop.com/checkout/ch_production123/', 'https://whop.com/checkout/ch_production123/#x', 'https://evil.test']) {
    assert.throws(() => assertProductionCheckoutUrl(order.checkoutId, url));
  }
  assert.doesNotThrow(() => assertProductionCheckoutUrl(order.checkoutId, order.checkoutUrl));
});
test('production provider failures are sanitized; redirect and oversized payload are never interpreted as a plan', async () => {
  for (const transport of [async () => { throw new Error(env.WHOP_PRODUCTION_API_KEY); },
    async () => new Response(env.WHOP_PRODUCTION_API_KEY, { status: 403 }), async () => Response.json({ padding: 'x'.repeat(131073) }),
    async () => new Response('not-json')]) {
    await assert.rejects(inspectProductionPlan(config, transport), (error: Error) => error instanceof WhopError && !error.message.includes(env.WHOP_PRODUCTION_API_KEY));
  }
});
test('authoritative lookup requires payment ID and production order metadata before returning an internal order reference', async () => {
  assert.equal((await lookupProductionPayment(payment.id, config, async () => Response.json(payment))).orderId, order.orderId);
  for (const change of [{ id: 'pay_other123' }, { metadata: { bud_order_id: order.orderId, bud_environment: 'sandbox' } },
    { metadata: { bud_order_id: 'forged', bud_environment: 'production' } }]) {
    await assert.rejects(lookupProductionPayment(payment.id, config, async () => Response.json({ ...payment, ...change })));
  }
});
test('payment matching rejects partial, refunded, disputed, unbound and cross-environment payments', () => {
  assert.doesNotThrow(() => assertProductionPaymentMatches(payment, order, config));
  for (const change of [{ id: undefined }, { status: 'pending' }, { total: 1.99 }, { total: 2.001 }, { currency: 'usd' },
    { company: { id: 'biz_other123' } }, { product: { id: 'prod_other123' } }, { plan: { id: 'plan_other123' } },
    { checkout_configuration_id: 'ch_other123' }, { paid_at: 'invalid' }, { refunded_amount: 0.01 }, { auto_refunded: true },
    { refunded_at: '2026-10-23T10:30:00Z' }, { disputes: [{ id: 'dspt_example' }] }, { disputes: undefined },
    { metadata: { bud_order_id: order.orderId, bud_environment: 'sandbox' } }]) {
    assert.throws(() => assertProductionPaymentMatches({ ...payment, ...change }, order, config));
  }
  assert.throws(() => assertProductionPaymentMatches(payment, { ...order, checkoutId: null, checkoutUrl: null }, config));
});
async function signed(changes: Record<string, unknown> = {}, offset = 0) {
  const messageId = 'msg_production123'; const timestamp = String(Math.floor(Date.now() / 1000) + offset);
  const raw = JSON.stringify({ id: messageId, api_version: 'v1', api_version_date: config.webhookVersion, account_id: config.company,
    type: 'payment.succeeded', data: { id: payment.id }, ...changes });
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(config.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(messageId + '.' + timestamp + '.' + raw)));
  return new Request(config.origin + '/api/whop-webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'webhook-id': messageId,
    'webhook-timestamp': timestamp, 'webhook-signature': 'v1,' + btoa(String.fromCharCode(...mac)) }, body: raw });
}
test('production webhook pins subscription version and account; stale, tampered and unsupported messages never verify', async () => {
  assert.equal((await verifyProductionWebhook(await signed(), config)).paymentId, payment.id);
  for (const changes of [{ account_id: 'biz_other123' }, { api_version_date: '2026-08-14' }, { type: 'payment.failed' }]) {
    await assert.rejects(verifyProductionWebhook(await signed(changes), config));
  }
  for (const offset of [-301, 301]) await assert.rejects(verifyProductionWebhook(await signed({}, offset), config));
  const request = await signed(); const tampered = new Request(request.url, { method: 'POST', headers: request.headers, body: (await request.text()) + ' ' });
  await assert.rejects(verifyProductionWebhook(tampered, config));
});
