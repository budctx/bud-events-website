// Server only. This module is never imported by src/. No process-local wallet state.
export type ServerEnv = Record<string, string | undefined>;
export type Fetcher = typeof fetch;
const PROJECT_URL = 'https://cepmvqqrjcvhyzszqand.supabase.co';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const keyPattern = /^[a-zA-Z0-9_-]{16,100}$/;

export function serverEnv(): ServerEnv {
  return (globalThis as unknown as { process?: { env?: ServerEnv } }).process?.env ?? {};
}
export function json(status: number, code: string, data?: unknown): Response {
  return Response.json({ code, ...(data === undefined ? {} : { data }) }, {
    status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
function configuration(env: ServerEnv) {
  if (env.BUD_BACKEND_ENABLED !== 'true' || env.SUPABASE_URL !== PROJECT_URL
    || !env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SERVICE_ROLE_KEY || !env.BUD_APP_ORIGIN) return null;
  try {
    const origin = new URL(env.BUD_APP_ORIGIN);
    if (origin.protocol !== 'https:' || origin.origin !== env.BUD_APP_ORIGIN) return null;
    return { url: PROJECT_URL, publishable: env.SUPABASE_PUBLISHABLE_KEY,
      secret: env.SUPABASE_SERVICE_ROLE_KEY, origin: origin.origin };
  } catch { return null; }
}
type Host = { id: string };
async function verifyHost(token: string, config: NonNullable<ReturnType<typeof configuration>>, transport: Fetcher): Promise<Host | null> {
  const response = await transport(config.url + '/auth/v1/user', {
    headers: { apikey: config.publishable, Authorization: 'Bearer ' + token },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const user = await response.json() as { id?: unknown; identities?: { provider?: unknown }[] };
  // Identity comes from Auth's verified user endpoint, never user_metadata/client JSON.
  if (typeof user.id !== 'string' || !uuid.test(user.id)
    || !Array.isArray(user.identities) || !user.identities.some(identity => identity.provider === 'discord')) return null;
  return { id: user.id };
}

/** Purchaser-only API. Public browsing and local rehearsal never call this endpoint. */
export async function handleCommerce(request: Request, env: ServerEnv = serverEnv(), transport: Fetcher = fetch): Promise<Response> {
  if (request.method !== 'POST') return json(405, 'METHOD_NOT_ALLOWED');
  const authorization = request.headers.get('authorization') ?? '';
  const bearer = /^Bearer ([A-Za-z0-9._~-]{20,8192})$/.exec(authorization);
  if (!bearer) return json(401, 'DISCORD_AUTH_REQUIRED');
  const config = configuration(env);
  if (!config) return json(503, 'BACKEND_NOT_CONFIGURED');
  if (request.headers.get('origin') !== config.origin) return json(403, 'ORIGIN_DENIED');
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json(415, 'JSON_REQUIRED');
  try {
    const host = await verifyHost(bearer[1], config, transport);
    if (!host) return json(401, 'DISCORD_AUTH_REQUIRED');
    const text = await request.text();
    if (text.length > 8192) return json(413, 'REQUEST_TOO_LARGE');
    let body: Record<string, unknown>;
    try { body = JSON.parse(text); } catch { return json(400, 'INVALID_JSON'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, 'INVALID_REQUEST');
    // Reject identity/price/payment authority supplied by the client.
    if (['hostId', 'userId', 'credits', 'amount', 'paymentId', 'verified'].some(key => key in body)) return json(400, 'CLIENT_AUTHORITY_DENIED');
    if (body.action === 'checkout') return json(503, 'CHECKOUT_NOT_CONFIGURED');
    const actions: Record<string, { rpc: string; params: Record<string, unknown> }> = {
      balance: { rpc: 'bud_slot_balance', params: {} },
    };
    if (body.action === 'start') {
      if (typeof body.idempotencyKey !== 'string' || !keyPattern.test(body.idempotencyKey)
        || typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 100) return json(400, 'INVALID_EVENT');
      actions.start = { rpc: 'bud_start_event', params: { p_key: body.idempotencyKey, p_title: body.title.trim() } };
    }
    if (body.action === 'resume') {
      if (typeof body.eventId !== 'string' || !uuid.test(body.eventId)) return json(400, 'INVALID_EVENT');
      actions.resume = { rpc: 'bud_resume_event', params: { p_event: body.eventId } };
    }
    const action = typeof body.action === 'string' && Object.hasOwn(actions, body.action) ? actions[body.action] : undefined;
    if (!action) return json(400, 'UNKNOWN_ACTION');
    const response = await transport(config.url + '/rest/v1/rpc/' + action.rpc, {
      method: 'POST', headers: { apikey: config.secret, Authorization: 'Bearer ' + config.secret, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...action.params, p_host: host.id }), signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      // Do not return database diagnostics, tokens, or raw upstream bodies.
      const error = await response.json().catch(() => ({})) as { message?: string };
      if (error.message === 'BUD_NO_CREDIT') return json(409, 'NO_SLOT_CREDIT');
      if (error.message === 'BUD_ACTIVE_EVENT') return json(409, 'ACTIVE_EVENT_EXISTS');
      if (error.message === 'BUD_KEY_REUSED') return json(409, 'IDEMPOTENCY_KEY_REUSED');
      if (error.message === 'BUD_EVENT_NOT_FOUND') return json(404, 'EVENT_NOT_FOUND');
      return json(503, 'BACKEND_UNAVAILABLE');
    }
    return json(200, 'OK', await response.json());
  } catch {
    // Fixed code only: no PII, access tokens, request body or provider payload in logs.
    console.error('bud_commerce_upstream_unavailable');
    return json(503, 'BACKEND_UNAVAILABLE');
  }
}

/** No payment fulfillment path is enabled until the reviewed Whop verifier exists. */
export async function handleWhopWebhook(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, 'METHOD_NOT_ALLOWED');
  return json(503, 'WHOP_VERIFIER_NOT_CONFIGURED');
}
