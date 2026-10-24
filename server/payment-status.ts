import { resolveSession } from './auth.ts';
import { enforceRateLimit } from './rate-limit.ts';
import { liveBackend, liveResponse, liveRpc } from './live-commerce.ts';
import { boundedProviderText } from './whop.ts';
import type { CommerceEnv } from './whop.ts';
import { liveAudience, liveHostAllowed } from './live-access.ts';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const environment = (): CommerceEnv => (globalThis as unknown as { process?: { env?: CommerceEnv } }).process?.env ?? {};
export async function handlePaymentStatus(request: Request, env: CommerceEnv = environment(), transport: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'POST') return liveResponse(405, 'METHOD_NOT_ALLOWED');
  const secret = liveBackend(env);
  if (env.BUD_LIVE_RECEIPTS_ENABLED !== 'true' || !secret || env.BUD_AUTH_ENABLED !== 'true' || !liveAudience(env))
    return liveResponse(503, 'PAYMENT_STATUS_UNAVAILABLE');
  const url = new URL(request.url);
  if (url.origin !== env.BUD_APP_ORIGIN || request.headers.get('origin') !== env.BUD_APP_ORIGIN) return liveResponse(403, 'ORIGIN_DENIED');
  if (url.search || request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return liveResponse(400, 'INVALID_STATUS_REQUEST');
  let refreshed: Headers | undefined;
  try {
    const limited = await enforceRateLimit(request, env, transport, 'host'); if (limited) return limited;
    const session = await resolveSession(request, env, transport); if (!session) return liveResponse(401, 'DISCORD_AUTH_REQUIRED');
    refreshed = session.headers;
    if (!liveHostAllowed(session.hostId, env)) return liveResponse(403, 'PILOT_HOST_REQUIRED', undefined, refreshed);
    let body: unknown;
    try { body = JSON.parse(await boundedProviderText(request.body, 1024)); }
    catch { return liveResponse(400, 'INVALID_STATUS_REQUEST', undefined, refreshed); }
    if (!object(body) || Object.keys(body).length !== 1 || typeof body.orderId !== 'string' || !uuid.test(body.orderId)) return liveResponse(400, 'INVALID_STATUS_REQUEST', undefined, refreshed);
    const data = await liveRpc('bud_live_payment_status', { p_host: session.hostId, p_order: body.orderId }, secret, transport);
    if (data === null) return liveResponse(404, 'ORDER_NOT_FOUND', undefined, refreshed);
    if (!object(data) || data.orderId !== body.orderId || !['pending','confirmed','review','refunded','disputed'].includes(String(data.state))
      || data.currency !== 'sar' || !Number.isSafeInteger(data.amountMinor) || Number(data.amountMinor) < 1
      || typeof data.createdAt !== 'string' || !(data.checkedAt === null || typeof data.checkedAt === 'string')) throw new Error();
    return liveResponse(200, 'OK', { orderId: data.orderId, state: data.state, currency: data.currency, amountMinor: data.amountMinor,
      createdAt: data.createdAt, checkedAt: data.checkedAt }, refreshed);
  } catch { return liveResponse(503, 'PAYMENT_STATUS_UNAVAILABLE', undefined, refreshed); }
}
