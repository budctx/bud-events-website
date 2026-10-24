import { handleCheckout } from './checkout.ts';
import { handleWhopWebhook, json, serverEnv } from './commerce.ts';
import { handleHost, handleLiveHost } from './host.ts';
import { handleProductionCheckout, handleProductionWebhook } from './live-commerce.ts';
import type { CommerceEnv } from './whop.ts';
import { handleWhopWebhookVerification } from './whop-webhook-verification.ts';
type Handler = (request: Request, env: CommerceEnv, transport: typeof fetch) => Promise<Response>;
/** Runtime-only selection. A disabled live handler never falls back to a Sandbox wallet. */
function route(request: Request, env: CommerceEnv, transport: typeof fetch, sandbox: Handler, live: Handler) {
  const mode = env.BUD_COMMERCE_MODE ?? 'sandbox';
  if (mode === 'sandbox') return sandbox(request, env, transport);
  if (mode !== 'live' || env.VERCEL_ENV !== 'production' || env.WHOP_ENVIRONMENT !== 'production')
    return Promise.resolve(json(503, 'COMMERCE_MODE_UNAVAILABLE'));
  return live(request, env, transport);
}
export const handleCheckoutRoute = (request: Request, env: CommerceEnv = serverEnv(), transport: typeof fetch = fetch) =>
  route(request, env, transport, handleCheckout, handleProductionCheckout);
export const handleHostRoute = (request: Request, env: CommerceEnv = serverEnv(), transport: typeof fetch = fetch) =>
  route(request, env, transport, handleHost, handleLiveHost);
export const handleWebhookRoute = (request: Request, env: CommerceEnv = serverEnv(), transport: typeof fetch = fetch) =>
  env.BUD_WHOP_WEBHOOK_VERIFY_ONLY_ENABLED === 'true'
    ? handleWhopWebhookVerification(request, env)
    : route(request, env, transport, handleWhopWebhook, handleProductionWebhook);
