const CACHE_NAME = "zentimer-cache-v4";
const APP_SHELL = ["./","./index.html","./how-it-works.html","./404.html","./offline.html","./css/styles.css","./js/app.js","./js/timer-worker.js","./js/reliability.js","./manifest.json","./privacy.html","./terms.html","./assets/icons/icon-192.png","./assets/icons/icon-512.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch", e => {
  if (e.request.method!=="GET") return;
  const url=new URL(e.request.url); if(url.origin!==self.location.origin) return;
  if(e.request.mode==="navigate") {
    e.respondWith(fetch(e.request).then(res=>{const copy=res.clone(); caches.open(CACHE_NAME).then(c=>c.put(e.request,copy)).catch(()=>{}); return res;}).catch(async()=> (await caches.match(e.request)) || (await caches.match("./index.html")) || (await caches.match("./offline.html"))));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(res=>{if(res?.ok){const copy=res.clone(); caches.open(CACHE_NAME).then(c=>c.put(e.request,copy)).catch(()=>{});} return res;})));
});
