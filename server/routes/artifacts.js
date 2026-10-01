'use strict';

const JSZip = require('jszip');






const DOWNLOADS = {
  apk: { suffix: 'apk', ext: 'apk', mime: 'application/vnd.android.package-archive', fallbackFirst: true, notFound: 'APK no encontrado' },
  aab: { suffix: 'aab', ext: 'aab', mime: 'application/octet-stream', fallbackFirst: false, notFound: 'AAB no encontrado' },
  ipa: { suffix: 'ipa', ext: 'ipa', mime: 'application/octet-stream', fallbackFirst: false, notFound: 'IPA no encontrado (firma iOS requerida)' },
  xapk: { suffix: 'xapk', ext: 'xapk', mime: 'application/octet-stream', fallbackFirst: false, notFound: 'XAPK no encontrado' },
  apks: { suffix: 'apks', ext: 'apks', mime: 'application/octet-stream', fallbackFirst: false, notFound: 'APKS no encontrado' },
  exe: { suffix: 'exe', ext: 'exe', mime: 'application/octet-stream', fallbackFirst: false, notFound: 'EXE no encontrado' },
  msi: { suffix: 'msi', ext: 'msi', mime: 'application/octet-stream', fallbackFirst: false, notFound: 'MSI no encontrado' },
  dmg: { suffix: 'dmg', ext: 'dmg', mime: 'application/octet-stream', fallbackFirst: false, notFound: 'DMG no encontrado' },
  appimage: { suffix: 'appimage', ext: 'AppImage', mime: 'application/octet-stream', fallbackFirst: false, notFound: 'AppImage no encontrado' }
};



function matchesSuffix(name, suffix) {
  const value = String(name || '').toLowerCase();
  return value === suffix || value.endsWith('-' + suffix);
}



function artifactFormat(name) {
  return Object.keys(DOWNLOADS).find((key) => matchesSuffix(name, DOWNLOADS[key].suffix)) || null;
}

function downloadPath(buildId, format) {
  return format === 'apk' ? `/api/download/${buildId}` : `/api/download/${buildId}/${format}`;
}

module.exports = function registerArtifactRoutes(app, ctx) {
  const { gh, builds, loadHistory } = ctx;

  async function serveDownload(req, res, fmt) {
    const spec = DOWNLOADS[fmt];
    if (!spec) {
      return res.status(404).json({ error: `Formato no disponible: ${fmt}. Formatos soportados: ${Object.keys(DOWNLOADS).join(', ')}` });
    }
    const state = builds.get(req.params.id);
    if (!state) return res.status(404).json({ error: 'Build no encontrado' });
    if (!state.runId) return res.status(404).json({ error: 'Build aun en progreso' });
    const g = gh.config();
    if (!g.ready) return res.status(503).json({ error: 'GitHub no configurado' });
    try {
      const arts = await gh.getArtifacts(g.owner, g.repo, state.runId);
      const found = arts.find((a) => matchesSuffix(a.name, spec.suffix));
      const art = spec.fallbackFirst ? (found || arts[0]) : found;
      if (!art) return res.status(404).json({ error: spec.notFound });
      const response = await gh.downloadArtifact(g.owner, g.repo, art.id);
      const buf = Buffer.from(await response.arrayBuffer());
      const zip = await JSZip.loadAsync(buf);
      const ext = '.' + spec.ext.toLowerCase();
      const binEntry = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith(ext));
      if (binEntry) {
        const binBuf = await zip.files[binEntry].async('nodebuffer');
        const safe = (state.appName || 'app').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        res.setHeader('Content-Type', spec.mime);
        res.setHeader('Content-Disposition', `attachment; filename="${safe}.${spec.ext}"`);
        return res.send(binBuf);
      }
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${state.appName || 'app'}.${spec.ext}.zip"`);
      res.send(buf);
    } catch (err) {
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  }

  app.get('/api/qr/:id', async (req, res) => {
    const state = builds.get(req.params.id) || loadHistory().find(x => x.id === req.params.id);
    if (!state) return res.status(404).json({ error: 'Build no encontrado' });

    const host = req.headers.host || 'localhost';
    const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const downloadUrl = `${proto}://${host}/api/download/${req.params.id}`;

    const size = parseInt(req.query.size) || 200;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(downloadUrl)}&format=png&ecc=M`;

    try {
      const r = await fetch(qrApiUrl, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error('QR API error');
      const buf = Buffer.from(await r.arrayBuffer());
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(buf);
    } catch (_) {
      res.status(502).json({ error: 'No se pudo generar el QR', downloadUrl });
    }
  });

  app.get('/api/apk-info/:id', async (req, res) => {
    const state = builds.get(req.params.id);
    if (!state) return res.status(404).json({ error: 'Build no encontrado' });
    if (state.status !== 'success') return res.status(400).json({ error: 'Build no completado aun' });

    const g = gh.config();
    if (!g.ready) return res.status(503).json({ error: 'GitHub no configurado' });

    try {
      const arts = await gh.getArtifacts(g.owner, g.repo, state.runId);
      const art = arts.find(a => matchesSuffix(a.name, DOWNLOADS.apk.suffix)) || arts[0];
      if (!art) return res.status(404).json({ error: 'APK no encontrado' });

      const info = {
        buildId: state.id,
        appName: state.appName,
        outputType: state.outputType,
        artifactName: art.name,
        artifactSizeMB: art.size_in_bytes ? (art.size_in_bytes / 1024 / 1024).toFixed(2) : '?',
        createdAt: state.createdAt,
        runUrl: state.runUrl,
        artifacts: (state.artifacts || []).map(a => {
          const format = artifactFormat(a.name) || 'apk';
          return { name: a.name, type: format.toUpperCase(), download: downloadPath(state.id, format) };
        })
      };

      res.json(info);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/download/:id', (req, res) => serveDownload(req, res, 'apk'));
  app.get('/api/download/:id/aab', (req, res) => serveDownload(req, res, 'aab'));
  app.get('/api/download/:id/ipa', (req, res) => serveDownload(req, res, 'ipa'));
  app.get('/api/download/:id/:fmt', (req, res) => serveDownload(req, res, String(req.params.fmt || '').toLowerCase()));
};


module.exports.DOWNLOADS = DOWNLOADS;
module.exports.artifactFormat = artifactFormat;
