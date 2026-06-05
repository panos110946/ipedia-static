(function(){
  'use strict';

  var DEMO_DEFAULTS = {
    preset: 'series2',
    activity: 'act_simple_lamp',
    worksheetByLang: {
      el: 'el_two_resistors_series_voltage_share_01',
      en: 'en_two_resistors_series_voltage_share_01',
      es: 'es_dos_resistores_serie_reparto_voltaje_01'
    }
  };

  var state = {
    started: false,
    activeWorksheetId: '',
    activePresetId: '',
    activeActivityId: ''
  };

  var DEMO_LOCKS = {
    tools: ['Select','Battery','Resistor','Ammeter','Voltmeter','Wire','Switch','Node'],
    presets: ['series2'],
    activities: ['act_simple_lamp'],
    worksheets: [
      'el_two_resistors_series_voltage_share_01',
      'en_two_resistors_series_voltage_share_01',
      'es_dos_resistores_serie_reparto_voltaje_01'
    ]
  };

  function $(id){ return document.getElementById(id); }
  function q(sel, root){ return (root || document).querySelector(sel); }
  function qa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function bridge(){ return window.Circuit2DAppBridge || {}; }

  function getParam(name){
    try { return new URL(window.location.href).searchParams.get(name) || ''; }
    catch(_){
      var qstr = String(window.location.search || '').replace(/^\?/, '');
      var parts = qstr ? qstr.split('&') : [];
      for (var i=0;i<parts.length;i++){
        var pair = parts[i].split('=');
        if (decodeURIComponent(pair[0] || '') === name) return decodeURIComponent((pair.slice(1).join('=') || '').replace(/\+/g, ' '));
      }
      return '';
    }
  }

  function getLang(){
    var lang = getParam('lang');
    if (!lang){
      try { lang = bridge().getLanguage && bridge().getLanguage(); } catch(_){ lang = ''; }
    }
    lang = String(lang || 'el').toLowerCase();
    if (lang.indexOf('en') === 0) return 'en';
    if (lang.indexOf('es') === 0) return 'es';
    return 'el';
  }

  function label(key){
    var lang = getLang();
    var dict = {
      el: {
        dockTitle: 'Demo iCircuit', ready: 'Έτοιμο κύκλωμα', worksheet: 'Φύλλο εργασίας', mission: 'Αποστολή',
        hide: 'Απόκρυψη', show: 'Demo',
        helper: 'Το demo είναι κλειδωμένο στο φύλλο σειράς: δύο αντιστάτες, ίδιο ρεύμα και διαίρεση τάσης.',
        activityHelp: 'Στο demo είναι διαθέσιμη μόνο η Αποστολή 3: Κλείσε το κύκλωμα.',
        locked: 'Κλειδωμένο στο demo: διαθέσιμα είναι μόνο όσα χρειάζονται για το φύλλο δύο αντιστατών σε σειρά.'
      },
      en: {
        dockTitle: 'iCircuit demo', ready: 'Ready circuit', worksheet: 'Worksheet', mission: 'Mission',
        hide: 'Hide', show: 'Demo',
        helper: 'This demo is locked to the series worksheet: two resistors, same current and voltage sharing.',
        activityHelp: 'Only Mission 3 is available in this demo: close the circuit.',
        locked: 'Locked in this demo: only the items needed for the two-resistors-in-series worksheet are available.'
      },
      es: {
        dockTitle: 'Demo iCircuit', ready: 'Circuito listo', worksheet: 'Hoja de trabajo', mission: 'Misión',
        hide: 'Ocultar', show: 'Demo',
        helper: 'Este demo está bloqueado en la hoja de resistores en serie: misma corriente y reparto del voltaje.',
        activityHelp: 'En este demo solo está disponible la Misión 3: cierra el circuito.',
        locked: 'Bloqueado en este demo: solo están disponibles los elementos necesarios para la hoja de dos resistores en serie.'
      }
    };
    return (dict[lang] && dict[lang][key]) || (dict.el[key] || key);
  }

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]; });
  }

  function injectStyle(){
    if ($('icircuitWebsiteDemoStyle')) return;
    var css = [
      ':root{--icd-accent:#FF7E79;--icd-ink:#625C5C}',
      '.icd-demo-dock{position:relative;left:auto;right:auto;top:auto;bottom:auto;z-index:28;flex:0 0 auto;display:flex;align-items:center;gap:8px;width:100%;max-width:none;min-width:0;padding:7px calc(10px + env(safe-area-inset-right)) 7px calc(10px + env(safe-area-inset-left));border:0;border-bottom:1px solid rgba(255,126,121,.24);border-radius:0;background:rgba(255,255,255,.96);box-shadow:0 8px 22px rgba(15,23,42,.10);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);font:12px/1.3 Arial,sans-serif;color:var(--icd-ink)}',
      '.icd-demo-dock strong{color:var(--icd-accent);font-weight:900;white-space:nowrap;flex:0 0 auto}.icd-demo-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center;min-width:0}.icd-demo-dock button{border:1px solid rgba(255,126,121,.28);border-radius:999px;background:#fff;color:var(--icd-ink);font-weight:800;min-height:30px;padding:.32rem .62rem;cursor:pointer}.icd-demo-dock button:hover{background:#fff7f6;border-color:rgba(255,126,121,.52)}.icd-compact{width:34px;min-width:34px;padding:0!important;margin-left:auto;flex:0 0 auto}',
      '.icd-demo-dock.is-collapsed{width:auto;align-self:flex-start;margin:0;padding:6px 10px;border-right:1px solid rgba(255,126,121,.24);border-bottom-right-radius:16px;box-shadow:0 8px 20px rgba(15,23,42,.08)}.icd-demo-dock.is-collapsed strong,.icd-demo-dock.is-collapsed .icd-demo-actions,.icd-demo-dock.is-collapsed .icd-helper{display:none!important}.icd-helper{flex:0 1 260px;min-width:120px;max-width:260px;color:#7b6262;font-size:11px}',
      '@media(max-width:760px),(max-height:560px){.icd-demo-dock{left:auto;right:auto;top:auto;bottom:auto;align-items:center;gap:6px;padding:6px 8px;box-shadow:0 6px 18px rgba(15,23,42,.08)}.icd-helper{display:none}.icd-demo-actions{flex:1 1 auto}.icd-demo-actions button{font-size:11px;padding:.28rem .48rem;min-height:28px}.icd-demo-dock strong{font-size:11.5px}.icd-compact{width:30px;min-width:30px}}',
      '@media(max-width:460px){.icd-demo-dock strong{display:none}.icd-demo-actions{gap:4px}.icd-demo-actions button{font-size:10.5px;padding:.25rem .42rem}.icd-compact{width:28px;min-width:28px}}',
      '.icd-locked{opacity:.48!important;filter:grayscale(.15);cursor:not-allowed!important;position:relative}.icd-locked::after{content:" 🔒";font-size:11px;color:#9b8a8a;font-weight:900}.icd-locked *{pointer-events:none}.icd-locked-note{font-size:11px;color:#8d8080;margin-top:4px}'
    ].join('');
    var style = document.createElement('style');
    style.id = 'icircuitWebsiteDemoStyle';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function toast(message){
    try { if (bridge().notify) return bridge().notify(message); } catch(_){ }
    var n = document.createElement('div');
    n.textContent = message;
    n.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:67000;background:#fff;color:#625C5C;border:1px solid rgba(255,126,121,.35);border-radius:999px;padding:.55rem .9rem;box-shadow:0 12px 28px rgba(15,23,42,.18);font:13px Arial,sans-serif';
    document.body.appendChild(n);
    setTimeout(function(){ try { n.remove(); } catch(_){ } }, 2200);
  }

  function waitForReady(callback, attempts){
    attempts = attempts == null ? 80 : attempts;
    if (window.Circuit2DAppBridge && window.Circuit2DWorksheets){ callback(); return; }
    if (attempts <= 0){ callback(); return; }
    setTimeout(function(){ waitForReady(callback, attempts - 1); }, 100);
  }


  function makeSet(values){
    var out = Object.create(null);
    for (var i=0; i<(values || []).length; i++) out[String(values[i])] = true;
    return out;
  }

  var allowedToolSet = makeSet(DEMO_LOCKS.tools);
  var allowedPresetSet = makeSet(DEMO_LOCKS.presets);
  var allowedActivitySet = makeSet(DEMO_LOCKS.activities);
  var allowedWorksheetSet = makeSet(DEMO_LOCKS.worksheets);

  function firstAllowed(list, fallback){
    return (list && list.length ? list[0] : fallback);
  }

  function enforceAllowed(value, set, fallback){
    value = String(value || '');
    return (value && set[value]) ? value : fallback;
  }

  function lockedMessage(){ return label('locked'); }

  function setLockedButton(btn, locked){
    if (!btn) return;
    btn.classList.toggle('icd-locked', !!locked);
    btn.disabled = !!locked;
    btn.setAttribute('aria-disabled', locked ? 'true' : 'false');
    if (locked){
      if (!btn.getAttribute('data-icd-original-title')) btn.setAttribute('data-icd-original-title', btn.getAttribute('title') || '');
      btn.setAttribute('title', lockedMessage());
    } else {
      var original = btn.getAttribute('data-icd-original-title');
      if (original != null) btn.setAttribute('title', original);
    }
  }

  function lockSelector(selector, attr, allowedSet){
    qa(selector).forEach(function(btn){
      var id = btn.getAttribute(attr) || '';
      setLockedButton(btn, !allowedSet[id]);
    });
  }

  function applyDemoLocks(){
    lockSelector('[data-tool]', 'data-tool', allowedToolSet);
    lockSelector('[data-preset-id]', 'data-preset-id', allowedPresetSet);
    lockSelector('[data-activity-id]', 'data-activity-id', allowedActivitySet);

    qa('[data-start],[data-view],[data-print]').forEach(function(btn){
      var wsId = btn.getAttribute('data-start') || btn.getAttribute('data-view') || btn.getAttribute('data-print') || '';
      setLockedButton(btn, !allowedWorksheetSet[wsId]);
    });

    qa('[data-load-preset]').forEach(function(btn){
      var presetId = btn.getAttribute('data-load-preset') || '';
      setLockedButton(btn, !allowedPresetSet[presetId]);
    });

    var loadBtn = $('loadBtn');
    if (loadBtn) setLockedButton(loadBtn, true);
  }

  function installDemoLockGuards(){
    if (window.__icircuitDemoLockGuardsInstalled) return;
    window.__icircuitDemoLockGuardsInstalled = true;

    document.addEventListener('click', function(ev){
      var target = ev.target && ev.target.closest ? ev.target.closest('[data-tool],[data-preset-id],[data-activity-id],[data-start],[data-view],[data-print],[data-load-preset],#loadBtn') : null;
      if (!target) return;
      var locked = false;
      if (target.id === 'loadBtn') locked = true;
      if (target.hasAttribute('data-tool')) locked = !allowedToolSet[target.getAttribute('data-tool') || ''];
      if (target.hasAttribute('data-preset-id')) locked = !allowedPresetSet[target.getAttribute('data-preset-id') || ''];
      if (target.hasAttribute('data-activity-id')) locked = !allowedActivitySet[target.getAttribute('data-activity-id') || ''];
      if (target.hasAttribute('data-load-preset')) locked = !allowedPresetSet[target.getAttribute('data-load-preset') || ''];
      if (target.hasAttribute('data-start') || target.hasAttribute('data-view') || target.hasAttribute('data-print')){
        var wsId = target.getAttribute('data-start') || target.getAttribute('data-view') || target.getAttribute('data-print') || '';
        locked = !allowedWorksheetSet[wsId];
      }
      if (locked){
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        toast(lockedMessage());
      }
    }, true);

    var obs = new MutationObserver(function(){ applyDemoLocks(); });
    try { obs.observe(document.body || document.documentElement, { childList:true, subtree:true }); } catch(_){ }
    setTimeout(applyDemoLocks, 0);
    setTimeout(applyDemoLocks, 300);
    setTimeout(applyDemoLocks, 900);
  }

  function defaultWorksheetId(){
    var lang = getLang();
    var fallback = DEMO_DEFAULTS.worksheetByLang[lang] || DEMO_DEFAULTS.worksheetByLang.el;
    return enforceAllowed(getParam('worksheet'), allowedWorksheetSet, fallback);
  }
  function defaultPresetId(){ return enforceAllowed(getParam('preset'), allowedPresetSet, firstAllowed(DEMO_LOCKS.presets, DEMO_DEFAULTS.preset)); }
  function defaultActivityId(){ return enforceAllowed(getParam('activity'), allowedActivitySet, firstAllowed(DEMO_LOCKS.activities, DEMO_DEFAULTS.activity)); }

  function loadReady(){
    var presetId = defaultPresetId();
    state.activePresetId = presetId;
    var ok = false;
    try { ok = !!(bridge().loadPreset && bridge().loadPreset(presetId)); } catch(_){ ok = false; }
    if (!ok){
      var btn = q('[data-preset-id="' + cssForAttr(presetId) + '"]');
      if (btn){ try { btn.click(); ok = true; } catch(_){ } }
    }
    return ok;
  }

  function openWorksheet(loadPreset){
    var wsId = defaultWorksheetId();
    state.activeWorksheetId = wsId;
    if (window.Circuit2DWorksheets && typeof window.Circuit2DWorksheets.start === 'function'){
      window.Circuit2DWorksheets.start(wsId, loadPreset !== false);
      return true;
    }
    return false;
  }

  function openMission(){
    var activityId = defaultActivityId();
    state.activeActivityId = activityId;
    var ok = false;
    try { ok = !!(bridge().startActivity && bridge().startActivity(activityId)); } catch(_){ ok = false; }
    if (!ok){
      var btn = q('[data-activity-id="' + cssForAttr(activityId) + '"]');
      if (btn){ try { btn.click(); ok = true; } catch(_){ } }
    }
    if (!ok) toast(label('activityHelp'));
    return ok;
  }

  function cssForAttr(value){
    try { if (window.CSS && CSS.escape) return CSS.escape(String(value || '')); } catch(_){ }
    return String(value || '').replace(/(["\\])/g, '\\$1');
  }

  function buildDock(){
    injectStyle();
    if ($('icircuitDemoDock')) return;
    var dock = document.createElement('div');
    dock.id = 'icircuitDemoDock';
    dock.className = 'icd-demo-dock';
    dock.innerHTML = '<strong>' + esc(label('dockTitle')) + '</strong>' +
      '<span class="icd-helper">' + esc(label('helper')) + '</span>' +
      '<div class="icd-demo-actions">' +
      '<button type="button" data-icd="ready">' + esc(label('ready')) + '</button>' +
      '<button type="button" data-icd="worksheet">' + esc(label('worksheet')) + '</button>' +
      '<button type="button" data-icd="mission">' + esc(label('mission')) + '</button>' +
      '</div>' +
      '<button type="button" class="icd-compact" data-icd="toggle" title="' + esc(label('hide')) + '">–</button>';
    var toolbar = document.querySelector('.app > .toolbar') || document.querySelector('.toolbar');
    if (toolbar && toolbar.parentNode){
      toolbar.parentNode.insertBefore(dock, toolbar.nextSibling);
    } else {
      document.body.insertBefore(dock, document.body.firstChild || null);
    }
    dock.addEventListener('click', function(ev){
      var b = ev.target && ev.target.closest ? ev.target.closest('[data-icd]') : null;
      if (!b) return;
      ev.preventDefault(); ev.stopPropagation();
      var action = b.getAttribute('data-icd');
      if (action === 'ready'){ loadReady(); return; }
      if (action === 'worksheet'){ openWorksheet(true); return; }
      if (action === 'mission'){ openMission(); return; }
      if (action === 'toggle'){
        dock.classList.toggle('is-collapsed');
        b.textContent = dock.classList.contains('is-collapsed') ? '▶' : '–';
      }
    }, true);
  }

  function autoStartDemo(){
    if (state.started) return;
    state.started = true;
    var disabled = getParam('demoAutostart') === '0';
    buildDock();
    if (disabled) return;
    setTimeout(function(){
      loadReady();
      setTimeout(function(){ openWorksheet(false); }, 350);
    }, 350);
  }

  function init(){
    waitForReady(function(){
      installDemoLockGuards();
      applyDemoLocks();
      autoStartDemo();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
