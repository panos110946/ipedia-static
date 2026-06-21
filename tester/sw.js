const CACHE_PREFIX = 'ipedia-preview-';
const PREVIEW_MARKER = '/__ipedia_preview__/';
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const markerIndex = url.pathname.indexOf(PREVIEW_MARKER);
  if (markerIndex === -1) return;
  event.respondWith((async () => {
    const parts = url.pathname.slice(markerIndex + PREVIEW_MARKER.length).split('/');
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
