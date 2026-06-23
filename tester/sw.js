const TESTER_SW_VERSION = '2026-06-23-2';
const ALL_PREVIEW_CACHE_PREFIX = 'ipedia-preview-';
const CACHE_PREFIX = `${ALL_PREVIEW_CACHE_PREFIX}${TESTER_SW_VERSION}-`;
const PREVIEW_DIRECTORY = '__ipedia_preview__';
const TESTER_SCOPE_PATH = new URL(self.registration.scope).pathname;
const PREVIEW_PATH_PREFIX = `${TESTER_SCOPE_PATH}${PREVIEW_DIRECTORY}/`;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((cacheName) => cacheName.startsWith(ALL_PREVIEW_CACHE_PREFIX) && !cacheName.startsWith(CACHE_PREFIX))
      .map((cacheName) => caches.delete(cacheName)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'IPEDIA_TESTER_VERSION') {
    event.ports[0]?.postMessage({ version: TESTER_SW_VERSION });
  }
});

async function notifyMissingAsset(session, path) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage({
      __ipediaTesterSW: true,
      session,
      path
    });
  }
}

self.addEventListener('fetch', (event) => {
  const requestURL = new URL(event.request.url);

  // Never intercept the tester shell or normal site files. Only virtual preview URLs belong here.
  if (event.request.method !== 'GET' || !requestURL.pathname.startsWith(PREVIEW_PATH_PREFIX)) return;

  event.respondWith((async () => {
    const previewPath = requestURL.pathname.slice(PREVIEW_PATH_PREFIX.length);
    const slashIndex = previewPath.indexOf('/');

    if (slashIndex < 1) {
      return new Response('iPedia Tester: invalid preview URL', {
        status: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    const session = previewPath.slice(0, slashIndex);
    let filePath = previewPath.slice(slashIndex + 1);
    if (!filePath || filePath.endsWith('/')) filePath += 'index.html';

    const cache = await caches.open(`${CACHE_PREFIX}${session}`);
    const cacheURL = new URL(requestURL.href);
    cacheURL.pathname = `${PREVIEW_PATH_PREFIX}${session}/${filePath}`;
    cacheURL.search = '';
    cacheURL.hash = '';

    const response = await cache.match(cacheURL.href, { ignoreSearch: true });
    if (response) return response;

    const displayPath = decodeURIComponent(filePath);
    await notifyMissingAsset(session, displayPath);
    return new Response(`iPedia Tester: file not found: ${displayPath}`, {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    });
  })());
});
