const CACHE='midnight-v16';
const CACHE_PREFIX='midnight-';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./icon-maskable.svg'];
const REQUIRED_SHELL=['./','./index.html'];
const OFFLINE_HTML='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#090b14"><title>Project Midnight · Offline</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#090b14;color:#f7f8ff;font:16px system-ui,sans-serif;text-align:center;padding:24px}main{max-width:32rem}h1{font-size:2rem}p{color:#a7aec8;line-height:1.6}button{border:0;border-radius:16px;padding:14px 20px;background:#8d7cff;color:white;font:inherit;font-weight:800}</style><main><h1>Signal temporarily unavailable.</h1><p>Project Midnight could not load its saved game shell. Reconnect once, then reopen the app to restore offline play.</p><button onclick="location.reload()">Try again</button></main>';

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE).then(async cache=>{
      const results=await Promise.allSettled(ASSETS.map(asset=>cache.add(asset)));
      const failedRequired=REQUIRED_SHELL.filter(asset=>{
        const index=ASSETS.indexOf(asset);
        return results[index].status==='rejected';
      });
      if(failedRequired.length)throw new Error(`Required shell failed to cache: ${failedRequired.join(', ')}`);
    }).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))),
      self.registration.navigationPreload?self.registration.navigationPreload.enable():Promise.resolve()
    ]).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  if(event.request.mode==='navigate'){
    event.respondWith(
      Promise.resolve(event.preloadResponse)
        .then(preloaded=>preloaded||fetch(event.request))
        .then(response=>{
          if(response&&response.status===200){
            const copy=response.clone();
            event.waitUntil(caches.open(CACHE).then(cache=>cache.put('./index.html',copy)));
          }
          return response;
        })
        .catch(()=>caches.match('./index.html').then(cached=>cached||new Response(OFFLINE_HTML,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>{
      const refresh=fetch(event.request).then(response=>{
        if(response&&response.status===200){
          const copy=response.clone();
          event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));
        }
        return response;
      }).catch(()=>cached||Response.error());
      return cached||refresh;
    })
  );
});