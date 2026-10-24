import { resolveSession } from './auth.ts';
import { enforceRateLimit } from './rate-limit.ts';
import { inspectProductionPlan, productionPlanExpectation, ProductionPlanMismatch } from './whop-production.ts';
import { boundedProviderText, WhopError } from './whop.ts';
import type { CommerceEnv } from './whop.ts';

const PROJECT = 'https://cepmvqqrjcvhyzszqand.supabase.co';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function environment(): CommerceEnv { return (globalThis as unknown as { process?: { env?: CommerceEnv } }).process?.env ?? {}; }

/** Owner-only inspection in the runtime that already owns the secret. Never creates an order, checkout or credit. */
export async function handleWhopPreflight(request: Request, env: CommerceEnv = environment(), transport: typeof fetch = fetch): Promise<Response> {
  let sessionHeaders: Headers | undefined;
  const result = (status: number, code: string, data?: unknown) => {
    const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    if (sessionHeaders) for (const cookie of sessionHeaders.getSetCookie()) headers.append('Set-Cookie', cookie);
    return Response.json({ code, ...(data === undefined ? {} : { data }) }, { status, headers });
  };
  if (request.method !== 'POST') return result(405, 'METHOD_NOT_ALLOWED');
  const config = productionPlanExpectation(env);
  if (env.BUD_WHOP_PREFLIGHT_ENABLED !== 'true' || !config || !uuid.test(env.BUD_WHOP_PILOT_HOST_ID ?? '')
    || env.BUD_BACKEND_ENABLED !== 'true' || env.BUD_AUTH_ENABLED !== 'true' || env.SUPABASE_URL !== PROJECT || !env.SUPABASE_SERVICE_ROLE_KEY) return result(503, 'WHOP_PREFLIGHT_NOT_CONFIGURED');
  // This diagnostic has no dependency on sales flags or an enabled commerce control.
  let origin: URL;
  try { origin = new URL(env.BUD_APP_ORIGIN ?? ''); } catch { return result(503, 'WHOP_PREFLIGHT_NOT_CONFIGURED'); }
  if (origin.protocol !== 'https:' || origin.origin !== env.BUD_APP_ORIGIN) return result(503, 'WHOP_PREFLIGHT_NOT_CONFIGURED');
  if (new URL(request.url).origin !== origin.origin || request.headers.get('origin') !== origin.origin) return result(403, 'ORIGIN_DENIED');
  if (new URL(request.url).search) return result(400, 'EMPTY_PREFLIGHT_REQUIRED');
  // Hosting adapters may provide an empty stream for a zero-byte POST.
  try { if (request.body && await boundedProviderText(request.body, 0) !== '') return result(400, 'EMPTY_PREFLIGHT_REQUIRED'); }
  catch { return result(400, 'EMPTY_PREFLIGHT_REQUIRED'); }
  try {
    const limited = await enforceRateLimit(request, env, transport, 'checkout');
    if (limited) return limited;
    const session = await resolveSession(request, env, transport);
    if (!session) return result(401, 'DISCORD_AUTH_REQUIRED');
    sessionHeaders = session.headers;
    if (session.hostId !== env.BUD_WHOP_PILOT_HOST_ID) return result(403, 'PILOT_HOST_REQUIRED');
    const hostLimited = await enforceRateLimit(request, env, transport, 'checkout', session.hostId);
    if (hostLimited) {
      if (sessionHeaders) for (const cookie of sessionHeaders.getSetCookie()) hostLimited.headers.append('Set-Cookie', cookie);
      return hostLimited;
    }
    const plan = await inspectProductionPlan(config, transport);
    return result(200, 'OK', { ...plan, checkoutCreated: false, paymentCreated: false, creditGranted: false });
  } catch (error) {
    if (error instanceof ProductionPlanMismatch) return result(409, error.code, { mismatches: error.fields });
    return error instanceof WhopError ? result(error.status, error.code) : result(503, 'WHOP_PREFLIGHT_UNAVAILABLE');
  }
}
