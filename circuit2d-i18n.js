(function(){
  var registry = Object.create(null);
  var currentLang = (window.CIRCUIT2D_LANG || 'el');
  var currentBundle = { messages:Object.create(null), meta:Object.create(null) };
  var observer = null;
  var domReady = false;
  var TEXT_ATTRS = ['title','aria-label','placeholder','value','alt','data-shortlabel'];
  var TOKEN_RE = /__MSG_\d{4}[A-Z0-9]*__/g;
  var SKIP_TAGS = { SCRIPT:1, STYLE:1, NOSCRIPT:1, TEXTAREA:1 };
  var textSources = typeof WeakMap === 'function' ? new WeakMap() : null;
  var attrSources = typeof WeakMap === 'function' ? new WeakMap() : null;

  function setDocLang(lang){
    try { document.documentElement.lang = lang || 'el'; } catch(_){ }
  }

  function renderText(text){
    if (text == null) return '';
    return String(text).replace(TOKEN_RE, function(token){
      return Object.prototype.hasOwnProperty.call(currentBundle.messages, token) ? currentBundle.messages[token] : token;
    });
  }

  function shouldSkipElement(el){
    return !!(el && el.nodeType === 1 && SKIP_TAGS[el.tagName]);
  }

  function shouldSkipTextNode(node){
    return !!(node && node.nodeType === 3 && node.parentNode && node.parentNode.nodeType === 1 && SKIP_TAGS[node.parentNode.tagName]);
  }

  function getAttrStore(el, create){
    if (!attrSources) return null;
    var store = attrSources.get(el);
    if (!store && create){
      store = Object.create(null);
      attrSources.set(el, store);
    }
    return store;
  }

  function translateTextNode(node){
    if (!node || node.nodeType !== 3 || shouldSkipTextNode(node)) return;
    var raw = node.nodeValue;
    var entry = textSources ? textSources.get(node) : null;
    if (raw && raw.indexOf('__MSG_') !== -1){
      entry = { source:raw, lastRendered:null };
      if (textSources) textSources.set(node, entry);
    } else if (!entry || !entry.source){
      return;
    } else if (entry.lastRendered != null && raw !== entry.lastRendered){
      if (textSources) textSources.delete(node);
      return;
    }
    var rendered = renderText(entry.source);
    entry.lastRendered = rendered;
    if (rendered !== raw) node.nodeValue = rendered;
  }

  function translateAttribute(el, attr){
    if (!el || el.nodeType !== 1 || shouldSkipElement(el) || !el.hasAttribute || !el.hasAttribute(attr)) return;
    var raw = el.getAttribute(attr);
    var store = getAttrStore(el, true);
    var entry = store ? store[attr] : null;
    if (raw && raw.indexOf('__MSG_') !== -1){
      entry = { source:raw, lastRendered:null };
      if (store) store[attr] = entry;
    } else if (!entry || !entry.source){
      return;
    } else if (entry.lastRendered != null && raw !== entry.lastRendered){
      if (store) delete store[attr];
      return;
    }
    var rendered = renderText(entry.source);
    entry.lastRendered = rendered;
    if (rendered !== raw){
      el.setAttribute(attr, rendered);
      if (attr === 'value' && 'value' in el){
        try { if (String(el.value || '') === raw) el.value = rendered; } catch(_){ }
      }
    }
  }

  function translateAttributes(el){
    if (!el || el.nodeType !== 1 || shouldSkipElement(el)) return;
    for (var i=0; i<TEXT_ATTRS.length; i++) translateAttribute(el, TEXT_ATTRS[i]);
  }

  function makeWalker(root){
    if (!document || !document.createTreeWalker) return null;
    return document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function(node){
        if (node.nodeType === 1 && shouldSkipElement(node)) return NodeFilter.FILTER_REJECT;
        if (node.nodeType === 3 && shouldSkipTextNode(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
  }

  function translateTree(root){
    if (!root) return;
    if (root.nodeType === 3){
      translateTextNode(root);
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) translateAttributes(root);
    var walker = makeWalker(root);
    if (!walker) return;
    var node;
    while ((node = walker.nextNode())){
      if (node.nodeType === 3) translateTextNode(node);
      else if (node.nodeType === 1) translateAttributes(node);
    }
  }

  function ensureObserver(){
    if (observer || !window.MutationObserver || !document || !document.documentElement) return;
    observer = new MutationObserver(function(mutations){
      for (var i=0; i<mutations.length; i++){
        var m = mutations[i];
        if (m.type === 'characterData') translateTextNode(m.target);
        else if (m.type === 'attributes') translateAttribute(m.target, m.attributeName);
        else if (m.type === 'childList'){
          for (var j=0; j<m.addedNodes.length; j++) translateTree(m.addedNodes[j]);
        }
      }
    });
    observer.observe(document.documentElement, {
      subtree:true,
      childList:true,
      characterData:true,
      attributes:true,
      attributeFilter:TEXT_ATTRS
    });
  }

  function activate(lang, options){
    currentLang = lang || currentLang || 'el';
    currentBundle = registry[currentLang] || { messages:Object.create(null), meta:Object.create(null) };
    currentBundle.messages = currentBundle.messages || Object.create(null);
    currentBundle.meta = currentBundle.meta || Object.create(null);
    setDocLang(currentLang);
    try { if (window.localStorage) localStorage.setItem('Circuit2D.lang', currentLang); } catch(_){ }
    if (options && options.deferDom) return currentBundle;
    if (document && document.documentElement){
      ensureObserver();
      translateTree(document.documentElement);
      try { if (document.title) document.title = renderText(document.title); } catch(_){ }
    }
    return currentBundle;
  }

  function register(lang, payload){
    registry[lang] = payload || { messages:{}, meta:{} };
    if (lang === currentLang) activate(lang, { deferDom:!domReady });
  }

  function getMeta(key){
    return currentBundle && currentBundle.meta ? currentBundle.meta[key] : void 0;
  }

  function onReady(){
    domReady = true;
    activate(currentLang);
  }

  window.C2DI18N = {
    register: register,
    activate: activate,
    renderText: renderText,
    getMeta: getMeta,
    getCurrentLanguage: function(){ return currentLang; },
    getBundle: function(){ return currentBundle; },
    hasLanguage: function(lang){ return Object.prototype.hasOwnProperty.call(registry, lang); },
    getLanguages: function(){ return Object.keys(registry); },
    translateDocument: function(){ if (document && document.documentElement) translateTree(document.documentElement); }
  };

  if (document && document.readyState !== 'loading') onReady();
  else document.addEventListener('DOMContentLoaded', onReady, { once:true });
})();
