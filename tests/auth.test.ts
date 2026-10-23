import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAuth, resolveSession } from '../server/auth.ts';

const origin = 'https://bud-events-website.vercel.app';
const project = 'https://cepmvqqrjcvhyzszqand.supabase.co';
const env = { BUD_AUTH_ENABLED: 'true', BUD_APP_ORIGIN: origin, SUPABASE_URL: project,
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_mock', BUD_AUTH_COOKIE_SECRET: 'test-only-secret-not-a-real-secret-0123456789' };
const id = '11111111-1111-4111-8111-111111111111';
function req(action: string, method = 'GET', cookie?: string, requestOrigin = origin) {
  return new Request(origin + '/api/auth?action=' + action, { method, headers: { Origin: requestOrigin, ...(cookie ? { cookie } : {}) } });
}
function cookies(response: Response) { return response.headers.getSetCookie().map(value => value.split(';')[0]).join('; '); }
const user = { id, identities: [{ provider: 'discord', identity_data: { full_name: 'Verified Host' } }], user_metadata: { id: 'ATTACKER', full_name: 'Untrusted Name' } };
function transportFor(options: { expires?: number; user?: unknown; onRequest?: (url: string, options?: RequestInit) => void } = {}): typeof fetch {
  return async (input, init) => {
    const url = String(input); assert.ok(url.startsWith(project + '/auth/v1/'));
    options.onRequest?.(url, init);
    if (url.endsWith('/user')) return Response.json(options.user ?? user);
    if (url.includes('/logout')) return new Response(null, { status: 204 });
    return Response.json({ access_token: 'valid-access-token-that-is-long-enough', refresh_token: 'valid-refresh-token', expires_in: options.expires ?? 3600 });
  };
}
async function login(transport = transportFor()) {
  const begin = await handleAuth(req('signin', 'POST'), env, transport);
  const authorize = new URL((await begin.json()).data.url);
  const callback = new URL(authorize.searchParams.get('redirect_to')!);
  callback.searchParams.set('code', 'auth-code');
  const complete = await handleAuth(new Request(callback, { headers: { cookie: cookies(begin) } }), env, transport);
  return { begin, authorize, callback, complete, cookie: cookies(complete) };
}

test('auth disabled or invalid configuration fails closed before network', async () => {
  const never: typeof fetch = async () => { throw new Error('network must not run'); };
  for (const change of [{ BUD_AUTH_ENABLED: 'false' }, { SUPABASE_URL: 'https://evil.example' },
    { BUD_APP_ORIGIN: origin + '/path' }, { BUD_AUTH_COOKIE_SECRET: 'short' }]) {
    assert.equal((await handleAuth(req('session'), { ...env, ...change }, never)).status, 503);
  }
});
test('signin requires exact origin and POST; redirect is fixed Discord PKCE', async () => {
  assert.equal((await handleAuth(req('signin'), env)).status, 405);
  assert.equal((await handleAuth(req('signin', 'POST', undefined, 'https://evil.example'), env)).status, 403);
  assert.equal((await handleAuth(new Request('https://evil.example/api/auth?action=session'), env)).status, 403);
  const { begin, authorize } = await login();
  assert.equal(authorize.origin, project); assert.equal(authorize.searchParams.get('provider'), 'discord');
  assert.equal(authorize.searchParams.get('code_challenge_method'), 's256');
  assert.equal(authorize.searchParams.get('code_challenge')?.length, 43);
  const header = begin.headers.getSetCookie()[0];
  for (const flag of ['__Host-bud-oauth=', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=300']) assert.ok(header.includes(flag));
  assert.equal(begin.headers.get('cache-control'), 'no-store');
});
test('callback validates encrypted state, expiry, nonce and PKCE binding', async () => {
  let calls = 0;
  const begin = await handleAuth(req('signin', 'POST'), env);
  const authorize = new URL((await begin.json()).data.url);
  const callback = new URL(authorize.searchParams.get('redirect_to')!); callback.searchParams.set('code', 'code');
  const never: typeof fetch = async () => { calls++; throw new Error('unexpected'); };
  assert.equal((await handleAuth(new Request(callback), env, never)).status, 400);
  callback.searchParams.set('bud_state', 'forged');
  assert.equal((await handleAuth(new Request(callback, { headers: { cookie: cookies(begin) } }), env, never)).status, 400);
  const forgedCookie = cookies(begin).slice(0, -8) + 'AAAAAAAA';
  assert.equal((await handleAuth(new Request(callback, { headers: { cookie: forgedCookie } }), env, never)).status, 400);
  const originalNow = Date.now; Date.now = () => originalNow() + 301000;
  try { assert.equal((await handleAuth(new Request(callback, { headers: { cookie: cookies(begin) } }), env, never)).status, 400); }
  finally { Date.now = originalNow; }
  assert.equal(calls, 0);
  const bodies: Record<string, unknown>[] = [];
  const valid = await login(transportFor({ onRequest: (url, init) => { if (url.includes('grant_type=pkce')) bodies.push(JSON.parse(String(init?.body))); } }));
  assert.equal(bodies[0].auth_code, 'auth-code'); assert.equal(String(bodies[0].code_verifier).length, 43);
  const challenge = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(bodies[0].code_verifier))));
  const encoded = btoa(String.fromCharCode(...challenge)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  assert.equal(valid.authorize.searchParams.get('code_challenge'), encoded);
});
test('session returns verified identity only, never tokens or editable user metadata', async () => {
  const { complete, cookie } = await login();
  assert.equal(complete.status, 303); assert.equal(complete.headers.get('location'), origin + '/?screen=host');
  const response = await handleAuth(req('session', 'GET', cookie), env, transportFor());
  assert.deepEqual(await response.json(), { code: 'OK', data: { id, displayName: 'Verified Host' } });
  const resolved = await resolveSession(req('session', 'GET', cookie), env, transportFor());
  assert.equal(resolved?.hostId, id); assert.deepEqual(Object.keys(resolved!), ['hostId', 'headers']);
  assert.ok(!cookie.includes('valid-access-token')); assert.ok(!cookie.includes('valid-refresh-token'));
  assert.equal((await handleAuth(req('session', 'GET', cookie + '; ' + cookie), env, transportFor())).status, 401);
  assert.equal((await handleAuth(req('session', 'GET', cookie.slice(0, -10) + 'AAAAAAAAAA'), env, transportFor())).status, 401);
});
test('email-only, anonymous and changed host sessions cannot authorize', async () => {
  for (const badUser of [{ ...user, identities: [{ provider: 'email' }], user_metadata: { provider: 'discord' } }, { ...user, is_anonymous: true }]) {
    assert.equal((await login(transportFor({ user: badUser }))).complete.status, 401);
  }
  const { cookie } = await login();
  assert.equal((await handleAuth(req('session', 'GET', cookie), env,
    transportFor({ user: { ...user, id: '22222222-2222-4222-8222-222222222222' } }))).status, 401);
});
test('access token refresh rotates authenticated cookie and verifies user again', async () => {
  const { cookie } = await login(transportFor({ expires: 1 }));
  const calls: string[] = [];
  const response = await handleAuth(req('session', 'GET', cookie), env, transportFor({ onRequest: url => calls.push(url) }));
  assert.equal(response.status, 200); assert.ok(response.headers.getSetCookie()[0].startsWith('__Host-bud-session='));
  assert.ok(calls[0].includes('grant_type=refresh_token')); assert.ok(calls[1].endsWith('/user'));
  const originalNow = Date.now; Date.now = () => originalNow() + 604801000;
  try { assert.equal((await handleAuth(req('session', 'GET', cookie), env, transportFor())).status, 401); }
  finally { Date.now = originalNow; }
});
test('logout checks CSRF, revokes upstream and clears both cookies even on failure', async () => {
  const { cookie } = await login();
  assert.equal((await handleAuth(req('logout', 'POST', cookie, 'https://evil.example'), env)).status, 403);
  const calls: string[] = [];
  const response = await handleAuth(req('logout', 'POST', cookie), env, transportFor({ onRequest: url => calls.push(url) }));
  assert.equal(response.status, 200); assert.ok(calls.some(url => url.endsWith('logout?scope=local')));
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.ok(response.headers.getSetCookie().every(value => value.includes('Max-Age=0')));
  const failed = await handleAuth(req('logout', 'POST', cookie), env, async () => { throw new Error('private diagnostics'); });
  assert.equal(failed.status, 503); assert.equal(failed.headers.getSetCookie().length, 2);
  assert.ok(!(await failed.text()).includes('private diagnostics'));
});
test('upstream failures are sanitized and unavailable session is not successful', async () => {
  const { cookie } = await login();
  const response = await handleAuth(req('session', 'GET', cookie), env, async () => new Response('private', { status: 500 }));
  assert.equal(response.status, 503); assert.equal(await response.text(), '{"code":"AUTH_UNAVAILABLE"}');
  assert.equal((await handleAuth(req('session'), env, transportFor())).status, 401);
  const oversized = await handleAuth(req('session', 'GET', cookie), env, async () => new Response('x'.repeat(65537)));
  assert.equal(oversized.status, 503);
});
