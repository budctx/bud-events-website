import { verifyWhopEnvelope, WhopError } from './whop.ts';
import type { CommerceEnv } from './whop.ts';

const financialFlags = ['BUD_WHOP_PRODUCTION_ENABLED', 'BUD_WHOP_PRODUCTION_PROCESSING_ENABLED',
  'BUD_PAYMENT_WORKER_ENABLED', 'BUD_LIVE_HOST_ENABLED', 'BUD_LIVE_RECEIPTS_ENABLED'] as const;
/** A temporary delivery check, deliberately without a transport or database dependency. */
export async function handleWhopWebhookVerification(request: Request, env: CommerceEnv): Promise<Response> {
  const result = (status: number, code: string, data?: object) => Response.json({ code, ...(data ? { data } : {}) }, {
    status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' },
  });
  if (request.method !== 'POST') return result(405, 'METHOD_NOT_ALLOWED');
  if (env.BUD_WHOP_WEBHOOK_VERIFY_ONLY_ENABLED !== 'true' || env.VERCEL_ENV !== 'production'
    || financialFlags.some(flag => env[flag] !== 'false')
    || ![undefined, 'false'].includes(env.BUD_PUBLIC_COMMERCE_ENABLED)
    || ![undefined, 'sandbox'].includes(env.BUD_COMMERCE_MODE)
    || ![undefined, 'false'].includes(env.BUD_WHOP_SANDBOX_ENABLED)) return result(503, 'WEBHOOK_VERIFICATION_NOT_CONFIGURED');
  const secret = env.WHOP_PRODUCTION_WEBHOOK_SECRET ?? '', company = env.WHOP_PRODUCTION_COMPANY_ID ?? '';
  const version = env.WHOP_PRODUCTION_WEBHOOK_API_VERSION ?? '';
  if (!/^ws_[A-Za-z0-9]{32,128}$/.test(secret) || !/^biz_[A-Za-z0-9]{5,80}$/.test(company)
    || !['2026-08-14', '2026-10-15-1'].includes(version)) return result(503, 'WEBHOOK_VERIFICATION_NOT_CONFIGURED');
  const url = new URL(request.url);
  if (env.BUD_APP_ORIGIN !== 'https://bud-events-website.vercel.app' || url.origin !== env.BUD_APP_ORIGIN
    || url.pathname !== '/api/whop-webhook' || url.search) return result(400, 'INVALID_WEBHOOK_ENDPOINT');
  try {
    const envelope = await verifyWhopEnvelope(request, secret, company, version);
    if (envelope.type !== 'payment.succeeded') return result(400, 'UNSUPPORTED_WEBHOOK_EVENT');
    // No identifiers/body/signature are logged, stored or returned. Replays never create business effects.
    return result(200, 'WEBHOOK_VERIFIED_ONLY', { signatureVerified: true, accountMatched: true, apiVersion: 'v1',
      apiVersionDate: version, queued: false, paymentLookedUp: false, credited: false });
  } catch (error) {
    return error instanceof WhopError ? result(error.status, error.code) : result(400, 'INVALID_WEBHOOK_BODY');
  }
}
