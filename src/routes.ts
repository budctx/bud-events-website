export const publicPaths = {home:'/',events:'/events',bots:'/bots',designs:'/designs',policies:'/policies'} as const;
export type PublicPage = keyof typeof publicPaths;
export function readPublicPage(url: URL): PublicPage {
  const path = url.pathname.replace(/\/$/, '') || '/';
  const match = (Object.keys(publicPaths) as PublicPage[]).find(page => publicPaths[page] === path);
  if (path !== '/' && match) return match;
  const screen = url.searchParams.get('screen');
  return screen === 'policies' || screen === 'bots' || screen === 'designs' ? screen : ['events','host','game','local'].includes(screen ?? '') ? 'events' : 'home';
}
export function publicRoute(page: PublicPage, source: URL, panel: string | null = null): string {
  const query = new URLSearchParams();
  // Only functional parameters survive normalization; never carry login credentials into navigation.
  if (page === 'events') for (const key of ['order','check','promoCode','coupon']) {
    const value = source.searchParams.get(key); if (value) query.set(key,value);
  }
  if (panel) query.set('panel',panel);
  return publicPaths[page] + (query.size ? '?' + query.toString() : '') + (page === 'policies' ? source.hash : '');
}
