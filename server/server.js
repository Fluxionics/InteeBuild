'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const pathMod = require('path');

const deps = require('./deps');
const store = require('./store');
const buildEngine = require('./build-engine');
const urlGuard = require('./url-guard');
const analyzers = require('./analyzers');

const registerSystemRoutes = require('./routes/system');
const registerAnalyzeRoutes = require('./routes/analyze');
const registerAccountRoutes = require('./routes/account');
const registerOutputRoutes = require('./routes/outputs');
const registerDecompileRoutes = require('./routes/decompile');
const registerCatalogRoutes = require('./routes/catalog');
const registerBuildRoutes = require('./routes/builds');
const registerArtifactRoutes = require('./routes/artifacts');

const app = express();
const PORT = process.env.PORT || 8787;
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || null;

app.use(cors(ALLOWED_ORIGIN ? { origin: ALLOWED_ORIGIN } : { origin: true }));
app.use(express.json({ limit: '110mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '100mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
const LANG_RE = /^\/(es|en|ru|ch|br)(\/.*)?$/;

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  let full = null;
  const m = req.path.match(LANG_RE);
  if (m) {
    if (!m[2]) return res.redirect(301, '/' + m[1] + '/');
    let rel = m[2].replace(/^\/+/, '');
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const relN = pathMod.normalize(rel);
    if (relN.startsWith('..')) return next();
    full = pathMod.join(deps.ROOT, relN);
  } else {
    const p = req.path === '/' ? '/index.html' : req.path;
    if (!/\.html?$/i.test(p)) return next();
    const relN = pathMod.normalize(p.replace(/^\/+/, ''));
    if (relN.startsWith('..')) return next();
    full = pathMod.join(deps.ROOT, relN);
  }
  let stat;
  try { stat = fs.statSync(full); } catch (e) { return next(); }
  if (!stat.isFile()) return next();
  if (!/\.html?$/i.test(full)) return res.sendFile(full);
  let html = fs.readFileSync(full, 'utf8');
  html = html.replace('</head>', '<script src="/js/i18n.js"></script></head>');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(html);
});

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const em = req.path.match(/^\/docs\/es\/(.+)$/);
  if (em) req.url = '/docs/' + em[1];
  next();
});

app.use(express.static(deps.ROOT, { index: 'index.html' }));

const ctx = { ...deps, ...store, ...buildEngine, ...urlGuard, ...analyzers };

registerSystemRoutes(app, ctx);
registerAnalyzeRoutes(app, ctx);
registerAccountRoutes(app, ctx);
registerOutputRoutes(app, ctx);
registerDecompileRoutes(app, ctx);
registerCatalogRoutes(app, ctx);
registerBuildRoutes(app, ctx);
registerArtifactRoutes(app, ctx);

const NF_TEXT = {
  es: { t: 'Página no encontrada', m: 'La página que buscas no existe o fue movida.', h: 'Ir al inicio', c: 'Compilador oficial' },
  en: { t: 'Page not found', m: 'The page you are looking for does not exist or was moved.', h: 'Go home', c: 'Official compiler' },
  ru: { t: 'Страница не найдена', m: 'Страница, которую вы ищете, не существует или была перемещена.', h: 'На главную', c: 'Официальный компилятор' },
  ch: { t: '页面未找到', m: '你要找的页面不存在或已被移动。', h: '回到首页', c: '官方编译器' },
  br: { t: 'Página não encontrada', m: 'A página que você procura não existe ou foi movida.', h: 'Ir para o início', c: 'Compilador oficial' }
};

function notFoundPage(lang, reqPath) {
  const s = NF_TEXT[lang] || NF_TEXT.es;
  const htmlLang = lang === 'ch' ? 'zh-Hans' : lang === 'br' ? 'pt-BR' : lang;
  const home = lang === 'es' ? '/' : '/' + lang + '/';
  const safe = String(reqPath).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '<!DOCTYPE html><html lang="' + htmlLang + '"><head><meta charset="UTF-8"/>'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>'
    + '<meta name="robots" content="noindex"/>'
    + '<title>404 · InteeBuild</title>'
    + '<style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(1000px 500px at 50% -10%,rgba(79,70,229,.18),transparent 60%),#0b0f1a;font-family:Inter,-apple-system,Segoe UI,Arial,sans-serif;color:#e2e8f0;padding:24px}'
    + '.card{max-width:520px;text-align:center;background:#101722;border:1px solid #202b3b;border-radius:18px;padding:44px 32px;box-shadow:0 20px 60px rgba(0,0,0,.5)}'
    + '.code{font-size:74px;font-weight:800;letter-spacing:4px;background:linear-gradient(180deg,#fff,#818cf8);-webkit-background-clip:text;background-clip:text;color:transparent;line-height:1}'
    + 'h1{font-size:20px;margin:14px 0 8px}p{color:#94a3b8;font-size:14px;line-height:1.6}'
    + '.path{display:inline-block;margin-top:14px;font-family:monospace;font-size:12px;color:#38bdf8;background:#0b0f1a;border:1px solid #202b3b;padding:6px 10px;border-radius:8px;word-break:break-all}'
    + '.btns{display:flex;gap:10px;justify-content:center;margin-top:24px;flex-wrap:wrap}a.b{display:inline-block;padding:11px 18px;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none}'
    + 'a.p{background:#4f46e5;color:#fff}a.p:hover{background:#4338ca}a.s{border:1px solid #2b3a52;color:#cbd5e1}a.s:hover{border-color:#4f46e5;color:#fff}'
    + 'small{display:block;margin-top:22px;color:#64748b;font-size:11px}</style></head><body>'
    + '<div class="card"><div class="code">404</div><h1>' + s.t + '</h1><p>' + s.m + '</p>'
    + '<span class="path">' + safe + '</span>'
    + '<div class="btns"><a class="b p" href="' + home + '">' + s.h + '</a>'
    + '<a class="b s" href="https://inteebuild.onrender.com/">' + s.c + '</a></div>'
    + '<small>InteeBuild</small></div></body></html>';
}

app.use((req, res) => {
  if (req.path === '/api' || req.path.indexOf('/api/') === 0) return res.status(404).json({ error: 'Not found' });
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(404).json({ error: 'Not found' });
  const lm = req.path.match(LANG_RE);
  res.status(404);
  res.setHeader('Cache-Control', 'no-store');
  res.send(notFoundPage(lm ? lm[1] : 'es', req.path));
});

setInterval(() => {
  const g = deps.gh.config();
  if (!g.ready) return;
  deps.gh.cleanup(g.owner, g.repo).then(
    r => { if (r.branches || r.runs || r.artifacts) console.log(`[auto-cleanup] ramas:${r.branches} runs:${r.runs} artifacts:${r.artifacts}`); },
    () => {}
  );
}, 30 * 60 * 1000);

app.listen(PORT, () => {
  const g = deps.gh.config();
  console.log(`\n  InteeBuild v${deps.VERSION}  ->  http://localhost:${PORT}`);
  console.log(`  GitHub: ${g.ready ? `listo (${g.owner}/${g.repo})` : 'SIN CONFIGURAR (revisa .env)'}\n`);
});
