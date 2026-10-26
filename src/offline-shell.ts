/** Public static files only; authorization and financial APIs are never cached. */
export function prepareOfflineShell(){
 if(!import.meta.env.PROD||!('serviceWorker' in navigator))return;
 void navigator.serviceWorker.register('/sw.js',{scope:'/'}).then(async()=>{
  const registration=await navigator.serviceWorker.ready;
  const urls=performance.getEntriesByType('resource').map(r=>r.name).filter(name=>{try{const url=new URL(name);return url.origin===location.origin&&url.pathname.startsWith('/assets/')&&!url.search;}catch{return false;}});
  registration.active?.postMessage({type:'CACHE_PUBLIC_ASSETS',urls});
 }).catch(()=>{/* Gameplay and local saving work without an offline shell; offline reload needs cached files. */});
}
