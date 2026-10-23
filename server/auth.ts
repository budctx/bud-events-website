// Server only: no Auth tokens or cookie secret are exposed to browser JavaScript.
import { enforceRateLimit } from './rate-limit.ts';
export type AuthEnv = Record<string, string | undefined>;
type Transport = typeof fetch;
const PROJECT = 'https://cepmvqqrjcvhyzszqand.supabase.co';
const SESSION = '__Host-bud-session';
const FLOW = '__Host-bud-oauth';
const WEEK = 604800;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();
function environment(): AuthEnv { return (globalThis as unknown as { process?: { env?: AuthEnv } }).process?.env ?? {}; }
function config(env: AuthEnv) {
  if (env.BUD_AUTH_ENABLED !== 'true' || env.SUPABASE_URL !== PROJECT || !env.SUPABASE_PUBLISHABLE_KEY
    || !env.BUD_AUTH_COOKIE_SECRET || encoder.encode(env.BUD_AUTH_COOKIE_SECRET).length < 32 || !env.BUD_APP_ORIGIN) return null;
  try {
    const url = new URL(env.BUD_APP_ORIGIN);
    if (url.protocol !== 'https:' || url.origin !== env.BUD_APP_ORIGIN) return null;
    return { origin: url.origin, key: env.SUPABASE_PUBLISHABLE_KEY, secret: env.BUD_AUTH_COOKIE_SECRET };
  } catch { return null; }
}
type Config = NonNullable<ReturnType<typeof config>>;
function b64(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('INVALID_COOKIE');
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
}
function random(): string { return b64(crypto.getRandomValues(new Uint8Array(32))); }
async function key(secret: string) {
  return crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', encoder.encode(secret)), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function seal(value: object, purpose: string, settings: Config): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(purpose + settings.origin) }, await key(settings.secret), encoder.encode(JSON.stringify(value)));
  const output = b64(iv) + '.' + b64(new Uint8Array(ciphertext));
  if (output.length > 3800) throw new Error('COOKIE_TOO_LARGE');
  return output;
}
async function open(request: Request, name: string, settings: Config): Promise<Record<string, unknown> | null> {
  const raw = request.headers.get('cookie') ?? '';
  if (raw.length > 16384) return null;
  const matches = raw.split(';').map(part => part.trim()).filter(part => part.startsWith(name + '='));
  if (matches.length !== 1) return null;
  const value = matches[0].slice(name.length + 1);
  if (value.length > 3800) return null;
  try {
    const [iv, encrypted, extra] = value.split('.');
    if (extra !== undefined || unb64(iv).length !== 12) return null;
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv), additionalData: encoder.encode(name + settings.origin) }, await key(settings.secret), unb64(encrypted));
    const data = JSON.parse(new TextDecoder().decode(plaintext));
    if (!data || typeof data !== 'object' || !Number.isSafeInteger(data.exp) || data.exp <= Date.now() / 1000) return null;
    return data;
  } catch { return null; }
}
function cookie(name: string, value = '', age = 0): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
}
function headers(): Headers { return new Headers({ 'Cache-Control': 'no-store', 'Pragma': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }); }
function result(status: number, code: string, data?: unknown, extra?: Headers): Response {
  const responseHeaders = headers();
  if (extra) for (const [name, value] of extra) if (name !== 'set-cookie') responseHeaders.set(name, value);
  if (extra) for (const value of extra.getSetCookie()) responseHeaders.append('Set-Cookie', value);
  return Response.json({ code, ...(data === undefined ? {} : { data }) }, { status, headers: responseHeaders });
}
async function upstream(path: string, settings: Config, transport: Transport, options: RequestInit = {}): Promise<Response> {
  const requestHeaders = new Headers(options.headers);
  requestHeaders.set('apikey', settings.key);
  return transport(PROJECT + '/auth/v1/' + path, { ...options, headers: requestHeaders, signal: AbortSignal.timeout(8000), redirect: 'error' });
}
async function readJson(response: Response): Promise<Record<string, unknown>> {
  // Auth is trusted upstream, but still bound responses before parsing.
  const reader = response.body?.getReader();
  if (!reader) throw new Error('EMPTY_UPSTREAM');
  let text = ''; let size = 0; const decoder = new TextDecoder();
  while (true) {
    const part = await reader.read(); if (part.done) break;
    size += part.value.length;
    if (size > 65536) { await reader.cancel(); throw new Error('UPSTREAM_TOO_LARGE'); }
    text += decoder.decode(part.value, { stream: true });
  }
  const value = JSON.parse(text + decoder.decode());
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_UPSTREAM');
  return value;
}
async function verifiedUser(access: string, settings: Config, transport: Transport) {
  const response = await upstream('user', settings, transport, { headers: { Authorization: 'Bearer ' + access } });
  if (response.status >= 500 || response.status === 429) throw new Error('UPSTREAM_UNAVAILABLE');
  if (!response.ok) return null;
  const user = await readJson(response);
  if (typeof user.id !== 'string' || !uuid.test(user.id) || user.is_anonymous === true || !Array.isArray(user.identities)) return null;
  const discord = user.identities.find(identity => identity && identity.provider === 'discord');
  if (!discord) return null;
  // Display data is never authorization authority. Ignore editable user_metadata entirely.
  const display = discord.identity_data?.full_name;
  return { id: user.id, displayName: typeof display === 'string' && display.trim() ? display.trim().slice(0, 80) : 'Host' };
}
type Session = { access: string; refresh: string; accessExp: number; exp: number; hostId: string };
function tokens(data: Record<string, unknown>, exp: number): Omit<Session, 'hostId'> | null {
  if (typeof data.access_token !== 'string' || data.access_token.length < 20 || data.access_token.length > 2400
    || typeof data.refresh_token !== 'string' || data.refresh_token.length < 10 || data.refresh_token.length > 512
    || typeof data.expires_in !== 'number' || !Number.isSafeInteger(data.expires_in) || data.expires_in < 1 || data.expires_in > 86400) return null;
  return { access: data.access_token, refresh: data.refresh_token, accessExp: Math.floor(Date.now() / 1000) + data.expires_in, exp };
}
async function resolve(request: Request, settings: Config, transport: Transport) {
  const data = await open(request, SESSION, settings);
  if (!data || typeof data.access !== 'string' || typeof data.refresh !== 'string' || typeof data.accessExp !== 'number'
    || typeof data.hostId !== 'string' || !uuid.test(data.hostId)) return null;
  let session = data as Session; let rotated = false;
  if (session.accessExp <= Date.now() / 1000 + 30) {
    const response = await upstream('token?grant_type=refresh_token', settings, transport, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refresh }),
    });
    if (!response.ok) return null;
    const next = tokens(await readJson(response), session.exp); if (!next) return null;
    session = { ...next, hostId: session.hostId }; rotated = true;
  }
  const user = await verifiedUser(session.access, settings, transport);
  if (!user || user.id !== session.hostId) return null;
  const responseHeaders = new Headers();
  if (rotated) responseHeaders.append('Set-Cookie', cookie(SESSION, await seal(session, SESSION, settings), Math.max(0, Math.floor(session.exp - Date.now() / 1000))));
  return { hostId: user.id, displayName: user.displayName, headers: responseHeaders, access: session.access };
}
/** Protected APIs must forward returned Set-Cookie headers after a refresh. Never return tokens. */
export async function resolveSession(request: Request, env: AuthEnv, transport: Transport = fetch): Promise<{ hostId: string; headers: Headers } | null> {
  const settings = config(env); if (!settings) return null;
  const session = await resolve(request, settings, transport);
  return session ? { hostId: session.hostId, headers: session.headers } : null;
}
export async function handleAuth(request: Request, env: AuthEnv = environment(), transport: Transport = fetch): Promise<Response> {
  const settings = config(env);
  if (!settings) return result(503, 'AUTH_NOT_CONFIGURED');
  const url = new URL(request.url); const action = url.searchParams.get('action');
  if (url.origin !== settings.origin) return result(403, 'ORIGIN_DENIED');
  if (request.method === 'POST' && request.headers.get('origin') !== settings.origin) return result(403, 'ORIGIN_DENIED');
  if ((action === 'signin' || action === 'logout') && request.method !== 'POST'
    || (action === 'session' || action === 'callback') && request.method !== 'GET') return result(405, 'METHOD_NOT_ALLOWED');
  if (action === 'signin' || action === 'session' || action === 'callback' || action === 'logout') {
    const limited = await enforceRateLimit(request, env, transport, `auth-${action}`);
    if (limited) {
      if (action === 'logout') { limited.headers.append('Set-Cookie',cookie(SESSION)); limited.headers.append('Set-Cookie',cookie(FLOW)); }
      return limited;
    }
  }
  try {
    if (action === 'signin') {
      const state = random(); const verifier = random();
      const callback = new URL('/api/auth', settings.origin); callback.searchParams.set('action', 'callback'); callback.searchParams.set('bud_state', state);
      const authorize = new URL(PROJECT + '/auth/v1/authorize');
      authorize.searchParams.set('provider', 'discord'); authorize.searchParams.set('redirect_to', callback.href);
      authorize.searchParams.set('code_challenge', b64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier)))));
      authorize.searchParams.set('code_challenge_method', 's256');
      const responseHeaders = new Headers();
      responseHeaders.append('Set-Cookie', cookie(FLOW, await seal({ state, verifier, exp: Math.floor(Date.now() / 1000) + 300 }, FLOW, settings), 300));
      return result(200, 'OK', { url: authorize.href }, responseHeaders);
    }
    if (action === 'callback') {
      const responseHeaders = new Headers(); responseHeaders.append('Set-Cookie', cookie(FLOW));
      const flow = await open(request, FLOW, settings); const state = url.searchParams.get('bud_state'); const code = url.searchParams.get('code');
      if (!flow || typeof flow.state !== 'string' || flow.state !== state || typeof flow.verifier !== 'string'
        || !code || code.length > 2048 || url.searchParams.has('error')) return result(400, 'INVALID_AUTH_CALLBACK', undefined, responseHeaders);
      const exchange = await upstream('token?grant_type=pkce', settings, transport, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auth_code: code, code_verifier: flow.verifier }),
      });
      if (!exchange.ok) return result(401, 'AUTH_FAILED', undefined, responseHeaders);
      const session = tokens(await readJson(exchange), Math.floor(Date.now() / 1000) + WEEK);
      const user = session ? await verifiedUser(session.access, settings, transport) : null;
      if (!session || !user) return result(401, 'DISCORD_AUTH_REQUIRED', undefined, responseHeaders);
      responseHeaders.append('Set-Cookie', cookie(SESSION, await seal({ ...session, hostId: user.id }, SESSION, settings), WEEK));
      const finalHeaders = headers(); finalHeaders.set('Location', settings.origin + '/?screen=host');
      for (const value of responseHeaders.getSetCookie()) finalHeaders.append('Set-Cookie', value);
      return new Response(null, { status: 303, headers: finalHeaders });
    }
    if (action === 'session') {
      const session = await resolve(request, settings, transport);
      return session ? result(200, 'OK', { id: session.hostId, displayName: session.displayName }, session.headers) : result(401, 'DISCORD_AUTH_REQUIRED');
    }
    if (action === 'logout') {
      const responseHeaders = new Headers(); responseHeaders.append('Set-Cookie', cookie(SESSION)); responseHeaders.append('Set-Cookie', cookie(FLOW));
      // Always clear local cookies, even if upstream revocation is unavailable.
      try {
        const session = await resolve(request, settings, transport);
        if (session) {
          const revoked = await upstream('logout?scope=local', settings, transport, { method: 'POST', headers: { Authorization: 'Bearer ' + session.access } });
          if (!revoked.ok && revoked.status !== 401) return result(503, 'AUTH_REVOCATION_UNAVAILABLE', undefined, responseHeaders);
        }
      } catch { return result(503, 'AUTH_REVOCATION_UNAVAILABLE', undefined, responseHeaders); }
      return result(200, 'OK', { signedOut: true }, responseHeaders);
    }
    return result(400, 'UNKNOWN_ACTION');
  } catch { return result(503, 'AUTH_UNAVAILABLE'); }
}
