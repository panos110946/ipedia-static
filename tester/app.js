const $ = (id) => document.getElementById(id);

const fileInput = $('fileInput');
const dropzone = $('dropzone');
const uploadPanel = $('uploadPanel');
const viewerPanel = $('viewerPanel');
const previewFrame = $('previewFrame');
const frameWrap = $('frameWrap');
const statusEl = $('status');
const logEl = $('log');
const appTitle = $('appTitle');
const appPath = $('appPath');

const APP_BASE_URL = new URL('./', window.location.href);
const PREVIEW_DIRECTORY = '__ipedia_preview__';
const TESTER_VERSION = '2026-06-23-2';
const ALL_PREVIEW_CACHE_PREFIX = 'ipedia-preview-';
const CACHE_PREFIX = `${ALL_PREVIEW_CACHE_PREFIX}${TESTER_VERSION}-`;

let currentPreviewURL = '';
let currentSession = '';
let currentCacheName = '';
let swReady = null;

function setStatus(message) {
  statusEl.textContent = message;
}

function log(message) {
  const time = new Date().toLocaleTimeString('el-GR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  logEl.textContent += `\n[${time}] ${message}`;
  logEl.scrollTop = logEl.scrollHeight;
}

function resetLog(message = 'Δεν έχει φορτωθεί αρχείο.') {
  logEl.textContent = message;
}

function showViewer(title, path) {
  appTitle.textContent = title;
  appPath.textContent = path || '';
  uploadPanel.hidden = true;
  viewerPanel.hidden = false;
}

function showUpload() {
  uploadPanel.hidden = false;
  viewerPanel.hidden = true;
}

function sessionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function safeArchivePath(path) {
  const parts = String(path).replace(/\\/g, '/').split('/');
  const clean = [];

  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') return null;
    clean.push(part);
  }

  return clean.join('/');
}

function isJunkPath(path) {
  const parts = path.split('/');
  return parts.some((part) => part === '__MACOSX' || part === '.DS_Store');
}

function commonTopLevelFolder(paths) {
  if (!paths.length || paths.some((path) => !path.includes('/'))) return '';
  const root = paths[0].split('/')[0];
  return paths.every((path) => path.startsWith(`${root}/`)) ? `${root}/` : '';
}

function extToType(path) {
  const extension = (path.split('.').pop() || '').toLowerCase();
  const types = {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'text/javascript; charset=utf-8',
    mjs: 'text/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    txt: 'text/plain; charset=utf-8',
    xml: 'application/xml; charset=utf-8',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    ico: 'image/x-icon',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    mp4: 'video/mp4',
    webm: 'video/webm',
    pdf: 'application/pdf',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
    glb: 'model/gltf-binary',
    gltf: 'model/gltf+json; charset=utf-8',
    wasm: 'application/wasm'
  };
  return types[extension] || 'application/octet-stream';
}

function isTextFile(path) {
  return /\.(?:html?|css|js|mjs|json|svg|txt|xml|gltf)$/i.test(path);
}

function encodePreviewPath(path) {
  return path.split('/').map((part) => encodeURIComponent(part)).join('/');
}

function previewUrlFor(session, path) {
  const encodedPath = encodePreviewPath(path);
  return new URL(`${PREVIEW_DIRECTORY}/${session}/${encodedPath}`, APP_BASE_URL).href;
}

function injectDebugBridge(html) {
  const bridge = `
<script>
(function () {
  function send(type, values) {
    try {
      parent.postMessage({
        __ipediaTester: true,
        type: type,
        args: Array.prototype.slice.call(values).map(function (value) { return String(value); })
      }, location.origin);
    } catch (error) {}
  }

  ['log', 'warn', 'error'].forEach(function (name) {
    var original = console[name];
    console[name] = function () {
      send(name, arguments);
      if (original) original.apply(console, arguments);
    };
  });

  window.addEventListener('error', function (event) {
    var target = event.target;
    if (target && target !== window) {
      send('error', ['Αποτυχία φόρτωσης asset: ' + (target.src || target.href || target.tagName)]);
      return;
    }
    send('error', [event.message + ' @ ' + (event.filename || '') + ':' + (event.lineno || '')]);
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason && (event.reason.stack || event.reason.message || event.reason);
    send('error', ['Unhandled promise: ' + reason]);
  });
})();
<\/script>
`;

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => match + bridge);
  }
  return bridge + html;
}

function controllerVersion(controller, timeoutMs = 500) {
  if (!controller) return Promise.resolve(null);

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => resolve(null), timeoutMs);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeout);
      resolve(event.data?.version || null);
    };
    controller.postMessage({ type: 'IPEDIA_TESTER_VERSION' }, [channel.port2]);
  });
}

async function waitForServiceWorkerController(scriptURL, timeoutMs = 10000) {
  const isCurrentController = async () => {
    const controller = navigator.serviceWorker.controller;
    return controller?.scriptURL === scriptURL && await controllerVersion(controller) === TESTER_VERSION;
  };

  if (await isCurrentController()) return;

  await new Promise((resolve, reject) => {
    let checking = false;
    const timeout = window.setTimeout(() => finish(false), timeoutMs);
    const interval = window.setInterval(check, 200);

    function finish(success) {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      navigator.serviceWorker.removeEventListener('controllerchange', check);
      if (success) resolve();
      else reject(new Error('Το σωστό Service Worker δεν πήρε τον έλεγχο της σελίδας. Κάνε μία ανανέωση και δοκίμασε ξανά.'));
    }

    async function check() {
      if (checking) return;
      checking = true;
      try {
        if (await isCurrentController()) finish(true);
      } finally {
        checking = false;
      }
    }

    navigator.serviceWorker.addEventListener('controllerchange', check);
    check();
  });
}

async function ensureSW() {
  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  if (location.protocol !== 'https:' && !localHosts.has(location.hostname)) {
    throw new Error('Το preview χρειάζεται HTTPS ή localhost για να λειτουργήσει το Service Worker.');
  }
  if (!('serviceWorker' in navigator)) {
    throw new Error('Ο browser δεν υποστηρίζει Service Worker.');
  }

  if (!swReady) {
    swReady = (async () => {
      const scriptURL = new URL(`sw.js?v=${encodeURIComponent(TESTER_VERSION)}`, APP_BASE_URL).href;
      const registration = await navigator.serviceWorker.register(scriptURL, {
        scope: APP_BASE_URL.pathname,
        updateViaCache: 'none'
      });

      try {
        await registration.update();
      } catch (error) {
        log(`Προειδοποίηση ενημέρωσης Service Worker: ${error.message || error}`);
      }

      await navigator.serviceWorker.ready;
      await waitForServiceWorkerController(scriptURL);
      return registration;
    })().catch((error) => {
      swReady = null;
      throw error;
    });
  }

  return swReady;
}

async function deleteCurrentPreviewCache() {
  if (currentCacheName && 'caches' in window) {
    await caches.delete(currentCacheName);
  }
  currentCacheName = '';
  currentSession = '';
}

async function putVirtualFile(cache, session, file) {
  const url = previewUrlFor(session, file.path);
  const response = new Response(file.body, {
    headers: {
      'Content-Type': file.type || extToType(file.path),
      'Cache-Control': 'no-store'
    }
  });
  await cache.put(url, response);
}

async function openVirtualApp(title, indexPath, files) {
  await ensureSW();
  previewFrame.src = 'about:blank';
  await deleteCurrentPreviewCache();

  currentSession = sessionId();
  currentCacheName = `${CACHE_PREFIX}${currentSession}`;
  const cache = await caches.open(currentCacheName);

  try {
    await Promise.all(files.map((file) => putVirtualFile(cache, currentSession, file)));
  } catch (error) {
    await caches.delete(currentCacheName);
    currentCacheName = '';
    currentSession = '';
    throw new Error(`Δεν αποθηκεύτηκαν τα αρχεία του preview: ${error.message || error}`);
  }

  const url = new URL(previewUrlFor(currentSession, indexPath));
  url.searchParams.set('t', Date.now());
  currentPreviewURL = url.href;

  showViewer(title, indexPath);
  previewFrame.src = currentPreviewURL;
}

async function prepareSingleHTML(file, html) {
  resetLog('Φόρτωση απλού HTML...');
  setStatus('HTML...');
  const finalHtml = injectDebugBridge(html);

  await openVirtualApp(file.name, 'index.html', [
    { path: 'index.html', body: finalHtml, type: 'text/html; charset=utf-8' }
  ]);

  setStatus('HTML φορτώθηκε');
  log('Το απλό HTML άνοιξε επιτυχώς. Για relative CSS/JS/assets, ανέβασε ολόκληρο το project ως ZIP.');
}

async function prepareZip(file) {
  resetLog('Αποσυμπίεση ZIP...');
  setStatus('ZIP...');

  if (!window.JSZip) {
    throw new Error('Δεν φορτώθηκε η βιβλιοθήκη JSZip. Έλεγξε τη σύνδεση στο internet και ξαναφόρτωσε τη σελίδα.');
  }

  let zip;
  try {
    zip = await window.JSZip.loadAsync(file);
  } catch (error) {
    throw new Error(`Το ZIP δεν μπορεί να διαβαστεί ή είναι κατεστραμμένο: ${error.message || error}`);
  }

  const safeEntries = [];
  let ignoredCount = 0;

  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const path = safeArchivePath(entry.name);
    if (!path || isJunkPath(path)) {
      ignoredCount += 1;
      continue;
    }
    safeEntries.push({ entry, path });
  }

  if (!safeEntries.length) {
    throw new Error('Το ZIP δεν περιέχει χρήσιμα αρχεία. Τα __MACOSX και .DS_Store αγνοούνται.');
  }

  const root = commonTopLevelFolder(safeEntries.map((item) => item.path));
  const entries = safeEntries.map((item) => ({
    entry: item.entry,
    path: root ? item.path.slice(root.length) : item.path
  })).filter((item) => item.path);

  const seenPaths = new Set();
  const uniqueEntries = entries.filter((item) => {
    if (seenPaths.has(item.path)) {
      ignoredCount += 1;
      return false;
    }
    seenPaths.add(item.path);
    return true;
  });

  const rootIndex = uniqueEntries.find((item) => /^index\.html?$/i.test(item.path));
  const nestedIndex = uniqueEntries.find((item) => /(?:^|\/)index\.html?$/i.test(item.path));
  const firstHtml = uniqueEntries.find((item) => /\.html?$/i.test(item.path));
  const indexItem = rootIndex || nestedIndex || firstHtml;

  if (!indexItem) {
    throw new Error('Δεν βρέθηκε index.html, index.htm ή άλλο αρχείο .html/.htm μέσα στο ZIP.');
  }

  const files = [];
  for (const item of uniqueEntries) {
    if (item.path === indexItem.path) {
      const html = await item.entry.async('text');
      files.push({
        path: item.path,
        body: injectDebugBridge(html),
        type: 'text/html; charset=utf-8'
      });
    } else if (isTextFile(item.path)) {
      files.push({
        path: item.path,
        body: await item.entry.async('text'),
        type: extToType(item.path)
      });
    } else {
      files.push({
        path: item.path,
        body: await item.entry.async('uint8array'),
        type: extToType(item.path)
      });
    }
  }

  await openVirtualApp(file.name, indexItem.path, files);
  setStatus('ZIP φορτώθηκε');
  log(`Βρέθηκε HTML εκκίνησης: ${indexItem.path}`);
  log(`Αρχεία στο preview: ${files.length}`);
  if (root) log(`Αφαιρέθηκε ο κοινός φάκελος κορυφής: ${root.slice(0, -1)}`);
  if (ignoredCount) log(`Αγνοήθηκαν ${ignoredCount} άχρηστα, μη ασφαλή ή διπλότυπα αρχεία.`);
  log('Τα relative HTML/CSS/JS/media paths εξυπηρετούνται κάτω από /tester/.');
}

async function handleFile(file) {
  if (!file) return;

  try {
    const name = file.name.toLowerCase();
    if (name.endsWith('.zip')) {
      await prepareZip(file);
    } else if (name.endsWith('.html') || name.endsWith('.htm') || (file.type || '').includes('html')) {
      await prepareSingleHTML(file, await file.text());
    } else {
      throw new Error('Υποστηρίζονται μόνο αρχεία .html, .htm ή .zip.');
    }
  } catch (error) {
    setStatus('Σφάλμα');
    resetLog(`Σφάλμα: ${error.message || error}`);
    showUpload();
    fileInput.value = '';
  }
}

async function resetPreview({ clearLog = true } = {}) {
  previewFrame.src = 'about:blank';
  fileInput.value = '';
  currentPreviewURL = '';
  await deleteCurrentPreviewCache();
  if (clearLog) resetLog();
  setStatus('Έτοιμο');
  showUpload();
}

async function resetTesterCache() {
  const button = $('resetCacheBtn');
  button.disabled = true;
  setStatus('Reset...');
  resetLog('Καθαρισμός Service Worker και preview caches...');
  previewFrame.src = 'about:blank';

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const testerRegistrations = registrations.filter((registration) => registration.scope.startsWith(APP_BASE_URL.href));
      await Promise.all(testerRegistrations.map((registration) => registration.unregister()));
    }

    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames
        .filter((cacheName) => cacheName.startsWith(ALL_PREVIEW_CACHE_PREFIX))
        .map((cacheName) => caches.delete(cacheName)));
    }

    window.location.replace(APP_BASE_URL.href);
  } catch (error) {
    button.disabled = false;
    setStatus('Σφάλμα');
    resetLog(`Σφάλμα reset cache: ${error.message || error}`);
  }
}

fileInput.addEventListener('change', (event) => handleFile(event.target.files[0]));

dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropzone.classList.add('isDragging');
});

dropzone.addEventListener('dragleave', () => dropzone.classList.remove('isDragging'));

dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.classList.remove('isDragging');
  const files = event.dataTransfer?.files;
  if (!files?.length) {
    setStatus('Σφάλμα');
    resetLog('Σφάλμα: Δεν βρέθηκε αρχείο στο drop.');
    return;
  }
  if (files.length > 1) log('Επιλέχθηκε μόνο το πρώτο αρχείο από το drop.');
  handleFile(files[0]);
});

$('clearBtn').addEventListener('click', () => resetPreview());
$('resetCacheBtn').addEventListener('click', resetTesterCache);
$('backBtn').addEventListener('click', () => resetPreview({ clearLog: false }));

$('reloadBtn').addEventListener('click', () => {
  if (!currentPreviewURL) {
    log('Δεν υπάρχει preview για ανανέωση.');
    return;
  }
  const url = new URL(currentPreviewURL);
  url.searchParams.set('t', Date.now());
  currentPreviewURL = url.href;
  previewFrame.src = currentPreviewURL;
  log('Έγινε ανανέωση του preview.');
});

$('openNewTabBtn').addEventListener('click', () => {
  if (!currentPreviewURL) {
    log('Δεν υπάρχει preview για άνοιγμα.');
    return;
  }
  const newWindow = window.open(currentPreviewURL, '_blank');
  if (newWindow) {
    newWindow.opener = null;
  } else {
    log('Το νέο παράθυρο μπλοκαρίστηκε από τον browser. Επίτρεψε τα pop-ups και δοκίμασε ξανά.');
  }
});

$('fullscreenBtn').addEventListener('click', async () => {
  try {
    const requestFullscreen = frameWrap.requestFullscreen || frameWrap.webkitRequestFullscreen;
    if (!requestFullscreen) throw new Error('Η λειτουργία δεν υποστηρίζεται από αυτόν τον browser.');
    await requestFullscreen.call(frameWrap);
  } catch (error) {
    log(`Σφάλμα πλήρους οθόνης: ${error.message || error}`);
  }
});

$('copyLogBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(logEl.textContent);
    log('Τα μηνύματα αντιγράφηκαν.');
  } catch (error) {
    log(`Δεν έγινε αντιγραφή: ${error.message || error}`);
  }
});

$('openSampleBtn').addEventListener('click', async () => {
  try {
    resetLog('Φόρτωση demo...');
    setStatus('Demo...');

    const demoHtml = `<!doctype html>
<html lang="el">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="assets/demo.css">
</head>
<body>
  <main class="card">
    <h1>Demo HTML App</h1>
    <p>CSS και JavaScript φορτώθηκαν με relative paths.</p>
    <canvas id="canvas" width="800" height="360"></canvas>
    <button id="demoButton">Δοκιμή</button>
  </main>
  <script src="assets/demo.js"><\/script>
</body>
</html>`;

    const demoCss = `body{margin:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:linear-gradient(135deg,#fff,#ffe8e6);min-height:100vh;display:grid;place-items:center;color:#29211f}.card{width:min(560px,90vw);background:white;border-radius:28px;padding:28px;box-shadow:0 25px 55px rgba(0,0,0,.15)}button{border:0;border-radius:999px;background:#ff7e79;color:white;font-weight:900;padding:14px 20px}canvas{width:100%;height:220px;background:#101014;border-radius:22px}`;
    const demoJs = `const canvas=document.getElementById('canvas');const context=canvas.getContext('2d');let time=0;function draw(){time+=.02;context.clearRect(0,0,canvas.width,canvas.height);for(let i=0;i<22;i++){context.beginPath();context.arc(60+i*32,180+Math.sin(time+i*.5)*70,8+i%4,0,Math.PI*2);context.fillStyle='hsl('+((i*18+time*80)%360)+',80%,65%)';context.fill()}requestAnimationFrame(draw)}draw();document.getElementById('demoButton').addEventListener('click',()=>console.log('Το demo button λειτουργεί.'));`;

    await openVirtualApp('Demo HTML App', 'index.html', [
      { path: 'index.html', body: injectDebugBridge(demoHtml), type: 'text/html; charset=utf-8' },
      { path: 'assets/demo.css', body: demoCss, type: 'text/css; charset=utf-8' },
      { path: 'assets/demo.js', body: demoJs, type: 'text/javascript; charset=utf-8' }
    ]);

    setStatus('Demo');
    log('Το demo φορτώθηκε με relative CSS και JavaScript.');
  } catch (error) {
    setStatus('Σφάλμα');
    resetLog(`Σφάλμα demo: ${error.message || error}`);
    showUpload();
  }
});

previewFrame.addEventListener('load', () => {
  if (previewFrame.src !== 'about:blank' && currentPreviewURL) log('Το iframe ολοκλήρωσε τη φόρτωση.');
});

window.addEventListener('message', (event) => {
  if (event.origin !== location.origin) return;
  const data = event.data;

  if (data?.__ipediaTester) {
    log(`${String(data.type).toUpperCase()}: ${(data.args || []).join(' ')}`);
    return;
  }

  if (data?.__ipediaTesterSW && data.session === currentSession) {
    log(`ERROR: Δεν βρέθηκε asset: ${data.path}`);
  }
});

// Register and check for worker updates as soon as the normal /tester/ page loads.
ensureSW().catch((error) => {
  setStatus('Σφάλμα SW');
  resetLog(`Σφάλμα Service Worker: ${error.message || error}`);
});
