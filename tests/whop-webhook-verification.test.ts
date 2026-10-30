import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { handleWebhookRoute } from '../server/commerce-routing.ts';
import { handleWhopWebhookVerification } from '../server/whop-webhook-verification.ts';
import type { CommerceEnv } from '../server/whop.ts';

const origin = 'https://budteam.net';
const env: CommerceEnv = { BUD_WHOP_WEBHOOK_VERIFY_ONLY_ENABLED: 'true', VERCEL_ENV: 'production', BUD_APP_ORIGIN: origin,
  WHOP_PRODUCTION_WEBHOOK_SECRET: 'ws_0123456789abcdef0123456789abcdef0123456789abcdef',
  WHOP_PRODUCTION_COMPANY_ID: 'biz_fixture123', WHOP_PRODUCTION_WEBHOOK_API_VERSION: '2026-10-15-1',
  BUD_WHOP_PRODUCTION_ENABLED: 'false', BUD_WHOP_PRODUCTION_PROCESSING_ENABLED: 'false', BUD_PAYMENT_WORKER_ENABLED: 'false',
  BUD_LIVE_HOST_ENABLED: 'false', BUD_LIVE_RECEIPTS_ENABLED: 'false' };
const noNetwork: typeof fetch = async () => { throw new Error('No diagnostic transport calls allowed'); };
function signed(change: object = {}, options: { stamp?: string; tamper?: boolean; secret?: string; url?: string; messageId?: string } = {}) {
  const id = options.messageId ?? 'msg_fixture123';
  const stamp = options.stamp ?? String(Math.floor(Date.now() / 1000));
  const raw = JSON.stringify({ id, api_version: 'v1', api_version_date: '2026-10-15-1', account_id: env.WHOP_PRODUCTION_COMPANY_ID,
    type: 'payment.succeeded', data: { id: 'pay_fixture123', privateCustomer: 'must-not-leak' }, ...change });
  const signature = createHmac('sha256', options.secret ?? env.WHOP_PRODUCTION_WEBHOOK_SECRET!).update(id + '.' + stamp + '.' + raw).digest('base64');
  return new Request(options.url ?? origin + '/api/whop-webhook', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'webhook-id': id, 'webhook-timestamp': stamp, 'webhook-signature': 'v1,' + signature },
    body: raw + (options.tamper ? ' ' : '') });
}
test('verification route confirms a signed sample without any provider/database call; replay has no side effects', async () => {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await handleWebhookRoute(signed(), env, noNetwork);
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { code: 'WEBHOOK_VERIFIED_ONLY', data: { signatureVerified: true, accountMatched: true,
      apiVersion: 'v1', apiVersionDate: '2026-10-15-1', queued: false, paymentLookedUp: false, credited: false } });
  }
});
test('a real Whop unpinned v1 payment.succeeded envelope with company_id is accepted only after signature verification', async () => {
  const envelope = {api_version_date:null,account_id:undefined,company_id:env.WHOP_PRODUCTION_COMPANY_ID};
  const response = await handleWebhookRoute(signed(envelope),env,noNetwork);
  assert.equal(response.status,200);
  assert.equal((await response.json()).data.credited,false);
  const tampered = signed(envelope,{tamper:true});
  assert.equal((await handleWebhookRoute(tampered,env,noNetwork)).status,401);
});
test('diagnostic gate defaults off and preserves the existing unavailable route', async () => {
  for (const flag of [undefined, 'false', 'TRUE', '1']) {
    const response = await handleWebhookRoute(signed(), { ...env, BUD_WHOP_WEBHOOK_VERIFY_ONLY_ENABLED: flag }, noNetwork);
    assert.equal(response.status, 503); assert.notEqual((await response.json()).code, 'WEBHOOK_VERIFIED_ONLY');
  }
});
test('every financial/configuration conflict fails before reading a body and never falls through to live intake', async () => {
  const changes: CommerceEnv[] = [];
  for (const flag of ['BUD_WHOP_PRODUCTION_ENABLED', 'BUD_WHOP_PRODUCTION_PROCESSING_ENABLED', 'BUD_PAYMENT_WORKER_ENABLED',
    'BUD_LIVE_HOST_ENABLED', 'BUD_LIVE_RECEIPTS_ENABLED']) for (const value of ['true', undefined, 'FALSE']) changes.push({ [flag]: value });
  changes.push({ BUD_PUBLIC_COMMERCE_ENABLED: 'true' }, { BUD_COMMERCE_MODE: 'live' }, { BUD_COMMERCE_MODE: 'unknown' },
    { BUD_WHOP_SANDBOX_ENABLED: 'true' }, { VERCEL_ENV: 'preview' }, { WHOP_PRODUCTION_WEBHOOK_SECRET: '' },
    { WHOP_PRODUCTION_COMPANY_ID: '' }, { WHOP_PRODUCTION_WEBHOOK_API_VERSION: '' }, { WHOP_PRODUCTION_WEBHOOK_API_VERSION: '2026-10-24' });
  for (const change of changes) {
    const request = signed(); const response = await handleWebhookRoute(request, { ...env, ...change }, noNetwork);
    assert.equal(response.status, 503, JSON.stringify(change)); assert.equal(request.bodyUsed, false);
    assert.equal((await response.json()).code, 'WEBHOOK_VERIFICATION_NOT_CONFIGURED');
  }
});
test('tampered, stale, wrong-secret, mismatched scope/version/event and malformed envelopes cannot produce a verified receipt', async () => {
  const cases: Array<[Request, number]> = [
    [signed({}, { tamper: true }), 401], [signed({}, { stamp: '1600000000' }), 401], [signed({}, { secret: 'wrong' }), 401],
    [signed({ account_id: 'biz_another123' }), 400], [signed({ id: 'msg_different123' }), 400],
    [signed({ api_version: 'v2' }), 400], [signed({ api_version_date: null, account_id: undefined, company_id: 'biz_other123' }), 400],
    [signed({ api_version_date: null, account_id: undefined, company_id: undefined }), 400],
    [signed({ api_version_date: '2026-08-14' }), 400], [signed({ type: 'payment.failed' }), 400], [signed({ data: { id: 'other123' } }), 400],
  ];
  for (const [request, expected] of cases) {
    const response = await handleWebhookRoute(request, env, noNetwork); assert.equal(response.status, expected);
    assert.doesNotMatch(await response.text(), /must-not-leak|msg_fixture|pay_fixture|ws_0123/);
  }
});
test('method, endpoint, content type, body size and malformed UTF8 stay bounded and fail closed', async () => {
  assert.equal((await handleWhopWebhookVerification(new Request(origin + '/api/whop-webhook'), env)).status, 405);
  for (const url of [origin + '/api/whop-webhook?test=1', origin + '/api/checkout', 'https://evil.test/api/whop-webhook'])
    assert.equal((await handleWebhookRoute(signed({}, { url }), env, noNetwork)).status, 400);
  const wrongType = signed(); wrongType.headers.set('Content-Type', 'text/plain');
  assert.equal((await handleWebhookRoute(wrongType, env, noNetwork)).status, 415);
  assert.equal((await handleWebhookRoute(signed({ padding: 'x'.repeat(131073) }), env, noNetwork)).status, 413);
  const invalidUTF8 = new Request(origin + '/api/whop-webhook', { method: 'POST', headers: signed().headers, body: new Uint8Array([255]) });
  assert.equal((await handleWebhookRoute(invalidUTF8, env, noNetwork)).status, 400);
});
