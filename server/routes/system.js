'use strict';

const CLEANUP_SECRET = process.env.CLEANUP_SECRET || '';

module.exports = function registerSystemRoutes(app, ctx) {
  const { gh, VERSION, loadHistory, saveHistory, safeEq, pruneData } = ctx;

  app.get('/api/health', (req, res) => {
    const g = gh.config();
    res.json({ ok: true, service: 'InteeBuild', version: VERSION, githubReady: g.ready });
  });

  app.get('/api/diag', async (req, res) => {
    const g = gh.config();
    const out = {
      ok: false,
      env: { hasToken: !!g.token, hasRepo: !!(g.owner && g.repo), defaultBranch: g.defaultBranch },
      token: { valid: false, hint: 'Sin token configurado' },
      repo: { reachable: false, hint: '' },
      branch: { exists: false, hint: '' },
      workflow: { registered: false, hint: '' }
    };
    if (!g.ready) {
      out.repo.hint = 'Configura GITHUB_TOKEN e INTEE_BUILDS_REPO en .env o en Render > Environment.';
      return res.json(out);
    }
    const headers = {
      Authorization: `Bearer ${g.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'InteeBuild-diag'
    };
    const get = async (p) => {
      const r = await fetch(`https://api.github.com${p}`, { headers, signal: AbortSignal.timeout(10000) });
      return r;
    };
    try {
      const u = await get('/user');
      if (u.status === 401) { out.token.hint = 'Token inválido o revocado. Genera uno nuevo.'; return res.json(out); }
      if (!u.ok) { out.token.hint = `GitHub respondió ${u.status}. Reintenta en un momento.`; return res.json(out); }
      out.token.valid = true;
      out.token.hint = 'Token válido.';
    } catch (_) { out.token.hint = 'Sin conexión a api.github.com desde el servidor.'; return res.json(out); }
    try {
      const r = await get(`/repos/${g.owner}/${g.repo}`);
      if (r.status === 404) { out.repo.hint = 'Repo no existe o el token no tiene acceso. Revisa INTEE_BUILDS_REPO (formato usuario/repo) y los permisos del token.'; return res.json(out); }
      if (!r.ok) { out.repo.hint = `GitHub respondió ${r.status}.`; return res.json(out); }
      const info = await r.json();
      out.repo.reachable = true;
      out.repo.hint = 'Repo accesible.';
      if (info.default_branch && info.default_branch !== g.defaultBranch) {
        out.branch.hint = `La rama por defecto del repo es "${info.default_branch}" pero usas "${g.defaultBranch}". Ajusta INTEE_DEFAULT_BRANCH.`;
      }
    } catch (_) { out.repo.hint = 'Error de red consultando el repo.'; return res.json(out); }
    try {
      const b = await get(`/repos/${g.owner}/${g.repo}/branches/${g.defaultBranch}`);
      if (b.status === 404) { out.branch.hint = `La rama "${g.defaultBranch}" no existe en el repo. Créala o ajusta INTEE_DEFAULT_BRANCH.`; return res.json(out); }
      if (!b.ok) { out.branch.hint = `GitHub respondió ${b.status}.`; return res.json(out); }
      out.branch.exists = true;
      if (!out.branch.hint) out.branch.hint = 'Rama base OK.';
    } catch (_) { out.branch.hint = 'Error de red consultando la rama.'; return res.json(out); }
    try {
      const w = await get(`/repos/${g.owner}/${g.repo}/contents/.github/workflows/build-app.yml?ref=${g.defaultBranch}`);
      if (w.status === 404) {
        out.workflow.hint = 'Aún no hay workflow en la rama base. Se creará solo con el próximo build (syncWorkflow).';
        return res.json(out);
      }
      if (!w.ok) { out.workflow.hint = `GitHub respondió ${w.status}.`; return res.json(out); }
      const body = await w.json();
      const text = Buffer.from(body.content || '', 'base64').toString('utf-8');
      if (text.includes('workflow_dispatch')) {
        out.workflow.registered = true;
        out.workflow.hint = 'Workflow registrado con trigger workflow_dispatch.';
        out.ok = true;
      } else {
        out.workflow.hint = 'El archivo existe pero no tiene trigger workflow_dispatch. Se reescribirá en el próximo build.';
      }
    } catch (_) { out.workflow.hint = 'Error de red consultando el workflow.'; }
    return res.json(out);
  });

  app.get('/api/history', (req, res) => {
    res.json(loadHistory().slice(0, 30));
  });

  app.delete('/api/history', (req, res) => {
    saveHistory([]);
    res.json({ ok: true });
  });

  app.get('/api/history/:id', (req, res) => {
    const h = loadHistory().find(x => x.id === req.params.id);
    if (!h) return res.status(404).json({ error: 'Build no encontrado en el historial' });
    res.json(h);
  });

  app.delete('/api/history/:id', (req, res) => {
    const history = loadHistory();
    const idx = history.findIndex(x => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Build no encontrado en el historial' });
    history.splice(idx, 1);
    saveHistory(history);
    res.json({ ok: true });
  });

  app.get('/api/stats', (req, res) => {
    const h = loadHistory();
    const total = h.length;
    const ok = h.filter(x => x.status === 'success').length;
    const fail = h.filter(x => x.status === 'failed' || x.status === 'error').length;
    const building = h.filter(x => x.status === 'building' || x.status === 'queued').length;
    const apk = h.filter(x => x.outputType === 'apk').length;
    const aab = h.filter(x => x.outputType === 'aab').length;
    const both = h.filter(x => x.outputType === 'both').length;
    const ios = h.filter(x => x.platform === 'ios' || x.platform === 'both').length;
    const done = h.filter(x => x.status === 'success' && x.duration);
    const avgSec = done.length ? Math.round(done.reduce((a, b) => a + (b.duration || 0), 0) / done.length) : 0;
    res.json({ total, ok, fail, building, apk, aab, both, ios, avgSec });
  });

  app.get('/api/docs', (req,res)=>{
    res.json({
      version:VERSION,
      free:'Todo gratis y local: sin planes de pago, sin API keys de IA, sin monetización.',
      endpoints:{
        health:'GET /api/health',
        analyze:'GET /api/analyze?url= & POST /api/analyze/html',
        fix:'POST /api/analyze/fix',
        build:'POST /api/build (o /api/v1/build con X-API-Key)',
        download:'GET /api/download/:id',
        keys:'GET/POST /api/keys, DELETE /api/keys/:id',
        gitConnect:'POST /api/git/connect {repo,branch,token}',
        gitWebhook:'POST /api/git/webhook',
        decompile:'POST /api/decompile (JSON {apkBase64} o raw octet-stream, max 100MB)',
        decompileCloud:'POST /api/decompile/cloud + GET /api/decompile/cloud/:id/status y /download (jadx + apktool en GitHub Actions)',
        manifestDiff:'POST /api/manifest-diff (pedido vs generado)',
        inspect:'POST /api/inspect (ficha + score del APK)',
        templates:'GET /api/templates, GET /api/templates/:id',
        listing:'POST /api/listing (ficha Play Store gratis)',
        securityAudit:'POST /api/security-audit (GDPR + permisos + privacy)',
        privacyPolicy:'GET /api/privacy-policy?appName=&package=',
        versions:'GET /api/versions/:appId, POST /api/versions/publish, GET /api/check-update',
        cicd:'POST /api/cicd (workflow gratis para auto-build on push)'
      },
      examples:{
        curl:'curl -X POST /api/build -H "Content-Type: application/json" -d \'{"url":"https://tu-sitio.com","appName":"Mi App"}\'',
        node:'const r = await fetch("/api/build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "https://tu-sitio.com", appName: "Mi App" }) });\nconst b = await r.json(); console.log(b.id);'
      },
      auth:'Header X-API-Key o Authorization: Bearer ib_... (opcional si no hay keys, obligatorio si existen)',
      permissions:'Permisos granulares nativos: runtime request + manifest + WebChromeClient grant selectivo + plugins auto'
    });
  });

  app.get('/api/cleanup', (req, res) => {
    if (!CLEANUP_SECRET) return res.status(403).json({ error: 'Limpieza manual desactivada. Configura CLEANUP_SECRET para activarla.' });
    if (req.query.secret !== CLEANUP_SECRET) return res.status(403).json({ error: 'Secret requerido' });
    const g = gh.config();
    if (!g.ready) return res.status(503).json({ error: 'GitHub no esta configurado' });
    gh.cleanup(g.owner, g.repo).then(
      r => res.json({ ok: true, ...r, data: typeof pruneData === 'function' ? pruneData() : null }),
      err => res.status(500).json({ error: err.message })
    );
  });

  app.get('/api/logs/txt', (req, res) => {
    const adminToken = process.env.ADMIN_TOKEN || '';
    const cleanupSecret = process.env.CLEANUP_SECRET || '';
    const q = String(req.query.secret || '');
    const h = String(req.get('x-admin-token') || '');
    const okToken = !!adminToken && (safeEq(h, adminToken) || safeEq(q, adminToken));
    const okSecret = !!cleanupSecret && safeEq(q, cleanupSecret);
    if (!okToken && !okSecret) {
      if (!adminToken && !cleanupSecret) return res.status(403).json({ error: 'Logs desactivados. Configura ADMIN_TOKEN (header X-Admin-Token) o CLEANUP_SECRET (?secret=...).' });
      return res.status(403).json({ error: 'Secret invalido' });
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', 'attachment; filename="inteebuild-logs.txt"');
    const txt = require('../logger').read();
    res.send(txt || '(sin registros aun)');
  });
};
