/** Public static files only; authorization and financial APIs are never cached. */
const publicAssetUrls = () => Array.from(new Set(performance.getEntriesByType('resource')
  .map(entry => entry.name)
  .filter(name => {
    try {
      const url = new URL(name);
      return url.origin === location.origin && url.pathname.startsWith('/assets/') && !url.search;
    } catch { return false; }
  })));

export async function primePublicOfflineAssets() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const urls = publicAssetUrls();
  if (!urls.length) return;
  // Lazy-loaded game modules arrive after the startup warmup. Ask the active
  // worker to cache those public resources as soon as the local game mounts.
  (navigator.serviceWorker.controller ?? registration.active)?.postMessage({
    type: 'CACHE_PUBLIC_ASSETS', urls,
  });
}

export function prepareOfflineShell() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  void navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .then(() => primePublicOfflineAssets())
    .catch(() => {
      /* Local gameplay still works; offline reload requires cached public files. */
    });
}
