/* Cache public application files only. No API responses, sessions or user gameplay. */
const CACHE='bud-public-app-v1';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.add(new Request('/',{credentials:'omit'}))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});
self.addEventListener('message',event=>{
 if(event.data?.type!=='CACHE_PUBLIC_ASSETS'||!Array.isArray(event.data.urls))return;
 event.waitUntil((async()=>{const cache=await caches.open(CACHE);for(const candidate of event.data.urls.slice(0,100)){try{const url=new URL(candidate,self.location.origin);if(url.origin===self.location.origin&&url.pathname.startsWith('/assets/')&&!url.search)await cache.add(new Request(url,{credentials:'omit'}));}catch{/* Offline assets remain unavailable until loaded online. */}}event.ports?.[0]?.postMessage('ready');})());
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(request.mode==='navigate'&&['/','/events','/bots','/designs','/policies'].includes(url.pathname.replace(/\/$/,'')||'/')){
  event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(request);if(response.ok&&response.headers.get('content-type')?.includes('text/html'))await cache.put('/',response.clone());return response;}catch{const cached=await cache.match('/');return cached??Response.error();}})());return;
 }
 if(url.pathname.startsWith('/assets/')&&!url.search){event.respondWith((async()=>{const cache=await caches.open(CACHE);const prior=await cache.match(request,{ignoreVary:true});if(prior)return prior;const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response;})());}
});
