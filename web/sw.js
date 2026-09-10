'use strict';
const SHELL='fahrklar-shell-v1',DATA='fahrklar-data-v1',IMAGES='fahrklar-images-v1';
const FILES=['/','/index.html','/app.js','/core.js','/icons.js','/style.css','/web-bridge.js','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('fahrklar-')&&![SHELL,DATA,IMAGES].includes(key)).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.pathname==='/catalog.json'){
    event.respondWith(caches.open(DATA).then(async cache=>{try{const response=await fetch(event.request);if(response.ok)await cache.put('/catalog.json',response.clone());return response;}catch(e){return await cache.match('/catalog.json')||new Response('{"questions":[],"meta":{}}',{headers:{'content-type':'application/json'}});}}));return;
  }
  if(url.hostname==='img.f-online.at'){
    event.respondWith(caches.open(IMAGES).then(async cache=>await cache.match(event.request)||fetch(event.request).then(response=>{cache.put(event.request,response.clone());return response;})));return;
  }
  if(url.origin===self.location.origin&&(event.request.mode==='navigate'||FILES.includes(url.pathname))){
    event.respondWith(caches.open(SHELL).then(async cache=>await cache.match(event.request)||await cache.match(url.pathname)||fetch(event.request)));}
});
