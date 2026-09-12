'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const JSZip = require('jszip');

const generator = require('./generator');
const gh = require('./github');
const packageJson = require('../package.json');
const VERSION = packageJson.version;

const app = express();
const PORT = process.env.PORT || 8787;
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'builds.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]', 'utf-8');

const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || null;
app.use(cors(ALLOWED_ORIGIN ? { origin: ALLOWED_ORIGIN } : { origin: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(ROOT, { index: 'index.html' }));

const builds = new Map();
const rateLimits = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 3600000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function isPrivateHost(host) {
  return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|0\.0\.0\.0|::1|fc00:|fe80:|169\.254\.)/i.test(host);
}

function isMetadataEndpoint(host) {
  return /^(169\.254\.169\.254|metadata\.google\.internal|100\.100\.100\.200)$/i.test(host);
}

function isBlockedUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (!/^https?:$/.test(u.protocol)) return true;
    if (isPrivateHost(u.hostname)) return true;
    if (isMetadataEndpoint(u.hostname)) return true;
    return false;
  } catch { return true; }
}

function loadHistory() {
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')); }
  catch (_) { return []; }
}

function saveHistory(arr) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(arr.slice(-50), null, 2), 'utf-8');
}

function addHistory(entry) {
  const history = loadHistory();
  history.unshift(entry);
  saveHistory(history);
}

function updateHistory(id, updates) {
  const history = loadHistory();
  const idx = history.findIndex(h => h.id === id);
  if (idx !== -1) { Object.assign(history[idx], updates); saveHistory(history); }
}

async function fireWebhook(url, payload) {
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'InteeBuild-Webhook/1.0' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });
  } catch (_) {}
}

function detectFramework(html) {
  const checks = {
    react: /__reactFiber|react-dom|React\.createElement|_jsx\(|from 'react'/.test(html),
    vue: /Vue\.createApp|createApp\(|v-bind:|v-if=|vue\.global\.js|from 'vue'/.test(html),
    angular: /ng-version|ng-app|angular\.js|from '@angular\/core'|\[ngFor\]|ng2\b/.test(html),
    nextjs: /__NEXT_DATA__|next\/router|_next\/static|next\.js/.test(html),
    nuxt: /__nuxt__|nuxt\.config|_nuxt\//.test(html),
    svelte: /svelte|__svelte_/.test(html),
    astro: /astro:|@astrojs|astro-island/.test(html),
    vite: /vite\.svg|@vite\/client|vite\.config/.test(html),
    wordpress: /wp-content\/|wp-json\/|wordpress/.test(html),
    shopify: /shopify\.com|cdn\.shopify\.com|Shopify\.theme/.test(html),
    webflow: /webflow\.com|\.webflow\.io|webflow\.js/.test(html),
    wix: /wix\.com|wixstatic\.com|wix-static/.test(html),
    bubble: /bubble\.io|bubble-element/.test(html),
    lovable: /lovable\.app|lovable-uploads/.test(html),
    replit: /replit\.com|repl\.co/.test(html),
    bootstrap: /bootstrap\.min\.css|bootstrap\.bundle/.test(html),
    tailwind: /tailwind\.config|cdn\.tailwindcss\.com|tailwindcss/.test(html)
  };

  const found = Object.entries(checks).filter(([, v]) => v).map(([k]) => k);
  if (!found.length) found.push('html');
  return found;
}

function detectWebApis(html) {
  const apis = {
    geolocation: /navigator\.geolocation|getCurrentPosition|watchPosition/.test(html),
    camera: /getUserMedia|getDisplayMedia|MediaDevices|navigator\.mediaDevices/.test(html),
    microphone: /getUserMedia.*audio|audio.*getUserMedia|AudioContext|webkitAudioContext/.test(html),
    bluetooth: /navigator\.bluetooth|requestDevice.*bluetooth/.test(html),
    nfc: /navigator\.nfc|NDEFReader/.test(html),
    notifications: /Notification\.|requestPermission.*notification|PushManager/.test(html),
    vibration: /navigator\.vibrate/.test(html),
    share: /navigator\.share\b|Web Share/.test(html),
    fullscreen: /requestFullscreen|webkitRequestFullscreen|fullscreenchange/.test(html),
    orientation: /screen\.orientation|lockOrientation/.test(html),
    localStorage: /localStorage\.|window\.localStorage/.test(html),
    indexedDB: /indexedDB\.|IDBFactory|openDatabase/.test(html),
    serviceWorker: /serviceWorker|navigator\.serviceWorker/.test(html),
    webgl: /WebGLRenderingContext|getContext\('webgl'\)/.test(html),
    payment: /PaymentRequest|payment-request/.test(html),
    clipboard: /navigator\.clipboard|Clipboard API/.test(html),
    wakelock: /WakeLock|navigator\.wakeLock/.test(html)
  };

  return Object.entries(apis).filter(([, v]) => v).map(([k]) => k);
}

function buildRecommendations(detectedApis) {
  const map = {
    geolocation: { label: 'Permiso GPS + Plugin Geolocation', permissions: ['gps'], plugins: ['geolocation'] },
    camera: { label: 'Permiso Cámara/Micrófono + Plugin Camera', permissions: ['cameraMic'], plugins: ['camera'] },
    microphone: { label: 'Permiso Micrófono', permissions: ['microphone'], plugins: [] },
    bluetooth: { label: 'Permiso Bluetooth + Plugin Bluetooth LE', permissions: ['bluetooth'], plugins: ['bluetooth'] },
    nfc: { label: 'Permiso NFC + Plugin NFC', permissions: ['nfc'], plugins: ['nfc'] },
    notifications: { label: 'Plugin Push Notifications + Permiso Notificaciones', permissions: ['notifications'], plugins: ['notifications'] },
    vibration: { label: 'Permiso Vibración + Plugin Haptics', permissions: ['vibration'], plugins: ['haptics'] },
    share: { label: 'Plugin Share nativo', permissions: [], plugins: ['share'] },
    wakelock: { label: 'Permiso Wake Lock + Plugin Screen', permissions: ['wakeLock'], plugins: [] },
    clipboard: { label: 'Plugin Clipboard nativo', permissions: [], plugins: ['clipboard'] }
  };

  return detectedApis
    .filter(api => map[api])
    .map(api => ({ api, ...map[api] }));
}

app.get('/api/health', (req, res) => {
  const g = gh.config();
  res.json({ ok: true, service: 'InteeBuild', version: VERSION, githubReady: g.ready });
});

app.get('/api/history', (req, res) => {
  res.json(loadHistory().slice(0, 30));
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
  const done = h.filter(x => x.status === 'success' && x.duration);
  const avgSec = done.length ? Math.round(done.reduce((a, b) => a + (b.duration || 0), 0) / done.length) : 0;
  res.json({ total, ok, fail, building, apk, aab, both, ios, avgSec });
});

app.get('/api/analyze', async (req, res) => {
  const url = String(req.query.url || '').trim();
  if (!url) return res.status(400).json({ error: 'Falta url' });
  if (isBlockedUrl(url)) return res.status(400).json({ error: 'URL bloqueada por seguridad' });

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'InteeBuild-Analyzer/2.0 Mozilla/5.0' },
      redirect: 'manual',
      signal: AbortSignal.timeout(10000)
    });

    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get('location');
      if (loc) {
        const resolved = new URL(loc, url).toString();
        if (isBlockedUrl(resolved)) return res.status(400).json({ error: 'Redireccion a URL privada bloqueada' });
      }
    }

    const html = await r.text();
    if (html.length > 500000) return res.status(400).json({ error: 'HTML demasiado grande' });

    const insecure = (html.match(/src=["']http:\/\//gi) || []).length + (html.match(/href=["']http:\/\//gi) || []).length;
    const contentType = r.headers.get('content-type') || '';
    const isHtml = /text\/html/.test(contentType) || /<html/i.test(html);

    const checks = {
      https: url.startsWith('https://'),
      reachable: r.ok || r.status < 400,
      viewport: /\<meta[^>]*viewport/i.test(html),
      manifest: /\<link[^>]*rel=["']manifest["']/i.test(html),
      favicon: /\<link[^>]*rel=["'](icon|shortcut icon)["']/i.test(html),
      themeColor: /\<meta[^>]*name=["']theme-color["']/i.test(html),
      serviceWorker: /serviceWorker|navigator\.serviceWorker/i.test(html),
      insecureResources: insecure === 0,
      htmlErrors: /<!DOCTYPE html/i.test(html) && /<html/i.test(html),
      pwa: false,
      robots: /\<meta[^>]*name=["']robots["']/i.test(html),
      openGraph: /property=["']og:/i.test(html),
      structuredData: /application\/ld\+json/.test(html)
    };
    checks.pwa = checks.manifest && checks.serviceWorker;

    let score = 0;
    if (checks.https) score += 15; else score -= 10;
    if (checks.reachable) score += 15;
    if (checks.viewport) score += 20; else score -= 10;
    if (checks.manifest) score += 10;
    if (checks.favicon) score += 5; else score -= 3;
    if (checks.themeColor) score += 5;
    if (checks.serviceWorker) score += 15;
    if (insecure === 0) score += 10; else score -= Math.min(20, insecure * 2);
    if (checks.htmlErrors) score += 5; else score -= 10;
    if (checks.openGraph) score += 3;
    score = Math.max(0, Math.min(100, score));

    const diag = score >= 90 ? 'Listo para compilar' : score >= 70 ? 'Bueno, con mejoras menores' : score >= 50 ? 'Necesita ajustes' : 'Requiere correcciones';

    const frameworks = detectFramework(html);
    const detectedApis = detectWebApis(html);
    const recommendations = buildRecommendations(detectedApis);

    let pwaData = null;
    if (checks.manifest) {
      try {
        const manifestUrls = [
          ...[...html.matchAll(/\<link[^>]*rel=["']manifest["'][^>]*href=["']([^"']+)["']/gi)].map(m => new URL(m[1], url).toString()),
          new URL('/manifest.json', url).toString(),
          new URL('/manifest.webmanifest', url).toString()
        ];
        for (const mUrl of manifestUrls) {
          if (isBlockedUrl(mUrl)) continue;
          try {
            const mr = await fetch(mUrl, { signal: AbortSignal.timeout(4000) });
            if (mr.ok) { pwaData = await mr.json(); break; }
          } catch (_) {}
        }
      } catch (_) {}
    }

    res.json({ url, status: r.status, checks, score, diag, pwa: pwaData, insecureCount: insecure, frameworks, detectedApis, recommendations });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo analizar: ' + e.message });
  }
});

app.get('/api/build/:id/logs', async (req, res) => {
  const state = builds.get(req.params.id);
  if (!state || !state.runId) return res.status(404).json({ error: 'Logs no disponibles aun' });
  const g = gh.config();
  try {
    const logs = await gh.getRunLogs(g.owner, g.repo, state.runId);
    res.json({ logs: logs.substring(0, 80000) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/build/:id', (req, res) => {
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
    error: state.error, appName: state.appName, outputType: state.outputType
  });
});

app.post('/api/project', async (req, res) => {
  try {
    const cfg = generator.normalizeConfig(req.body || {});
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

async function startBuild(cfg, ip) {
  const g = gh.config();
  if (!g.ready) throw Object.assign(new Error('GitHub no esta configurado. Define GITHUB_TOKEN e INTEE_BUILDS_REPO en el archivo .env'), { status: 503 });
  if (!checkRateLimit(ip)) throw Object.assign(new Error('Limite de builds alcanzado (10 por hora). Intenta despues.'), { status: 429 });

  const id = crypto.randomBytes(4).toString('hex');
  cfg._buildId = id;
  const branch = `build-${id}`;
  const files = generator.generateFiles(cfg);

  const state = {
    id, branch, appName: cfg.appName, status: 'queued',
    step: 'Enviando proyecto a GitHub', createdAt: Date.now(),
    runUrl: null, runId: null, apkUrl: null, outputType: cfg.outputType,
    error: null, webhookUrl: cfg.webhookUrl || ''
  };
  builds.set(id, state);

  addHistory({
    id, appName: cfg.appName, status: 'queued', outputType: cfg.outputType,
    createdAt: state.createdAt, runUrl: null, apkUrl: null, error: null
  });

  try {
    state.step = 'Sincronizando workflow';
    await gh.syncWorkflow(g.owner, g.repo, g.defaultBranch, generator.WORKFLOW_YML);
    state.step = 'Subiendo proyecto';
    await gh.pushProject(g.owner, g.repo, branch, files, g.defaultBranch);
    state.status = 'building';
    state.step = 'Lanzando compilacion en GitHub Actions';
    await gh.dispatchBuild(g.owner, g.repo, branch, id, cfg.outputType, cfg.platform);
    updateHistory(id, { status: 'building' });
    pollBuild(g, state);
  } catch (err) {
    state.status = 'error';
    state.step = 'Error';
    state.error = err.message;
    updateHistory(id, { status: 'error', error: err.message });
    await fireWebhook(state.webhookUrl, { event: 'build.error', buildId: id, status: 'error', error: err.message });
  }

  return { id, branch, status: state.status };
}

app.post('/api/build', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  let cfg;
  try {
    cfg = generator.normalizeConfig(req.body || {});
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

app.post('/api/v1/build', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const body = req.body || {};

  const rawCfg = {
    url: body.url,
    appName: body.name || body.appName,
    packageName: body.package || body.packageName,
    outputType: body.output || body.outputType || 'apk',
    inputType: body.inputType || 'url',
    htmlCode: body.htmlCode,
    webhookUrl: body.webhookUrl || '',
    versionName: body.versionName || '1.0.0',
    versionCode: body.versionCode || 1,
    compileSdk: body.compileSdk || 35,
    targetSdk: body.targetSdk || 35,
    minSdk: body.minSdk || 23,
    permissions: body.permissions || {},
    plugins: body.plugins || {}
  };

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

app.get('/api/v1/build/:id', (req, res) => {
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
    runUrl: state.runUrl, error: state.error, appName: state.appName
  });
});

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
    const art = arts.find(a => a.name.includes('apk')) || arts[0];
    if (!art) return res.status(404).json({ error: 'APK no encontrado' });

    const info = {
      buildId: state.id,
      appName: state.appName,
      outputType: state.outputType,
      artifactName: art.name,
      artifactSizeMB: art.size_in_bytes ? (art.size_in_bytes / 1024 / 1024).toFixed(2) : '?',
      createdAt: state.createdAt,
      runUrl: state.runUrl,
      artifacts: (state.artifacts || []).map(a => ({
        name: a.name,
        type: a.name.includes('aab') ? 'AAB' : (a.name.includes('ipa') ? 'IPA' : 'APK'),
        download: `/api/download/${state.id}${a.name.includes('aab') ? '/aab' : (a.name.includes('ipa') ? '/ipa' : '')}`
      }))
    };

    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function pollBuild(g, state) {
  let attempts = 0;
  const timer = setInterval(async () => {
    attempts++;
    try {
      if (!state.runId) {
        const run = await gh.findRun(g.owner, g.repo, state.branch);
        if (run) {
          state.runId = run.id;
          state.runUrl = run.html_url;
          state.step = 'Compilando APK';
          updateHistory(state.id, { runUrl: run.html_url });
        }
      } else {
        const run = await gh.getRun(g.owner, g.repo, state.runId);
        state.runUrl = run.html_url;
        if (run.status === 'completed') {
          clearInterval(timer);
          runCleanup(g);
          if (run.conclusion === 'success') {
            state.status = 'success';
            state.step = 'Build completado';
            try {
              const arts = await gh.getArtifacts(g.owner, g.repo, state.runId);
              state.artifacts = arts.map(a => ({ name: a.name, url: a.archive_download_url, size: a.size_in_bytes }));
              if (arts[0]) { state.apkUrl = arts[0].archive_download_url; state.artifactName = arts[0].name; }
            } catch (_) {}
            const duration = Math.round((Date.now() - state.createdAt) / 1000);
            updateHistory(state.id, { status: 'success', runUrl: run.html_url, apkUrl: state.apkUrl, artifacts: state.artifacts, duration });
            await fireWebhook(state.webhookUrl, {
              event: 'build.completed', buildId: state.id, status: 'success',
              appName: state.appName, runUrl: state.runUrl, duration,
              apkUrl: `/api/download/${state.id}`,
              aabUrl: state.artifacts && state.artifacts.some(a => a.name.includes('aab')) ? `/api/download/${state.id}/aab` : null
            });
          } else {
            state.status = 'failed';
            state.step = 'Build fallido';
            state.error = `GitHub Actions concluyo: ${run.conclusion}`;
            updateHistory(state.id, { status: 'failed', error: state.error });
            await fireWebhook(state.webhookUrl, { event: 'build.failed', buildId: state.id, status: 'failed', error: state.error, runUrl: state.runUrl });
          }
        } else {
          state.step = run.status === 'queued' ? 'En cola en GitHub Actions' : 'Compilando APK';
        }
      }
    } catch (err) {
      state.step = `Reintentando (${err.message})`;
    }

    if (attempts >= 200) {
      clearInterval(timer);
      if (state.status !== 'success') {
        state.status = 'failed';
        state.error = state.error || 'Tiempo de espera agotado consultando GitHub';
        updateHistory(state.id, { status: 'failed', error: state.error });
        fireWebhook(state.webhookUrl, { event: 'build.failed', buildId: state.id, status: 'failed', error: state.error });
      }
    }
  }, 6000);
}

app.get('/api/download/:id', async (req, res) => {
  const state = builds.get(req.params.id);
  if (!state) return res.status(404).json({ error: 'Build no encontrado' });
  if (!state.runId) return res.status(404).json({ error: 'Build aun en progreso' });
  const g = gh.config();
  if (!g.ready) return res.status(503).json({ error: 'GitHub no configurado' });
  try {
    const arts = await gh.getArtifacts(g.owner, g.repo, state.runId);
    const art = arts.find(a => a.name.includes('apk')) || arts[0];
    if (!art) return res.status(404).json({ error: 'APK no encontrado' });
    const response = await gh.downloadArtifact(g.owner, g.repo, art.id);
    const buf = Buffer.from(await response.arrayBuffer());
    const zip = await JSZip.loadAsync(buf);
    const apkEntry = Object.keys(zip.files).find(n => n.endsWith('.apk'));
    if (apkEntry) {
      const apkBuf = await zip.files[apkEntry].async('nodebuffer');
      const safe = (state.appName || 'app').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', `attachment; filename="${safe}.apk"`);
      return res.send(apkBuf);
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${state.appName || 'app'}.apk.zip"`);
    res.send(buf);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

app.get('/api/download/:id/aab', async (req, res) => {
  const state = builds.get(req.params.id);
  if (!state) return res.status(404).json({ error: 'Build no encontrado' });
  if (!state.runId) return res.status(404).json({ error: 'Build aun en progreso' });
  const g = gh.config();
  if (!g.ready) return res.status(503).json({ error: 'GitHub no configurado' });
  try {
    const arts = await gh.getArtifacts(g.owner, g.repo, state.runId);
    const art = arts.find(a => a.name.includes('aab'));
    if (!art) return res.status(404).json({ error: 'AAB no encontrado' });
    const response = await gh.downloadArtifact(g.owner, g.repo, art.id);
    const buf = Buffer.from(await response.arrayBuffer());
    const zip = await JSZip.loadAsync(buf);
    const aabEntry = Object.keys(zip.files).find(n => n.endsWith('.aab'));
    if (aabEntry) {
      const aabBuf = await zip.files[aabEntry].async('nodebuffer');
      const safe = (state.appName || 'app').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${safe}.aab"`);
      return res.send(aabBuf);
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${state.appName || 'app'}.aab.zip"`);
    res.send(buf);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

app.get('/api/download/:id/ipa', async (req, res) => {
  const state = builds.get(req.params.id);
  if (!state) return res.status(404).json({ error: 'Build no encontrado' });
  if (!state.runId) return res.status(404).json({ error: 'Build aun en progreso' });
  const g = gh.config();
  if (!g.ready) return res.status(503).json({ error: 'GitHub no configurado' });
  try {
    const arts = await gh.getArtifacts(g.owner, g.repo, state.runId);
    const art = arts.find(a => a.name.includes('ipa'));
    if (!art) return res.status(404).json({ error: 'IPA no encontrado (firma iOS requerida)' });
    const response = await gh.downloadArtifact(g.owner, g.repo, art.id);
    const buf = Buffer.from(await response.arrayBuffer());
    const zip = await JSZip.loadAsync(buf);
    const ipaEntry = Object.keys(zip.files).find(n => n.endsWith('.ipa'));
    if (ipaEntry) {
      const ipaBuf = await zip.files[ipaEntry].async('nodebuffer');
      const safe = (state.appName || 'app').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${safe}.ipa"`);
      return res.send(ipaBuf);
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${state.appName || 'app'}.ipa.zip"`);
    res.send(buf);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

function runCleanup(g) {
  if (!g.ready) return;
  setTimeout(() => {
    gh.cleanup(g.owner, g.repo).then(
      r => console.log(`[cleanup] ramas:${r.branches} runs:${r.runs} artifacts:${r.artifacts}`),
      () => {}
    );
  }, 2000);
}

const CLEANUP_SECRET = process.env.CLEANUP_SECRET || '';
app.get('/api/cleanup', (req, res) => {
  if (CLEANUP_SECRET && req.query.secret !== CLEANUP_SECRET) return res.status(403).json({ error: 'Secret requerido' });
  const g = gh.config();
  if (!g.ready) return res.status(503).json({ error: 'GitHub no esta configurado' });
  gh.cleanup(g.owner, g.repo).then(
    r => res.json({ ok: true, ...r }),
    err => res.status(500).json({ error: err.message })
  );
});

setInterval(() => {
  const g = gh.config();
  if (!g.ready) return;
  gh.cleanup(g.owner, g.repo).then(
    r => { if (r.branches || r.runs || r.artifacts) console.log(`[auto-cleanup] ramas:${r.branches} runs:${r.runs} artifacts:${r.artifacts}`); },
    () => {}
  );
}, 30 * 60 * 1000);

app.listen(PORT, () => {
  const g = gh.config();
  console.log(`\n  InteeBuild v${VERSION}  ->  http://localhost:${PORT}`);
  console.log(`  GitHub: ${g.ready ? `listo (${g.owner}/${g.repo})` : 'SIN CONFIGURAR (revisa .env)'}\n`);
});
