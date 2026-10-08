'use strict';

const { catalogUiJsSrc, patchCatalogSrc } = require('./providers');
const { notifyScriptSrc, foregroundRuntimeSrc } = require('./audio');

function escHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function urlBootHtml(cfg) {
  const target = escHtml(cfg.url);
  const title = escHtml(cfg.appName || 'App');
  const bg = escHtml(cfg.splashColor || '#0b0f1a');
  const accent = escHtml(cfg.accentColor || '#22d3a7');
  const textColor = cfg.appTheme === 'light' ? '#111827' : '#f9fafb';
  const mutedColor = cfg.appTheme === 'light' ? '#6b7280' : '#9ca3af';

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${title}</title>
    <noscript><meta http-equiv="refresh" content="0;url=${target}" /></noscript>
    <style>
      html, body { margin: 0; height: 100%; background: ${bg}; color: ${textColor};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        -webkit-user-select: none; user-select: none; }
      body { display: flex; align-items: center; justify-content: center; }
      .wrap { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 24px; text-align: center; }
      .ring { width: 42px; height: 42px; border-radius: 50%; border: 3px solid rgba(128,128,128,.25); border-top-color: ${accent}; animation: spin .8s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      .name { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: .2px; }
      .hint { margin: 0; font-size: 13px; color: ${mutedColor}; }
      #err { display: none; flex-direction: column; align-items: center; gap: 14px; }
      #err p { margin: 0; font-size: 14px; color: ${mutedColor}; max-width: 260px; line-height: 1.5; }
      #retry { appearance: none; border: 1px solid ${accent}; background: transparent; color: ${accent};
        font: inherit; font-size: 14px; font-weight: 600; padding: 10px 22px; border-radius: 10px; cursor: pointer; }
      @media (prefers-reduced-motion: reduce) { .ring { animation-duration: 2s; } }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="ring"></div>
      <p class="name">${title}</p>
      <p class="hint">Cargando sitio&hellip;</p>
      <div id="err">
        <p>No se pudo cargar el sitio. Revisa tu conexion e intentalo de nuevo.</p>
        <button id="retry" type="button">Reintentar</button>
      </div>
    </div>
    <script>
      (function () {
        var TARGET = ${JSON.stringify(String(cfg.url)).replace(/</g, '\\u003c')};
        var err = document.getElementById('err');
        var boot = document.querySelector('.wrap .ring');
        function go() { window.location.replace(TARGET); }
        function fail() {
          if (boot) boot.style.display = 'none';
          document.querySelector('.hint').style.display = 'none';
          err.style.display = 'flex';
        }
        document.getElementById('retry').addEventListener('click', function () {
          if (navigator.onLine === false) { fail(); return; }
          err.style.display = 'none';
          if (boot) boot.style.display = '';
          document.querySelector('.hint').style.display = '';
          go();
        });
        window.addEventListener('online', go);
        window.addEventListener('offline', fail);
        if (navigator.onLine === false) fail(); else go();
      })();
    </script>
  </body>
</html>
`;
}

const NO_SELECT_CSS = '<style>*{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none} input,textarea{-webkit-user-select:text;user-select:text}</style>';

function scriptTag(code) {
  return '<script>' + code + '</script>';
}

function withBodySnippet(html, snippet) {
  return /<\/body\s*>/i.test(html) ? html.replace(/<\/body\s*>/i, snippet + '</body>') : html + snippet;
}

function withHeadSnippet(html, snippet) {
  return /<\/head\s*>/i.test(html) ? html.replace(/<\/head\s*>/i, snippet + '</head>') : snippet + html;
}

function ensureCharset(html) {
  if (/<meta\s+charset/i.test(html)) return html;
  const meta = '<meta charset="UTF-8" />';
  const withHead = html.replace(/<head([^>]*)>/i, '<head$1>' + meta);
  if (withHead !== html) return withHead;
  return /<!doctype[^>]*>/i.test(html)
    ? html.replace(/<!doctype[^>]*>/i, (m) => m + meta)
    : meta + html;
}

function ensureViewport(html) {
  if (/<meta\s+[^>]*viewport/i.test(html)) return html;
  const meta = '<meta name="viewport" content="width=device-width, initial-scale=1.0" />';
  return /<head([^>]*)>/i.test(html)
    ? html.replace(/<head([^>]*)>/i, '<head$1>' + meta)
    : meta + html;
}

function starterHtml(cfg) {
  return cfg.inputType === 'html' ? cfg.htmlCode : urlBootHtml(cfg);
}

function catalogFiles(cfg) {
  const files = {
    'patch-catalog.js': patchCatalogSrc(cfg),
    'www/catalog.js': catalogUiJsSrc(cfg)
  };
  if (cfg.permissions.foreground) files['www/catalog.js'] += '\n' + foregroundRuntimeSrc();
  return files;
}

function pwaFiles(cfg) {
  return {
    'www/manifest.webmanifest': JSON.stringify({
      name: cfg.appName,
      short_name: cfg.appName.slice(0, 12),
      start_url: '.',
      display: 'standalone',
      background_color: cfg.splashColor || '#ffffff',
      theme_color: cfg.accentColor || '#4f46e5',
      icons: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }]
    }, null, 2),
    'www/sw.js': "const CACHE='ib-v1';self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','./index.html','./manifest.webmanifest']).catch(()=>{})));self.skipWaiting();});self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).catch(()=>caches.match('./index.html'))));});"
  };
}

function minifyHtml(html) {
  return html
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}




function finalizeWebAssets(files, cfg) {
  let html = files['www/index.html'];

  if (cfg.notifySchedEnabled && cfg.inputType === 'html') {
    html = withBodySnippet(html, scriptTag(notifyScriptSrc(cfg)));
  }

  if (cfg.inputType === 'html') {
    html = ensureViewport(ensureCharset(html));
  }

  html = withBodySnippet(html, scriptTag(catalogUiJsSrc(cfg)));
  if (cfg.blockSelection) html = withHeadSnippet(html, NO_SELECT_CSS);

  if (cfg.pwaEnabled) {
    Object.assign(files, pwaFiles(cfg));
    if (!/<link[^>]*rel=["']manifest["']/i.test(html)) {
      html = withHeadSnippet(html, '<link rel="manifest" href="manifest.webmanifest" />');
    }
    if (!/serviceWorker/i.test(html)) {
      html = withBodySnippet(html, scriptTag('if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){});});}'));
    }
  }

  files['www/index.html'] = cfg.minify ? minifyHtml(html) : html;

  if (cfg.minify && files['www/catalog.js']) {
    files['www/catalog.js'] = String(files['www/catalog.js']).replace(/\/\*[\s\S]*?\*\//g, '');
  }
}

module.exports = { starterHtml, catalogFiles, finalizeWebAssets };
