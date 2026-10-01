'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');

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
