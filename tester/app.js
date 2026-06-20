const $ = (id) => document.getElementById(id);
const fileInput = $('fileInput');
const uploadPanel = $('uploadPanel');
const viewerPanel = $('viewerPanel');
const previewFrame = $('previewFrame');
const frameWrap = $('frameWrap');
const statusEl = $('status');
const logEl = $('log');
const appTitle = $('appTitle');
const appPath = $('appPath');

let currentPreviewURL = '';
let currentSession = '';
let swReady = null;

function setStatus(msg){ statusEl.textContent = msg; }
function log(msg){ const t = new Date().toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}); logEl.textContent += `\n[${t}] ${msg}`; logEl.scrollTop = logEl.scrollHeight; }
function resetLog(msg='Δεν έχει φορτωθεί αρχείο.'){ logEl.textContent = msg; }
function showViewer(title,path){ appTitle.textContent = title; appPath.textContent = path || ''; uploadPanel.hidden = true; viewerPanel.hidden = false; }
function showUpload(){ uploadPanel.hidden = false; viewerPanel.hidden = true; }
function sessionId(){ return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,9); }
function normalizePath(path){ return path.replace(/^\.\//,'').replace(/\\/g,'/').replace(/^\/+/, ''); }
function stripCommonRoot(paths){
  const clean = paths.filter(p=>p && !p.startsWith('__MACOSX/') && !p.endsWith('/'));
  if (!clean.length) return '';
  const firstSegs = clean.map(p=>p.split('/')[0]);
  const root = firstSegs[0];
  if (root && firstSegs.every(s=>s===root) && clean.every(p=>p.includes('/'))) return root + '/';
  return '';
}
function extToType(path){
  const e = (path.split('.').pop() || '').toLowerCase();
  return ({html:'text/html; charset=utf-8',htm:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',svg:'image/svg+xml',webp:'image/webp',mp3:'audio/mpeg',m4a:'audio/mp4',wav:'audio/wav',ogg:'audio/ogg',json:'application/json; charset=utf-8',pdf:'application/pdf',glb:'model/gltf-binary',gltf:'model/gltf+json; charset=utf-8',wasm:'application/wasm',txt:'text/plain; charset=utf-8',xml:'application/xml; charset=utf-8'})[e] || 'application/octet-stream';
}
function injectDebugBridge(html){
  const bridge = `\n<script>\n(function(){\n  var send=function(type,args){ try{ parent.postMessage({__ipediaTester:true,type:type,args:Array.prototype.slice.call(args).map(function(x){return String(x);})}, '*'); }catch(e){} };\n  ['log','warn','error'].forEach(function(k){ var old=console[k]; console[k]=function(){ send(k, arguments); old&&old.apply(console, arguments); }; });\n  window.addEventListener('error', function(e){ send('error', [e.message + ' @ ' + (e.filename||'') + ':' + (e.lineno||'')]); });\n  window.addEventListener('unhandledrejection', function(e){ send('error', ['Unhandled promise: ' + (e.reason && (e.reason.stack || e.reason.message || e.reason))]); });\n})();\n<\/script>\n`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, m => m + bridge);
  return bridge + html;
}
async function ensureSW(){
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') throw new Error('Το preview ZIP χρειάζεται HTTPS. Στο Render θα είναι ΟΚ.');
  if (!('serviceWorker' in navigator)) throw new Error('Ο browser δεν υποστηρίζει Service Worker.');
  if (!swReady) swReady = navigator.serviceWorker.register('sw.js').then(()=>navigator.serviceWorker.ready);
  await swReady;
}
async function clearPreviewCaches(){
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith('ipedia-preview-')).map(k=>caches.delete(k)));
}
async function putVirtualFile(cache, path, body, type){
  const clean = '/' + normalizePath(path);
  const response = new Response(body, {headers:{'Content-Type': type || extToType(clean), 'Cache-Control':'no-store'}});
  await cache.put(clean, response);
}
async function openVirtualApp(title, indexPath, files){
  await ensureSW();
  await clearPreviewCaches();
  currentSession = sessionId();
  const cache = await caches.open('ipedia-preview-' + currentSession);
  for (const f of files){ await putVirtualFile(cache, f.path, f.body, f.type); }
  currentPreviewURL = `/__ipedia_preview__/${currentSession}/${normalizePath(indexPath)}?t=${Date.now()}`;
  previewFrame.src = currentPreviewURL;
  showViewer(title, normalizePath(indexPath));
}
async function prepareSingleHTML(file, html){
  resetLog('Φόρτωση απλού HTML...');
  setStatus('HTML...');
  const finalHtml = injectDebugBridge(html);
  await openVirtualApp(file.name, 'index.html', [{path:'index.html', body:finalHtml, type:'text/html; charset=utf-8'}]);
  setStatus('HTML φορτώθηκε');
  log('Το απλό HTML άνοιξε. Αν έχει εξωτερικά αρχεία, ανέβασέ το ως ZIP.');
}
async function prepareZip(file){
  resetLog('Αποσυμπίεση ZIP...');
  setStatus('ZIP...');
  if (!window.JSZip) throw new Error('Δεν φορτώθηκε το JSZip από CDN. Έλεγξε σύνδεση ή βάλε το JSZip local.');
  const zip = await JSZip.loadAsync(file);
  const rawEntries = Object.values(zip.files).filter(f=>!f.dir && !f.name.startsWith('__MACOSX/') && !/\.DS_Store$/i.test(f.name));
  if (!rawEntries.length) throw new Error('Το ZIP δεν περιέχει αρχεία.');
  const root = stripCommonRoot(rawEntries.map(e=>normalizePath(e.name)));
  const entries = rawEntries.map(e=>({entry:e, path:normalizePath(e.name).startsWith(root) ? normalizePath(e.name).slice(root.length) : normalizePath(e.name)})).filter(x=>x.path);
  let indexItem = entries.find(x=>/(^|\/)index\.html?$/i.test(x.path)) || entries.find(x=>/\.html?$/i.test(x.path));
  if (!indexItem) throw new Error('Δεν βρέθηκε index.html ή άλλο .html μέσα στο ZIP.');
  const files = [];
  for (const item of entries){
    let body;
    const isText = /\.(html?|css|js|mjs|json|svg|txt|xml|gltf)$/i.test(item.path);
    if (item.path === indexItem.path){
      body = injectDebugBridge(await item.entry.async('text'));
      files.push({path:item.path, body, type:'text/html; charset=utf-8'});
    } else if (isText) {
      body = await item.entry.async('text');
      files.push({path:item.path, body, type:extToType(item.path)});
    } else {
      body = await item.entry.async('blob');
      files.push({path:item.path, body, type:extToType(item.path)});
    }
  }
  await openVirtualApp(file.name, indexItem.path, files);
  setStatus('ZIP φορτώθηκε');
  log(`Βρέθηκε HTML: ${indexItem.path}`);
  log(`Αρχεία στο virtual preview: ${files.length}`);
  log('Το ZIP φορτώθηκε μέσω Service Worker, άρα τα relative paths των Hype/HTML apps πρέπει να δουλεύουν πολύ καλύτερα.');
}
async function handleFile(file){
  if(!file) return;
  try{
    const name = file.name.toLowerCase();
    if(name.endsWith('.zip')) await prepareZip(file);
    else if(name.endsWith('.html') || name.endsWith('.htm') || (file.type||'').includes('html')) await prepareSingleHTML(file, await file.text());
    else throw new Error('Υποστηρίζονται μόνο .html, .htm ή .zip');
  }catch(err){ setStatus('Σφάλμα'); resetLog('Σφάλμα: ' + (err.message || err)); showUpload(); }
}
fileInput.addEventListener('change', e => handleFile(e.target.files[0]));
$('clearBtn').addEventListener('click', async()=>{ previewFrame.src='about:blank'; fileInput.value=''; currentPreviewURL=''; await clearPreviewCaches(); resetLog(); setStatus('Έτοιμο'); showUpload(); });
$('backBtn').addEventListener('click', ()=>{ previewFrame.src='about:blank'; fileInput.value=''; setStatus('Έτοιμο'); showUpload(); });
$('reloadBtn').addEventListener('click', ()=>{ if(currentPreviewURL){ previewFrame.src='about:blank'; setTimeout(()=>previewFrame.src=currentPreviewURL.replace(/t=\d+/, 't='+Date.now()), 80); log('Έγινε ανανέωση preview.'); }});
$('openNewTabBtn').addEventListener('click', ()=>{ if(currentPreviewURL) window.open(currentPreviewURL, '_blank'); });
$('fullscreenBtn').addEventListener('click', async()=>{ try{ await frameWrap.requestFullscreen(); }catch(e){ log('Η πλήρης οθόνη δεν υποστηρίχθηκε από τον browser.'); } });
$('copyLogBtn').addEventListener('click', async()=>{ try{ await navigator.clipboard.writeText(logEl.textContent); }catch(e){} });
$('openSampleBtn').addEventListener('click', async()=>{
  try{
    resetLog('Φόρτωση demo...');
    const demo = `<!doctype html><html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:linear-gradient(135deg,#fff,#ffe8e6);min-height:100vh;display:grid;place-items:center;color:#29211f}.card{width:min(560px,90vw);background:white;border-radius:28px;padding:28px;box-shadow:0 25px 55px rgba(0,0,0,.15)}button{border:0;border-radius:999px;background:#ff7e79;color:white;font-weight:900;padding:14px 20px}canvas{width:100%;height:220px;background:#101014;border-radius:22px}</style></head><body><div class="card"><h1>Demo HTML App</h1><p>Αυτό είναι ενδεικτικό preview μέσα στο iPedia HTML Tester.</p><canvas id="c" width="800" height="360"></canvas><p><button onclick="console.log('Κλικ demo'); alert('Λειτουργεί στο iPhone');">Δοκιμή</button></p></div><script>const c=document.getElementById('c'),x=c.getContext('2d');let t=0;function draw(){t+=.02;x.clearRect(0,0,c.width,c.height);for(let i=0;i<22;i++){x.beginPath();x.arc(60+i*32,180+Math.sin(t+i*.5)*70,8+i%4,0,Math.PI*2);x.fillStyle='hsl('+((i*18+t*80)%360)+',80%,65%)';x.fill()}requestAnimationFrame(draw)}draw();</script></body></html>`;
    await openVirtualApp('Demo HTML App','index.html',[{path:'index.html',body:injectDebugBridge(demo),type:'text/html; charset=utf-8'}]);
    setStatus('Demo'); log('Το demo φορτώθηκε.');
  }catch(e){ setStatus('Σφάλμα'); resetLog('Σφάλμα demo: ' + (e.message || e)); }
});
window.addEventListener('message', event=>{ const d=event.data; if(!d || !d.__ipediaTester) return; log(`${String(d.type).toUpperCase()}: ${(d.args||[]).join(' ')}`); });
