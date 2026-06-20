const CACHE_PREFIX = 'ipedia-preview-';
const PREVIEW_PREFIX = '/__ipedia_preview__/';
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith(PREVIEW_PREFIX)) return;
  event.respondWith((async () => {
    const parts = url.pathname.slice(PREVIEW_PREFIX.length).split('/');
    const session = parts.shift();
    let filePath = parts.join('/');
    if (!filePath || filePath.endsWith('/')) filePath += 'index.html';
    filePath = decodeURIComponent(filePath).replace(/^\.\//,'');
    const cache = await caches.open(CACHE_PREFIX + session);
    let response = await cache.match('/' + filePath);
    if (!response && filePath !== 'index.html') response = await cache.match('/index.html');
    return response || new Response('iPedia Tester: file not found: ' + filePath, {status:404, headers:{'Content-Type':'text/plain; charset=utf-8'}});
  })());
});
