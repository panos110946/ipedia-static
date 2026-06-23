const CACHE_PREFIX = 'ipedia-preview-';
const PREVIEW_DIRECTORY = '__ipedia_preview__';
const SW_VERSION = '4';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'IPEDIA_TESTER_VERSION') {
    event.ports[0]?.postMessage({ version: SW_VERSION });
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
  if (event.request.method !== 'GET') return;

  const requestURL = new URL(event.request.url);
  const scopePath = new URL(self.registration.scope).pathname;
  const previewPrefix = `${scopePath}${PREVIEW_DIRECTORY}/`;

  if (!requestURL.pathname.startsWith(previewPrefix)) return;

  event.respondWith((async () => {
    const previewPath = requestURL.pathname.slice(previewPrefix.length);
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
    cacheURL.pathname = `${previewPrefix}${session}/${filePath}`;
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
