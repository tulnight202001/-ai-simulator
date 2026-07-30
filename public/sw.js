const CACHE='ai-simulator-v5-20260730';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));

const isVersionedArt=pathname=>/\/art\/generated\/v(?:2|3)\//.test(pathname);
const isHashedViteAsset=pathname=>/\/assets\/[^/]+-[A-Za-z0-9_-]{6,}\.(?:js|css|png|webp|avif|svg|woff2?)$/.test(pathname);

async function put(cache,request,response){
 if(response.ok)await cache.put(request,response.clone());
 return response;
}

async function cacheFirst(request){
 const cache=await caches.open(CACHE);
 const cached=await cache.match(request);
 if(cached)return cached;
 return put(cache,request,await fetch(request));
}

async function networkFirst(request,navigation=false){
 const cache=await caches.open(CACHE);
 try{return await put(cache,request,await fetch(request));}
 catch(error){
  const cached=await cache.match(request);
  if(cached)return cached;
  if(navigation){
   const shell=await cache.match('./index.html');
   if(shell)return shell;
  }
  throw error;
 }
}

self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 const url=new URL(event.request.url);
 const navigation=event.request.mode==='navigate'||event.request.destination==='document'||url.pathname.endsWith('.html');
 if(isVersionedArt(url.pathname)||isHashedViteAsset(url.pathname)){
  event.respondWith(cacheFirst(event.request));
  return;
 }
 event.respondWith(networkFirst(event.request,navigation));
});
