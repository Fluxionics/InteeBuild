(function () {
  var m = location.pathname.match(/^\/(es|en|ru|ch|br)(?:\/|$)/);
  var lang = m ? m[1] : 'es';
  var ATTRS = ['title', 'placeholder', 'alt', 'aria-label', 'value', 'content'];
  var reduced = false;
  try { reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
  var dict = {};
  var done = new WeakSet();
  var observer = null;
  var pending = [];
  var scheduled = false;
  var revealed = false;
  var animOn = false;
  try { animOn = sessionStorage.getItem('ib-lang-anim') === '1'; sessionStorage.removeItem('ib-lang-anim'); } catch (e) {}

  function norm(s) {
    return (s || '').trim().replace(/\s+/g, ' ');
  }

  function translateNode(node) {
    if (!node || done.has(node)) return;
    if (node.nodeType === 3) {
      var k = norm(node.nodeValue);
      if (k && Object.prototype.hasOwnProperty.call(dict, k) && dict[k] !== k) {
        var lead = (node.nodeValue.match(/^\s*/) || [''])[0];
        var trail = (node.nodeValue.match(/\s*$/) || [''])[0];
        done.add(node);
        node.nodeValue = lead + dict[k] + trail;
      }
      return;
    }
    if (node.nodeType !== 1) return;
    if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'SVG' || node.tagName === 'TEMPLATE' || node.tagName === 'NOSCRIPT') return;
    if (node.tagName !== 'OPTION' && node.hasAttribute) {
      for (var a = 0; a < ATTRS.length; a++) {
        var an = ATTRS[a];
        if (node.hasAttribute(an)) {
          var v = norm(node.getAttribute(an));
          if (v && Object.prototype.hasOwnProperty.call(dict, v) && dict[v] !== v && !done.has(node)) {
            done.add(node);
            node.setAttribute(an, dict[v]);
          }
        }
      }
    }
    var kids = node.childNodes;
    for (var i = 0; i < kids.length; i++) translateNode(kids[i]);
  }

  function applyDict(root) {
    if (!root) return;
    if (root.nodeType === 3) translateNode(root);
    else if (root.nodeType === 1) translateNode(root);
    else if (root.nodeType === 9 || root.nodeType === 11) {
      var kids = root.childNodes;
      for (var i = 0; i < kids.length; i++) translateNode(kids[i]);
    }
  }

  function schedule(root) {
    if (!root) return;
    pending.push(root);
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () {
      scheduled = false;
      var batch = pending;
      pending = [];
      for (var i = 0; i < batch.length; i++) applyDict(batch[i]);
    }, 50);
  }

  function startObserver() {
    if (observer || !window.MutationObserver || !document.documentElement) return;
    observer = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var mu = muts[i];
        if (mu.type === 'childList') {
          for (var j = 0; j < mu.addedNodes.length; j++) {
            var n = mu.addedNodes[j];
            if (n.nodeType === 1 || n.nodeType === 3) schedule(n.nodeType === 3 ? n.parentNode : n);
          }
        } else if (mu.type === 'characterData') {
          schedule(mu.target.parentNode);
        } else if (mu.type === 'attributes') {
          schedule(mu.target);
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  function injectStyle() {
    var st = document.createElement('style');
    st.id = 'ib-i18n-style';
    st.textContent = 'html.ib-x{opacity:0;filter:blur(8px)}html.ib-x.ib-anim{transition:opacity .3s ease,filter .3s ease;opacity:1;filter:none}html.ib-anim-out{transition:opacity .22s ease,filter .22s ease;opacity:0;filter:blur(8px)}@media (prefers-reduced-motion:reduce){html.ib-x,html.ib-anim,html.ib-anim-out{transition:none!important}}';
    (document.head || document.documentElement).appendChild(st);
  }

  function reveal() {
    if (revealed) return;
    revealed = true;
    if (!animOn || reduced) {
      document.documentElement.classList.remove('ib-x', 'ib-anim', 'ib-anim-out');
      return;
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.documentElement.classList.add('ib-anim');
        setTimeout(function () {
          document.documentElement.classList.remove('ib-x', 'ib-anim');
        }, 400);
      });
    });
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  injectStyle();
  document.documentElement.lang = lang === 'ch' ? 'zh-Hans' : lang === 'br' ? 'pt-BR' : lang;
  if (animOn && !reduced) {
    document.documentElement.classList.add('ib-x');
    setTimeout(reveal, 2500);
  }

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      document.documentElement.classList.remove('ib-x', 'ib-anim', 'ib-anim-out');
      revealed = true;
    }
  });

  function finish() {
    startObserver();
    applyDict(document.documentElement);
    reveal();
  }

  if (lang !== 'es') {
    var rest = location.pathname.replace(/^\/(?:es|en|ru|ch|br)(?=\/)/, '') || '/';
    var page = rest.replace(/\/$/, '/index.html').replace(/\.html?$/i, '') + '.json';
    fetch('/i18n/' + lang + page, { cache: 'force-cache' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (d) {
        if (d && Object.keys(d).length) dict = d;
        finish();
      })
      .catch(function () { finish(); });
  } else {
    reveal();
  }

  window.IB_I18N = {
    lang: lang,
    dict: function () { return dict; },
    t: function (k) { return dict[k] || k; },
    apply: applyDict
  };

  function addSwitcher() {
    if (!document.body || document.getElementById('ib-langsw')) return;
    var box = document.createElement('div');
    box.id = 'ib-langsw';
    box.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:99999;display:flex;gap:3px;background:#101722;border:1px solid #202b3b;border-radius:999px;padding:5px;font-family:Inter,Arial,sans-serif;box-shadow:0 6px 22px rgba(0,0,0,.45)';
    var rest = location.pathname.replace(/^\/(?:es|en|ru|ch|br)(?=\/)/, '');
    var hash = location.hash || '';
    var langs = [['es', 'ES'], ['en', 'EN'], ['ru', 'RU'], ['ch', '中文'], ['br', 'PT']];
    for (var i = 0; i < langs.length; i++) {
      var a = document.createElement('a');
      a.textContent = langs[i][1];
      a.href = '/' + langs[i][0] + (rest || '/') + hash;
      a.style.cssText = 'text-decoration:none;font-size:11px;font-weight:700;padding:5px 9px;border-radius:999px;transition:color .15s ease,background .15s ease,transform .15s ease;color:' +
        (langs[i][0] === lang ? '#fff' : '#8793a5') + ';background:' + (langs[i][0] === lang ? '#4f46e5' : 'transparent');
      if (langs[i][0] !== lang) {
        a.addEventListener('mouseenter', function () { this.style.color = '#e2e8f0'; this.style.transform = 'translateY(-1px)'; });
        a.addEventListener('mouseleave', function () { this.style.color = '#8793a5'; this.style.transform = 'none'; });
      }
      a.addEventListener('click', function (e) {
        if (reduced) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        var href = this.href;
        if (href === location.href) { e.preventDefault(); return; }
        e.preventDefault();
        try { sessionStorage.setItem('ib-lang-anim', '1'); } catch (err) {}
        var html = document.documentElement;
        html.classList.add('ib-anim');
        requestAnimationFrame(function () { html.classList.add('ib-anim-out'); });
        setTimeout(function () { location.href = href; }, 240);
      });
      box.appendChild(a);
    }
    document.body.appendChild(box);
  }

  ready(addSwitcher);
})();
