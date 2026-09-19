'use strict';
/* InteeBuild first-party ads loader.
 * Se sirve desde tu dominio (/js/ads.js + /api/ads) para que los
 * bloqueadores por lista no lo filtren. Si el creativo no carga,
 * muestra promo propia (house ad) para no romper el layout. */
(function () {
  if (window.__ibAdsLoaded) return;
  window.__ibAdsLoaded = true;

  function houseAd(box) {
    if (box.querySelector('iframe')) return;
    box.innerHTML = '<a href="./developer.html" style="display:flex;gap:10px;align-items:center;text-decoration:none;background:linear-gradient(135deg,rgba(99,102,241,.15),rgba(16,185,129,.08));border:1px solid rgba(99,102,241,.35);border-radius:12px;padding:12px 16px;max-width:320px;margin:0 auto">'
      + '<span style="font-size:22px">🚀</span>'
      + '<span style="font-size:12px;color:#e5e7eb"><b>Automatiza con InteeBuild API</b><br><small style="color:#9ca3af">Compila APKs desde tu backend · Ver docs</small></span></a>';
  }

  async function load(box) {
    const slot = box.getAttribute('data-ad');
    if (!slot) return;
    try {
      const r = await fetch('/api/ads/' + encodeURIComponent(slot), { cache: 'no-store' });
      if (!r.ok) throw new Error('slot');
      const j = await r.json();
      window.atOptions = { key: j.key, format: j.format, height: j.height, width: j.width, params: {} };
      const s = document.createElement('script');
      s.src = j.loader;
      s.async = true;
      s.onload = function () {
        setTimeout(function () { if (!box.querySelector('iframe')) houseAd(box); }, 4500);
      };
      s.onerror = function () { houseAd(box); };
      box.appendChild(s);
      setTimeout(function () { if (!box.querySelector('iframe') && !box.querySelector('a')) houseAd(box); }, 8000);
    } catch (e) {
      houseAd(box);
    }
  }

  function init() {
    document.querySelectorAll('.ad-container[data-ad]').forEach(load);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
