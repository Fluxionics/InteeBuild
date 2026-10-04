'use strict';

const JSZip = require('jszip');


const { artifactFormat } = require('./artifacts');


function formatsFromArtifacts(artifacts) {
  const formats = [];
  for (const artifact of artifacts || []) {
    const format = artifactFormat(artifact.name);
    if (format && !formats.includes(format)) formats.push(format);
  }
  return formats;
}

module.exports = function registerBuildRoutes(app, ctx) {
  const { gh, generator, templates, configFromBody, isBlockedUrl, startBuild, requireApiKey, checkRateLimit, builds, loadHistory, addSSEListener, removeSSEListener } = ctx;

  async function availableFormats(state) {
    if (!state.runId) return [];
    const g = gh.config();
    if (!g.ready) return formatsFromArtifacts(state.artifacts);
    try {
      return formatsFromArtifacts(await gh.getArtifacts(g.owner, g.repo, state.runId));
    } catch (_) {

      return formatsFromArtifacts(state.artifacts);
    }
  }

  app.get('/api/build/:id/logs', async (req, res) => {
    const state = builds.get(req.params.id);
    if (!state || !state.runId) return res.status(404).json({ error: 'Logs no disponibles aun' });
    const g = gh.config();
    try {
      const logs = await gh.getRunLogs(g.owner, g.repo, state.runId);
      res.json({ logs: logs.substring(0, 500000) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  const sseRateLimits = new Map();
const MAX_SSE_PER_IP = 5;

function checkSSELimit(ip) {
  const now = Date.now();
  const entry = sseRateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    sseRateLimits.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= MAX_SSE_PER_IP) return false;
  entry.count++;
  return true;
}

  app.get('/api/build/:id/stream', async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    if (!checkSSELimit(ip)) {
      return res.status(429).json({ error: 'Demasiadas conexiones SSE desde esta IP (max 5)' });
    }

    const buildId = req.params.id;
    const state = builds.get(buildId);
    if (!state) {
      return res.status(404).json({ error: 'Build no encontrado' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent('state', {
      phase: state.phase,
      percent: state.percent,
      step: state.step,
      queuePos: state.queuePos,
      actionsSteps: state.actionsSteps,
      status: state.status,
      error: state.error,
      runUrl: state.runUrl,
      apkUrl: state.apkUrl,
      artifacts: state.artifacts
    });

    const listener = (event, data) => {
      sendEvent(event, data);
    };

    addSSEListener(buildId, listener);

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    const cleanup = () => {
      clearInterval(heartbeat);
      removeSSEListener(buildId, listener);
      res.end();
    };

    req.on('close', cleanup);

    if (state.status === 'success' || state.status === 'failed' || state.status === 'error') {
      sendEvent('end', { status: state.status });
      setTimeout(cleanup, 100);
    }
  });

  app.get('/api/build/:id', async (req, res) => {
    const state = builds.get(req.params.id);
    if (!state) {
      const history = loadHistory();
      const h = history.find(x => x.id === req.params.id);
      if (h) return res.json({ ...h, fromHistory: true });
      return res.status(404).json({ error: 'Build no encontrado' });
    }
    res.json({
      id: state.id, status: state.status, step: state.step,
      runUrl: state.runUrl, apkUrl: state.apkUrl, artifacts: state.artifacts,
      error: state.error, appName: state.appName, outputType: state.outputType,
      outputs: state.outputs || [],
      formats: await availableFormats(state),
      phase: state.phase, percent: state.percent, queuePos: state.queuePos,
      actionsSteps: state.actionsSteps || []
    });
  });

  app.post('/api/project', async (req, res) => {
    try {
      const cfg = configFromBody(req.body);
      if (cfg.inputType === 'url' && isBlockedUrl(cfg.url)) throw Object.assign(new Error('URL bloqueada por seguridad'), { status: 400 });
      if (cfg.inputType === 'html' && cfg.htmlCode.length > 500000) throw Object.assign(new Error('HTML demasiado grande (max 500KB)'), { status: 400 });
      cfg._buildId = 'zip';
      const files = generator.generateFiles(cfg);
      const zip = new JSZip();
      for (const [name, content] of Object.entries(files)) zip.file(name, content);
      const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      const safe = cfg.appName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="inteebuild-${safe}.zip"`);
      res.send(buf);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/build', async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Rate limit: 10/h por IP' });
    let cfg;
    try {
      cfg = configFromBody(req.body);
      if (cfg.inputType === 'url' && isBlockedUrl(cfg.url)) throw Object.assign(new Error('URL bloqueada por seguridad (localhost/IP privada)'), { status: 400 });
      if (cfg.inputType === 'html' && cfg.htmlCode.length > 500000) throw Object.assign(new Error('HTML demasiado grande (max 500KB)'), { status: 400 });
      if (cfg.iconBase64 && cfg.iconBase64.length > 7 * 1024 * 1024) throw Object.assign(new Error('Icono demasiado grande'), { status: 400 });
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }

    try {
      const result = await startBuild(cfg, ip);
      res.status(202).json(result);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/v1/build', requireApiKey('build'), async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const body = req.body || {};

    const rawCfg = templates.applyTemplate({
      url: body.url,
      appName: body.name || body.appName,
      packageName: body.package || body.packageName,
      outputType: body.output || body.outputType || 'apk',
      outputs: body.outputs,
      platform: body.platform,
      inputType: body.inputType || 'url',
      htmlCode: body.htmlCode,
      webhookUrl: body.webhookUrl || '',
      versionName: body.versionName || '1.0.0',
      versionCode: body.versionCode || 1,
      compileSdk: body.compileSdk || 35,
      targetSdk: body.targetSdk || 35,
      minSdk: body.minSdk || 23,
      permissions: body.permissions || {},
      plugins: body.plugins || {},
      provider: body.provider || 'capacitor',
      streamUrl: body.streamUrl || '',
      nativeAudio: !!body.nativeAudio,
      nativeAutoplay: body.nativeAutoplay !== undefined ? !!body.nativeAutoplay : true
    }, body.template);

    let cfg;
    try {
      cfg = generator.normalizeConfig(rawCfg);
      if (cfg.inputType === 'url' && isBlockedUrl(cfg.url)) throw Object.assign(new Error('URL bloqueada'), { status: 400 });
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }

    try {
      const result = await startBuild(cfg, ip);
      res.status(202).json({ buildId: result.id, status: result.status, branch: result.branch });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.get('/api/v1/build/:id', async (req, res) => {
    const state = builds.get(req.params.id);
    if (!state) {
      const h = loadHistory().find(x => x.id === req.params.id);
      if (h) return res.json({ buildId: h.id, status: h.status, apkUrl: h.apkUrl, runUrl: h.runUrl, error: h.error });
      return res.status(404).json({ error: 'Build no encontrado' });
    }
    res.json({
      buildId: state.id, status: state.status, step: state.step,
      apkUrl: state.apkUrl ? `/api/download/${state.id}` : null,
      aabUrl: state.artifacts && state.artifacts.some(a => a.name.includes('aab')) ? `/api/download/${state.id}/aab` : null,
      ipaUrl: state.artifacts && state.artifacts.some(a => a.name.includes('ipa')) ? `/api/download/${state.id}/ipa` : null,
      outputs: state.outputs || [],
      formats: await availableFormats(state),
      runUrl: state.runUrl, error: state.error, appName: state.appName,
      phase: state.phase, percent: state.percent, queuePos: state.queuePos,
      actionsSteps: state.actionsSteps || []
    });
  });
};
