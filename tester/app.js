const TESTER_VERSION = '2026-06-23-simple-2';
const APP_BASE_URL = new URL('./', window.location.href);
const LEGACY_PREVIEW_CACHE_PREFIXES = ['ipedia-preview-', 'tester-preview-'];
const ASSET_WARNING = 'Single local HTML preview only loads the selected HTML file. Separate local assets will not be available unless they are embedded in the HTML.';

const $ = (id) => document.getElementById(id);
const fileInput = $('fileInput');
const fileName = $('fileName');
const previewFrame = $('previewFrame');
const viewerPanel = $('viewerPanel');
const reloadBtn = $('reloadBtn');
const openNewTabBtn = $('openNewTabBtn');
const clearBtn = $('clearBtn');
const statusEl = $('status');
const logEl = $('log');

let currentBlobURL = '';
let currentFileName = '';
let loadSequence = 0;
let activeReader = null;

function setStatus(message) {
  statusEl.textContent = message;
}

function resetLog(message = 'Δεν έχει φορτωθεί αρχείο.') {
  logEl.textContent = message;
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

function updateControls(hasPreview) {
  reloadBtn.disabled = !hasPreview;
  openNewTabBtn.disabled = !hasPreview;
  clearBtn.disabled = !hasPreview;
  viewerPanel.hidden = !hasPreview;
}

function revokeCurrentPreview() {
  previewFrame.src = 'about:blank';
  if (currentBlobURL) URL.revokeObjectURL(currentBlobURL);
  currentBlobURL = '';
  currentFileName = '';
}

function readFileAsText(file) {
  const reader = new FileReader();
  activeReader = reader;

  const reading = new Promise((resolve, reject) => {
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Ο browser δεν μπόρεσε να διαβάσει το αρχείο.'));
    reader.onabort = () => reject(new Error('Η ανάγνωση του προηγούμενου αρχείου ακυρώθηκε.'));
    reader.readAsText(file, 'UTF-8');
  });

  return reading.then(
    (value) => {
      if (activeReader === reader) activeReader = null;
      return value;
    },
    (error) => {
      if (activeReader === reader) activeReader = null;
      throw error;
    }
  );
}

function clearPreview({ resetMessages = true } = {}) {
  if (activeReader && activeReader.readyState === 1) activeReader.abort();
  loadSequence += 1;
  revokeCurrentPreview();
  fileInput.value = '';
  fileName.textContent = 'Δεν έχει επιλεγεί αρχείο';
  updateControls(false);
  setStatus('Έτοιμο');
  if (resetMessages) resetLog();
}

async function loadHTMLFile(file) {
  if (activeReader && activeReader.readyState === 1) activeReader.abort();
  const sequence = ++loadSequence;
  revokeCurrentPreview();
  updateControls(false);
  fileName.textContent = file && file.name ? file.name : 'Δεν έχει επιλεγεί αρχείο';
  resetLog('Φόρτωση HTML αρχείου...');
  setStatus('Φόρτωση...');

  try {
    if (!file || !/\.html?$/i.test(file.name)) {
      throw new Error('Επίλεξε αρχείο με κατάληξη .html ή .htm.');
    }

    const html = await readFileAsText(file);
    if (sequence !== loadSequence) return;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    currentBlobURL = URL.createObjectURL(blob);
    currentFileName = file.name;
    fileName.textContent = currentFileName;
    updateControls(true);
    previewFrame.src = currentBlobURL;
    setStatus('Φορτώθηκε');
    log(`Προεπισκόπηση: ${currentFileName}`);
    log(ASSET_WARNING);
  } catch (error) {
    if (sequence !== loadSequence) return;
    revokeCurrentPreview();
    fileName.textContent = 'Δεν έχει επιλεγεί αρχείο';
    updateControls(false);
    setStatus('Σφάλμα');
    resetLog(`Σφάλμα: ${error.message || error}`);
  } finally {
    fileInput.value = '';
  }
}

async function cleanLegacyTesterState() {
  try {
    let removedWorkers = 0;
    let removedCaches = 0;

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const testerRegistrations = registrations.filter((registration) => registration.scope.startsWith(APP_BASE_URL.href));
      const results = await Promise.all(testerRegistrations.map((registration) => registration.unregister()));
      removedWorkers = results.filter(Boolean).length;
    }

    if ('caches' in window) {
      const cacheNames = await caches.keys();
      const testerCacheNames = cacheNames.filter((cacheName) =>
        LEGACY_PREVIEW_CACHE_PREFIXES.some((prefix) => cacheName.startsWith(prefix))
      );
      const results = await Promise.all(testerCacheNames.map((cacheName) => caches.delete(cacheName)));
      removedCaches = results.filter(Boolean).length;
    }

    if (removedWorkers || removedCaches) {
      log(`Καθαρίστηκαν ${removedWorkers} παλιό/ά Service Worker και ${removedCaches} preview cache(s).`);
    }
  } catch (error) {
    log(`Προειδοποίηση καθαρισμού παλιού cache: ${error.message || error}`);
  }
}

fileInput.addEventListener('change', (event) => {
  const files = event.target.files;
  loadHTMLFile(files && files.length ? files[0] : null);
});

reloadBtn.addEventListener('click', () => {
  if (!currentBlobURL) {
    log('Δεν υπάρχει HTML preview για ανανέωση.');
    return;
  }

  const url = currentBlobURL;
  previewFrame.src = 'about:blank';
  requestAnimationFrame(() => {
    if (currentBlobURL === url) previewFrame.src = url;
  });
  log(`Ανανέωση preview: ${currentFileName}`);
});

clearBtn.addEventListener('click', () => clearPreview());

openNewTabBtn.addEventListener('click', () => {
  if (!currentBlobURL) {
    log('Δεν υπάρχει HTML preview για άνοιγμα.');
    return;
  }

  const newWindow = window.open(currentBlobURL, '_blank');
  if (newWindow) {
    newWindow.opener = null;
    log('Το preview άνοιξε σε νέα καρτέλα.');
  } else {
    log('Η νέα καρτέλα μπλοκαρίστηκε από τον browser. Επίτρεψε τα pop-ups και δοκίμασε ξανά.');
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

previewFrame.addEventListener('load', () => {
  if (currentBlobURL && previewFrame.src === currentBlobURL) {
    log(`Το iframe φόρτωσε: ${currentFileName}`);
  }
});

window.addEventListener('pagehide', () => {
  loadSequence += 1;
  revokeCurrentPreview();
});

updateControls(false);
setStatus('Έτοιμο');
cleanLegacyTesterState();

console.info(`iPedia HTML Tester ${TESTER_VERSION}`);
