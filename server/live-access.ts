import type { CommerceEnv } from './whop.ts';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Server-owned audience gate. Public means verified Discord customers, never anonymous callers. */
export function liveAudience(env: CommerceEnv): 'pilot' | 'public' | null {
  if (env.BUD_WHOP_PRODUCTION_MODE === 'pilot' && uuid.test(env.BUD_WHOP_PILOT_HOST_ID ?? '')) return 'pilot';
  if (env.BUD_WHOP_PRODUCTION_MODE === 'public' && env.BUD_PUBLIC_COMMERCE_ENABLED === 'true') return 'public';
  return null;
}
export function liveHostAllowed(hostId: string, env: CommerceEnv): boolean {
  const audience = liveAudience(env);
  return uuid.test(hostId) && (audience === 'public' || (audience === 'pilot' && hostId === env.BUD_WHOP_PILOT_HOST_ID));
}
