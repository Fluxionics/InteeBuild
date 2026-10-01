'use strict';

const { catalogUiJsSrc, patchCatalogSrc } = require('./providers');
const { notifyScriptSrc, foregroundRuntimeSrc } = require('./audio');

const MINIMAL_WWW = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cargando...</title>
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: #0b0f1a; }
    </style>
  </head>
  <body></body>
</html>
`;

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
  return cfg.inputType === 'html' ? cfg.htmlCode : MINIMAL_WWW;
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
