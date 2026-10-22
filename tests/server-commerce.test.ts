import test from 'node:test';
import assert from 'node:assert/strict';
import { handleCommerce, handleWhopWebhook } from '../server/commerce.ts';
import type { ServerEnv, Fetcher } from '../server/commerce.ts';
const host = '132ccbd6-7581-41ac-a5f5-dc301334b7ba';
const event = '232ccbd6-7581-41ac-a5f5-dc301334b7ba';
const env: ServerEnv = { BUD_BACKEND_ENABLED: 'true', SUPABASE_URL: 'https://cepmvqqrjcvhyzszqand.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'public-test-key', SUPABASE_SERVICE_ROLE_KEY: 'server-test-secret', BUD_APP_ORIGIN: 'https://preview.example' };
function request(body: unknown, authorization = 'Bearer test-token-12345678901234567890', origin = env.BUD_APP_ORIGIN!) {
  return new Request('https://preview.example/api/commerce', { method: 'POST',
    headers: { authorization, origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
const mustNotCall = (async () => { assert.fail('No upstream call permitted'); }) as Fetcher;
test('unauthenticated requests never reach backend; missing config fails closed', async () => {
  assert.equal((await handleCommerce(request({ action: 'start' }, ''), {}, mustNotCall)).status, 401);
  assert.equal((await handleCommerce(request({ action: 'balance' }), {}, mustNotCall)).status, 503);
  assert.equal((await handleCommerce(request({ action: 'balance' }, undefined, 'https://attacker.example'), env, mustNotCall)).status, 403);
});
test('Auth server rejection and email-only identities cannot purchase or mutate', async () => {
  for (const reply of [new Response('{}', { status: 401 }), Response.json({ id: host, identities: [{ provider: 'email' }] })]) {
    let count = 0;
    const transport = (async () => { count++; return reply; }) as Fetcher;
    assert.equal((await handleCommerce(request({ action: 'start' }), env, transport)).status, 401);
    assert.equal(count, 1);
  }
});
test('verified server user controls host binding; stable start key reaches one transactional RPC', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const transport = (async (url, init) => { calls.push({ url: String(url), init });
    return String(url).endsWith('/auth/v1/user') ? Response.json({ id: host, identities: [{ provider: 'discord' }] }) : Response.json({ id: event }); }) as Fetcher;
  const body = { action: 'start', title: '  Game  ', idempotencyKey: 'stable-start-key-12345678' };
  for (let i = 0; i < 2; i++) assert.equal((await handleCommerce(request(body), env, transport)).status, 200);
  const rpc = calls.filter(c => c.url.includes('/rpc/'));
  assert.equal(rpc.length, 2);
  assert.deepEqual(JSON.parse(String(rpc[0].init?.body)), { p_key: body.idempotencyKey, p_title: 'Game', p_host: host });
  assert.equal(rpc[0].init?.body, rpc[1].init?.body);
  // Transport contract is tested; this does NOT claim actual SQL concurrency was run.
});
test('client identity/credit/payment injection is rejected after auth; checkout is unavailable', async () => {
  const auth = (async (url) => { assert.ok(String(url).endsWith('/auth/v1/user')); return Response.json({ id: host, identities: [{ provider: 'discord' }] }); }) as Fetcher;
  for (const field of ['hostId', 'userId', 'credits', 'amount', 'paymentId', 'verified']) {
    assert.equal((await handleCommerce(request({ action: 'balance', [field]: 'spoof' }), env, auth)).status, 400);
  }
  assert.equal((await handleCommerce(request({ action: 'checkout' }), env, auth)).status, 503);
  for (const action of ['__proto__','constructor','unknown']) {
    assert.equal((await handleCommerce(request({ action }), env, auth)).status, 400);
  }
});
test('resume uses separate read-only RPC, preserving host ownership and event ID', async () => {
  const transport = (async (url, init) => {
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: host, identities: [{ provider: 'discord' }] });
    assert.ok(String(url).endsWith('/rpc/bud_resume_event'));
    assert.deepEqual(JSON.parse(String(init?.body)), { p_event: event, p_host: host });
    return Response.json({ id: event });
  }) as Fetcher;
  assert.equal((await handleCommerce(request({ action: 'resume', eventId: event }), env, transport)).status, 200);
});
test('provider-looking webhook cannot issue credits without reviewed verifier', async () => {
  const reply = await handleWhopWebhook(new Request('https://preview.example/api/whop-webhook', { method: 'POST',
    headers: { 'webhook-signature': 'v1,spoofed' }, body: JSON.stringify({ type: 'payment.succeeded', data: { id: 'pay_fake' } }) }));
  assert.equal(reply.status, 503);
  assert.deepEqual(await reply.json(), { code: 'WHOP_VERIFIER_NOT_CONFIGURED' });
});
