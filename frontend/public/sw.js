const SHELL_CACHE='mmc-shell-v1';
const RUNTIME_CACHE='mmc-runtime-v1';
const APP_SHELL=['/','/index.html'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(SHELL_CACHE).then(c=>c.addAll(APP_SHELL)).catch(()=>Promise.resolve()));});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>![SHELL_CACHE,RUNTIME_CACHE].includes(k)).map(k=>caches.delete(k)));await self.clients.claim();})());});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==self.location.origin||u.pathname.startsWith('/api/'))return;e.respondWith((async()=>{const c=await caches.open(RUNTIME_CACHE);try{const r=await fetch(e.request);if(r&&r.ok)c.put(e.request,r.clone());return r;}catch(err){return await c.match(e.request)||await caches.match('/index.html')||await caches.match('/');}})());});