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
const templates = require('./templates');
const packageJson = require('../package.json');
const VERSION = packageJson.version;

const app = express();
const PORT = process.env.PORT || 8787;
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'builds.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]', 'utf-8');
const APIKEYS_FILE = path.join(DATA_DIR, 'apikeys.json');
const GIT_FILE = path.join(DATA_DIR, 'git-integrations.json');
const VERSIONS_FILE = path.join(DATA_DIR, 'versions.json');
if (!fs.existsSync(APIKEYS_FILE)) fs.writeFileSync(APIKEYS_FILE, '[]', 'utf-8');
if (!fs.existsSync(GIT_FILE)) fs.writeFileSync(GIT_FILE, '[]', 'utf-8');
if (!fs.existsSync(VERSIONS_FILE)) fs.writeFileSync(VERSIONS_FILE, '{}', 'utf-8');
function loadVersions(){ try{ return JSON.parse(fs.readFileSync(VERSIONS_FILE,'utf-8')); }catch{ return {}; } }
function saveVersions(v){ fs.writeFileSync(VERSIONS_FILE, JSON.stringify(v,null,2),'utf-8'); }

const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || null;
app.use(cors(ALLOWED_ORIGIN ? { origin: ALLOWED_ORIGIN } : { origin: true }));
app.use(express.json({ limit: '15mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '30mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
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

// ========== API KEYS (hash + prefix, sin exponer secreto) ==========
function loadKeys(){ try{ return JSON.parse(fs.readFileSync(APIKEYS_FILE,'utf-8')); }catch{ return []; } }
function saveKeys(a){ fs.writeFileSync(APIKEYS_FILE, JSON.stringify(a,null,2),'utf-8'); }
function hashKey(key){ return crypto.createHash('sha256').update(String(key)).digest('hex'); }
function createApiKey(name, scopes){
  const keys=loadKeys();
  const id=crypto.randomBytes(4).toString('hex');
  const key='ib_'+crypto.randomBytes(24).toString('hex');
  const entry={id, keyHash:hashKey(key), prefix:key.slice(0,10), name:name||'default', createdAt:Date.now(), lastUsed:null, uses:0, revokedAt:null, scopes:Array.isArray(scopes)&&scopes.length?scopes:['build','decompile','analyze']};
  keys.push(entry); saveKeys(keys); return {...entry, key};
}
function verifyApiKey(req){
  const header = req.headers['x-api-key'] || req.headers['authorization'] || '';
  let token = String(header).replace(/^Bearer\s+/i,'').trim();
  if(!token) return { valid:false, reason:'missing' };
  const keys=loadKeys().filter(k=>!k.revokedAt);
  if(!loadKeys().filter(k=>!k.revokedAt).length && !loadKeys().length) return { valid:true, isPublic:true };
  if(!keys.length) return { valid:false, reason:'revoked' };
  const h=hashKey(token);
  const found=keys.find(k=>k.keyHash===h || k.key===token);
  if(found){
    if(found.key && !found.keyHash){ found.keyHash=hashKey(found.key); delete found.key; }
    found.lastUsed=Date.now(); found.uses=(found.uses||0)+1;
    const all=loadKeys(); const idx=all.findIndex(k=>k.id===found.id); if(idx!==-1){ all[idx]=found; saveKeys(all); }
    return {valid:true, key:found};
  }
  return { valid:false };
}
function requireApiKey(req,res,next){
  const keys=loadKeys();
  if(!keys.length) return next();
  const v=verifyApiKey(req);
  if(!v.valid) return res.status(401).json({error:'API Key requerida. Envía X-API-Key o Authorization: Bearer ib_... Genera una en POST /api/keys'});
  next();
}

// ========== SECURITY / ERROR / OPTIMIZATION ANALYZERS ==========
function securityScan(html, headers, url){
  const issues=[];
  let score=100;
  if(!url.startsWith('https://')){ issues.push({severity:'critical', msg:'No usa HTTPS', fix:'Migrar a https://'}); score-=25; }
  const hasCSP = /content-security-policy/i.test(headers['content-security-policy']||'') || /http-equiv=["']content-security-policy/i.test(html);
  if(!hasCSP){ issues.push({severity:'medium', msg:'Sin Content-Security-Policy', fix:'Agregar CSP header'}); score-=8; }
  const insecure = (html.match(/src=["']http:\/\//gi)||[]).length + (html.match(/href=["']http:\/\//gi)||[]).length;
  if(insecure){ issues.push({severity:'high', msg: insecure+' recursos inseguros http://', fix:'Cambiar a https://'}); score-= Math.min(20,insecure*4); }
  if(/eval\s*\(/.test(html)) { issues.push({severity:'high', msg:'Uso de eval() detectado', fix:'Evitar eval, usar JSON.parse'}); score-=10; }
  if(/innerHTML\s*=/.test(html)) { issues.push({severity:'low', msg:'innerHTML sin sanitizar', fix:'Usar textContent o DOMPurify'}); score-=3; }
  if(/document\.cookie/.test(html) && !/Secure/.test(headers['set-cookie']||'')) { issues.push({severity:'medium', msg:'Cookies sin flag Secure', fix:'Agregar Secure; HttpOnly'}); score-=5; }
  if(/<script[^>]*>.*http:\/\//i.test(html)) { issues.push({severity:'high', msg:'Script externo sin HTTPS', fix:'Usar https'}); score-=10; }
  if(!/X-Content-Type-Options/i.test(headers['x-content-type-options']||'')) { issues.push({severity:'low', msg:'Falta X-Content-Type-Options: nosniff', fix:'Header nosniff'}); score-=2; }
  if(/jquery.*1\./i.test(html) || /jquery.*2\./i.test(html)) { issues.push({severity:'medium', msg:'jQuery obsoleto detectado', fix:'Actualizar a 3.x'}); score-=5; }
  score=Math.max(0,Math.min(100,score));
  const level= score>=90?'Excelente':score>=70?'Bueno':score>=50?'Riesgo medio':'Crítico';
  return {score, level, issues, hasCSP, insecureCount: insecure};
}
function errorDetection(html){
  const errors=[];
  const warnings=[];
  // Duplicate IDs
  const ids=[...html.matchAll(/id=["']([^"']+)["']/gi)].map(m=>m[1]);
  const dup=[...new Set(ids.filter((v,i,a)=>a.indexOf(v)!==i))];
  if(dup.length) warnings.push({type:'duplicate-id', msg:'IDs duplicados: '+dup.slice(0,3).join(', '), fix:'IDs deben ser únicos'});
  // Unclosed tags heuristic
  const openTags=(html.match(/<(div|section|main|header|footer|ul|li|p|span|a)[^>]*>/gi)||[]).length;
  const closeTags=(html.match(/<\/(div|section|main|header|footer|ul|li|p|span|a)>/gi)||[]).length;
  if(Math.abs(openTags-closeTags)>5) warnings.push({type:'unclosed', msg:'Posibles etiquetas sin cerrar', fix:'Validar con https://validator.w3.org'});
  // Missing alt
  const imgs=(html.match(/<img[^>]*>/gi)||[]);
  const noAlt=imgs.filter(t=>!/alt=/.test(t)).length;
  if(noAlt) warnings.push({type:'accessibility', msg: noAlt+' imágenes sin alt', fix:'Agregar alt descriptivo'});
  // Inline styles excess
  const inline=(html.match(/style=["'][^"']*["']/gi)||[]).length;
  if(inline>15) warnings.push({type:'maintainability', msg:'Muchos estilos inline', fix:'Mover a CSS externo'});
  // JS syntax heuristic
  if(/<script[^>]*>([\s\S]*?)<\/script>/i.test(html)){
    const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
    scripts.forEach((code,i)=>{
      if(/=\s*[^=]/.test(code) && /if\s*\(.*=.*\)/.test(code)) warnings.push({type:'js-logic', msg:'Posible asignación en if (script '+(i+1)+')', fix:'Usar ==='});
      if(/var\s+\w+/.test(code)) warnings.push({type:'js-legacy', msg:'Uso de var en lugar de let/const', fix:'Modernizar'});
    });
  }
  // Broken links check count
  const links=[...html.matchAll(/href=["']([^"']+)["']/gi)].map(m=>m[1]);
  const emptyLinks=links.filter(h=>h==='#' || h==='').length;
  if(emptyLinks) warnings.push({type:'links', msg: emptyLinks+' enlaces vacíos (#)', fix:'Agregar href válido'});
  // Mixed errors vs warnings
  if(!/<!DOCTYPE/i.test(html)) errors.push({type:'doctype', msg:'Falta <!DOCTYPE html>', fix:'Agregar doctype'});
  if(!/<html/i.test(html)) errors.push({type:'html', msg:'Falta tag <html>', fix:'Envolver contenido'});
  return {errors, warnings, total: errors.length+warnings.length, altMissing:noAlt, duplicateIds:dup};
}
function optimizationReport(html){
  const tips=[];
  let score=100;
  const sizeKB=Math.round(Buffer.byteLength(html,'utf8')/1024);
  if(sizeKB>200){ tips.push({msg:'HTML pesado '+sizeKB+'KB', fix:'Minificar y comprimir', impact:'high'}); score-=15; }
  else if(sizeKB>100){ tips.push({msg:'HTML mediano '+sizeKB+'KB', fix:'Optimizar imágenes', impact:'medium'}); score-=5; }
  const images=(html.match(/<img[^>]*>/gi)||[]).length;
  if(images>20){ tips.push({msg:images+' imágenes, muchas sin lazy', fix:'Agregar loading="lazy"', impact:'medium'}); score-=8; }
  const noLazy=(html.match(/<img[^>]*>/gi)||[]).filter(t=>!/loading=/.test(t)).length;
  if(noLazy>3){ tips.push({msg:noLazy+' imágenes sin lazy loading', fix:'Agregar loading="lazy"', impact:'low'}); score-=4; }
  const scripts=(html.match(/<script[^>]*src=/gi)||[]).length;
  if(scripts>6){ tips.push({msg:scripts+' scripts externos (bloquean render)', fix:'Defer/async', impact:'high'}); score-=10; }
  if(/<link[^>]*rel=["']stylesheet["']/i.test(html) && !/media=/.test(html)) { tips.push({msg:'CSS bloqueante', fix:'Agregar media o preload', impact:'medium'}); score-=3; }
  if(!/\.webp/i.test(html) && images>5){ tips.push({msg:'No usa WebP', fix:'Convertir imágenes a WebP', impact:'low'}); score-=3; }
  const inlineCSS=(html.match(/<style[^>]*>/gi)||[]).length;
  if(inlineCSS>3){ tips.push({msg:'Múltiples <style> inline', fix:'Unificar en archivo externo', impact:'low'}); score-=2; }
  score=Math.max(0,Math.min(100,score));
  const grade= score>=85?'A':score>=70?'B':score>=50?'C':'D';
  return {score, grade, tips, sizeKB, images, scripts};
}
function autoFixHtml(html){
  let out=html;
  // force https for http resources
  out=out.replace(/src=["']http:\/\//gi,'src="https://');
  out=out.replace(/href=["']http:\/\//gi,'href="https://');
  // add lazy to img without loading
  out=out.replace(/<img([^>]*?)>/gi,(m,attrs)=> /loading=/.test(attrs)? m : '<img'+attrs+' loading="lazy">');
  // add viewport if missing
  if(!/<meta[^>]*viewport/i.test(out)){
    out=out.replace(/<head([^>]*)>/i,'<head$1><meta name="viewport" content="width=device-width, initial-scale=1.0" />');
  }
  // add alt if missing
  out=out.replace(/<img([^>]*?)>/gi,(m,attrs)=> /alt=/.test(attrs)? m : '<img'+attrs+' alt="">');
  return out;
}

// Git integrations helpers
function loadGits(){ try{ return JSON.parse(fs.readFileSync(GIT_FILE,'utf-8')); }catch{ return []; } }
function saveGits(a){ fs.writeFileSync(GIT_FILE, JSON.stringify(a,null,2),'utf-8'); }

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
    const headersObj={};
    r.headers.forEach((v,k)=>headersObj[k.toLowerCase()]=v);
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
    const security = securityScan(html, headersObj, url);
    const errors = errorDetection(html);
    const optimization = optimizationReport(html);
    const fixedHtml = autoFixHtml(html);
    const hasFixes = fixedHtml !== html;

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

    res.json({ url, status: r.status, checks, score, diag, pwa: pwaData, insecureCount: insecure, frameworks, detectedApis, recommendations, security, errors, optimization, autoFix:{available:hasFixes, preview: fixedHtml.slice(0,8000)} });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo analizar: ' + e.message });
  }
});

// Enhanced analyze: POST for HTML direct + auto-fix download
app.post('/api/analyze/html', async (req,res)=>{
  const html=String(req.body.html||'');
  if(!html) return res.status(400).json({error:'Falta html'});
  if(html.length>600000) return res.status(400).json({error:'HTML demasiado grande'});
  const security=securityScan(html, {}, 'https://html-direct');
  const errors=errorDetection(html);
  const optimization=optimizationReport(html);
  const fixed=autoFixHtml(html);
  res.json({security,errors,optimization, autoFix:{available:fixed!==html, preview:fixed.slice(0,8000), full:fixed}});
});
app.post('/api/analyze/fix', async (req,res)=>{
  const html=String(req.body.html||'');
  if(!html) return res.status(400).json({error:'Falta html'});
  const fixed=autoFixHtml(html);
  res.json({fixed, originalLength:html.length, fixedLength:fixed.length});
});

// API Keys management (hash, sin exponer secreto)
app.get('/api/keys', (req,res)=>{ const keys=loadKeys().map(k=>({id:k.id,name:k.name,createdAt:k.createdAt,lastUsed:k.lastUsed,uses:k.uses,revokedAt:k.revokedAt||null,scopes:k.scopes||['build'],prefix:k.prefix||(k.key?String(k.key).slice(0,10):'ib_...'),keyMask:(k.prefix||'ib_...')+'...'+(k.keyHash?String(k.keyHash).slice(-4):'****')})); res.json(keys); });
app.post('/api/keys', (req,res)=>{
  const name=String(req.body.name||'').slice(0,40)||'default';
  const scopes=Array.isArray(req.body.scopes)?req.body.scopes.slice(0,5):['build','decompile','analyze'];
  const keys=loadKeys().filter(k=>!k.revokedAt);
  if(keys.length>=10) return res.status(400).json({error:'Máximo 10 API keys activas'});
  const entry=createApiKey(name, scopes);
  res.json(entry);
});
app.delete('/api/keys/:id', (req,res)=>{
  const keys=loadKeys();
  const idx=keys.findIndex(k=>k.id===req.params.id);
  if(idx===-1) return res.status(404).json({error:'Key no encontrada'});
  keys[idx].revokedAt=Date.now(); delete keys[idx].key;
  saveKeys(keys); res.json({ok:true, revoked:true});
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
      decompile:'POST /api/decompile (JSON {apkBase64} o raw octet-stream)',
      templates:'GET /api/templates, GET /api/templates/:id',
      listing:'POST /api/listing (ficha Play Store gratis)',
      securityAudit:'POST /api/security-audit (GDPR + permisos + privacy)',
      privacyPolicy:'GET /api/privacy-policy?appName=&package=',
      versions:'GET /api/versions/:appId, POST /api/versions/publish, GET /api/check-update',
      cicd:'POST /api/cicd (workflow gratis para auto-build on push)'
    },
    auth:'Header X-API-Key o Authorization: Bearer ib_... (opcional si no hay keys, obligatorio si existen)',
    permissions:'Permisos granulares nativos: runtime request + manifest + WebChromeClient grant selectivo + plugins auto'
  });
});

// Ficha Play Store gratis (sin IA, plantilla local)
app.post('/api/listing', (req,res)=>{
  try{
    const cfg=generator.normalizeConfig(templates.applyTemplate(req.body||{}, (req.body||{}).template));
    res.json({ok:true, listing:generator.buildPlayListing(cfg)});
  }catch(e){ res.status(400).json({error:e.message}); }
});

// Security audit gratis: permisos + GDPR + dependencias (reglas locales, sin IA)
app.post('/api/security-audit', (req,res)=>{
  try{
    const cfg=generator.normalizeConfig(templates.applyTemplate(req.body||{}, (req.body||{}).template));
    const audit=generator.getPermissionAudit(cfg);
    const issues=[];
    const sensitive=['phone','sms','systemAlert','installPackages','gpsBackground'];
    sensitive.forEach(k=>{ if(cfg.permissions[k]) issues.push({severity:'high', msg:'Permiso sensible '+k+' requiere justificación en Play Store', fix:'Quítalo si tu app no es de esa categoría'}); });
    if(!cfg.useCleartext && String(cfg.url||'').startsWith('http://')) issues.push({severity:'medium', msg:'URL http con cleartext desactivado', fix:'Activa tráfico cleartext o usa https'});
    const gdpr=[
      {item:'Política de privacidad enlazada', ok:!!String(req.body.privacyUrl||'').trim(), fix:'GET /api/privacy-policy para generarla'},
      {item:'Sin permisos sensibles innecesarios', ok:!sensitive.some(k=>cfg.permissions[k]), fix:'Quita phone/sms/gpsBackground si no aplican'},
      {item:'Keystore propio para release', ok:!!cfg.useCustomSigning, fix:'Sube tu .jks en Firma para publicar'}
    ];
    const score=Math.max(0, 100 - audit.items.filter(i=>i.status==='fail').length*20 - audit.items.filter(i=>i.status==='warn').length*5 - issues.filter(i=>i.severity==='high').length*5);
    res.json({ok:true, score, level: score>=90?'Excelente':score>=70?'Bueno':score>=50?'Revisar':'Crítico', audit, issues, gdpr});
  }catch(e){ res.status(400).json({error:e.message}); }
});
app.get('/api/privacy-policy', (req,res)=>{
  const appName=String(req.query.appName||'Mi app').slice(0,60);
  const pkg=String(req.query.package||'com.example.app').slice(0,80);
  res.type('text/plain').send(
    'POLÍTICA DE PRIVACIDAD — '+appName+' ('+pkg+')\n\n'
    + '1. Datos que recoge la app: la app muestra contenido web y usa únicamente los permisos que el usuario concede en Android (cámara, ubicación, etc.).\n'
    + '2. Uso: los datos se usan solo para el funcionamiento visible de la app y no se venden.\n'
    + '3. Terceros: si tu web carga servicios externos (analítica, anuncios), revisa sus políticas.\n'
    + '4. Conservación: InteeBuild borra la rama de compilación al terminar el build; los artefactos se auto-limpian.\n'
    + '5. Contacto: publica un correo de contacto antes de subir a Play Store.\n\n'
    + 'Generado gratis con InteeBuild. Adáptalo con tu abogado.'
  );
});

// Versiones y OTA simple (local, gratis): publica y consulta actualizaciones
app.get('/api/versions/:appId', (req,res)=>{
  const v=loadVersions();
  res.json(v[String(req.params.appId)]||{appId:req.params.appId, versions:[]});
});
app.post('/api/versions/publish', (req,res)=>{
  const appId=String(req.body.appId||'').slice(0,80);
  const version=String(req.body.version||'').slice(0,20);
  const changelog=String(req.body.changelog||'').slice(0,500);
  if(!appId || !/^\d+(\.\d+){0,3}$/.test(version)) return res.status(400).json({error:'appId y version (ej 1.0.1) requeridos'});
  const v=loadVersions();
  const entry=v[appId]||{appId, versions:[]};
  entry.versions.unshift({version, changelog, publishedAt:Date.now()});
  entry.versions=entry.versions.slice(0,20);
  v[appId]=entry; saveVersions(v);
  res.json({ok:true, ...entry});
});
app.get('/api/check-update', (req,res)=>{
  const appId=String(req.query.appId||'');
  const current=String(req.query.version||'0.0.0');
  const entry=(loadVersions())[appId];
  if(!entry || !entry.versions.length) return res.json({updateAvailable:false});
  const latest=entry.versions[0].version;
  const cmp=(a,b)=>{ const pa=a.split('.').map(Number), pb=b.split('.').map(Number); for(let i=0;i<3;i++){ if((pa[i]||0)!==(pb[i]||0)) return (pa[i]||0)>(pb[i]||0)?1:-1; } return 0; };
  if(cmp(latest,current)>0) return res.json({updateAvailable:true, latest, changelog:entry.versions[0].changelog});
  res.json({updateAvailable:false, latest});
});

// CI/CD gratis: genera workflow para auto-compilar on push usando tu webhook
app.post('/api/cicd', (req,res)=>{
  const repo=String(req.body.repo||'').trim();
  const branch=String(req.body.branch||'main').trim();
  const baseUrl=String(req.body.baseUrl||'https://tu-dominio.com').replace(/\/$/,'');
  if(!/^[^/]+\/[^/]+$/.test(repo)) return res.status(400).json({error:'repo debe ser usuario/repo'});
  const yml='name: inteebuild-auto\non:\n  push:\n    branches: ['+branch+']\n    paths: [index.html, src/**, www/**]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Trigger InteeBuild\n        run: |\n          curl -X POST '+baseUrl+'/api/git/webhook -H "Content-Type: application/json" -d \'{"repository":{"full_name":"'+repo+'"},"ref":"refs/heads/'+branch+'"}\'\n';
  res.json({ok:true, repo, branch, file:'.github/workflows/inteebuild-auto.yml', workflow:yml, note:'Súbelo a '+repo+' y conecta el repo en POST /api/git/connect. Sin costos, usa tu propio servidor.'});
});

// Git integration - connect repo to auto-build on push
app.get('/api/git/integrations', (req,res)=> res.json(loadGits()));
app.post('/api/git/connect', (req,res)=>{
  const repo=String(req.body.repo||'').trim();
  const branch=String(req.body.branch||'main').trim();
  const token=String(req.body.token||'').trim();
  const webhookUrl=String(req.body.webhookUrl||'').trim();
  if(!/^[^/]+\/[^/]+$/.test(repo)) return res.status(400).json({error:'Repo debe ser usuario/repo'});
  const gits=loadGits();
  const id=crypto.randomBytes(4).toString('hex');
  const entry={id, repo, branch, hasToken:!!token, token: token? crypto.createHash('sha256').update(token).digest('hex').slice(0,12)+'...':null, rawToken: token||null, webhookUrl, createdAt:Date.now()};
  gits.push(entry); saveGits(gits);
  res.json({ok:true, id, repo, branch});
});
app.delete('/api/git/:id', (req,res)=>{
  let gits=loadGits();
  const before=gits.length;
  gits=gits.filter(g=>g.id!==req.params.id);
  if(gits.length===before) return res.status(404).json({error:'No encontrado'});
  saveGits(gits); res.json({ok:true});
});
app.post('/api/git/webhook', async (req,res)=>{
  // GitHub push webhook simulation - expects {repo, branch, commits}
  const repo=String(req.body.repository?.full_name || req.body.repo||'').trim();
  const ref=String(req.body.ref||'').trim();
  const branch = ref.replace('refs/heads/','') || String(req.body.branch||'main');
  if(!repo) return res.status(400).json({error:'Falta repo'});
  const gits=loadGits();
  const match=gits.find(g=>g.repo===repo && g.branch===branch);
  if(!match) return res.status(404).json({error:'No hay integración para '+repo+'#'+branch});
  // trigger a build using stored config or minimal
  try{
    const cfg=req.body.config ? generator.normalizeConfig(req.body.config) : generator.normalizeConfig({url:'https://'+repo, appName: repo.split('/')[1]||'App'});
    const ip=req.ip||'webhook';
    const result=await startBuild(cfg, ip);
    res.json({ok:true, buildId: result.id, branch});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// APK Decompiler - mejorado para APK reales y ZIPs InteeBuild
app.post('/api/decompile', async (req,res)=>{
  try{
    let buf=null;
    if (req.is('application/octet-stream') && Buffer.isBuffer(req.body)) buf=req.body;
    else if(req.body.apkBase64){
      const b64=String(req.body.apkBase64).replace(/^data:.*?;base64,/, '');
      buf=Buffer.from(b64,'base64');
    } else if(req.body.buffer) buf=Buffer.from(req.body.buffer,'base64');
    if(!buf || buf.length<100) return res.status(400).json({error:'Envía apkBase64 (data:...;base64,xxx o solo base64) o raw octet-stream. Tamaño min 100 bytes'});
    if(buf.length>30*1024*1024) return res.status(400).json({error:'APK demasiado grande (max 30MB)'});
    let zip;
    try{ zip=await JSZip.loadAsync(buf); }catch{ return res.status(400).json({error:'Archivo no es ZIP/APK válido (JSZip falló)'}); }
    const entries=Object.keys(zip.files);
    let manifestStr='';
    let manifestBuf=null;
    let buildConfig=null;
    let packageName='desconocido';
    let permissions=[];
    let appName='App';
    let versionName='';
    let versionCode='';
    if(zip.files['build-config.json']){
      try{ buildConfig=JSON.parse(await zip.files['build-config.json'].async('string')); packageName=buildConfig.packageName||packageName; appName=buildConfig.appName||appName; permissions=Object.keys(buildConfig.permissions||{}).filter(k=>buildConfig.permissions[k]); versionName=buildConfig.versionName||''; }catch{}
    }
    if(zip.files['AndroidManifest.xml']){
      try{ manifestBuf=await zip.files['AndroidManifest.xml'].async('nodebuffer'); manifestStr=manifestBuf.toString('utf8'); }catch{ manifestStr=''; }
      if(!manifestStr || manifestStr.length<50){
        try{ manifestStr=await zip.files['AndroidManifest.xml'].async('string'); }catch{ manifestStr=''; }
      }
      if(manifestStr.includes('package="')){ const m=manifestStr.match(/package="([^"]+)"/); if(m) packageName=m[1]; }
      if(!packageName || packageName==='desconocido'){
        const pkgMatch=manifestStr.match(/[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+/g);
        if(pkgMatch){ const cand=pkgMatch.find(s=>s.includes('.') && s.startsWith('com.') && s.length<50); if(cand) packageName=cand; }
      }
      const verMatch=manifestStr.match(/versionName="([^"]+)"/); if(verMatch) versionName=verMatch[1];
      const codeMatch=manifestStr.match(/versionCode="([^"]+)"/); if(codeMatch) versionCode=codeMatch[1];
      const perms=[...manifestStr.matchAll(/android\.permission\.([A-Z_\.]+)/g)].map(m=>m[1].replace(/\./g,'').toLowerCase());
      if(perms.length) permissions=[...new Set([...permissions,...perms])];
      if(manifestBuf){
        const rawStr=manifestBuf.toString('latin1');
        const extraPerms=[...rawStr.matchAll(/android\.permission\.([A-Z_]+)/g)].map(m=>m[1].toLowerCase());
        if(extraPerms.length) permissions=[...new Set([...permissions,...extraPerms])];
      }
    }
    if(zip.files['capacitor.config.json']){
      try{ const cap=JSON.parse(await zip.files['capacitor.config.json'].async('string')); if(cap.appId && packageName==='desconocido') packageName=cap.appId; if(cap.appName) appName=cap.appName; if(cap.server && cap.server.url) appName+=' ('+cap.server.url.slice(0,30)+')'; }catch{}
    }
    if(zip.files['www/index.html']){
      try{ const html=await zip.files['www/index.html'].async('string'); const m=html.match(/https?:\/\/[^"'\s<]+/); if(m) appName+=' -> '+m[0].slice(0,40); }catch{}
    }
    if(zip.files['assets/www/index.html']){
      try{ const html=await zip.files['assets/www/index.html'].async('string'); const m=html.match(/https?:\/\/[^"'\s<]+/); if(m) appName+=' -> '+m[0].slice(0,40); }catch{}
    }
    const hasIcon=entries.some(e=>/ic_launcher|app-icon|mipmap.*\.png/i.test(e));
    const hasDex=entries.some(e=>e.endsWith('.dex'));
    const fileList=entries.slice(0,60);
    let sourceZipBase64=null;
    try{
      const sourceZip=new JSZip();
      for(const [name, file] of Object.entries(zip.files)){
        if(file.dir) continue;
        if(name.includes('..')) continue;
        try{
          const content=await file.async('nodebuffer');
          if(content.length < 4*1024*1024) sourceZip.file(name, content);
        }catch{}
      }
      sourceZipBase64=await sourceZip.generateAsync({type:'base64', compression:'DEFLATE'});
    }catch{}
    const importConfig= buildConfig ? buildConfig : { appName: appName.slice(0,40), packageName: packageName==='desconocido'?'com.example.app':packageName, url: 'https://example.com', versionName: versionName||'1.0.0', permissions:Object.fromEntries(permissions.map(p=>[p,true])) };
    res.json({
      ok:true,
      meta:{ packageName, appName, permissions, hasIcon, hasDex, fileCount:entries.length, sizeKB:Math.round(buf.length/1024), versionName, versionCode },
      entries: fileList,
      manifestPreview: manifestStr.slice(0,5000) || '(binario, ver permisos extraídos)',
      importConfig,
      sourceZipBase64,
      sourceZipSizeKB: sourceZipBase64 ? Math.round(Buffer.from(sourceZipBase64,'base64').length/1024) : 0,
      note: buildConfig? 'APK InteeBuild - 100% recuperable + ZIP fuente listo' : hasDex ? 'APK real descompilado (heurística) + ZIP fuente con manifest/dex/res' : 'ZIP/APK genérico + ZIP fuente'
    });
  }catch(e){ res.status(500).json({error:'No se pudo descompilar: '+e.message}); }
});

app.get('/api/templates', (req,res)=>{
  const list = templates.listTemplates().map(t=>{
    let audit=null;
    try{
      const safeName=('Tpl '+t.name).replace(/[^A-Za-z0-9 ]/g, '').slice(0, 30) || 'Tpl App';
      const cfg=generator.normalizeConfig({appName:safeName, url:'https://example.com', ...templates.getTemplate(t.id).config});
      audit=generator.getPermissionAudit(cfg);
    }catch(e){ audit={error:e.message}; }
    return {...t, audit: audit ? {ok:audit.ok, total:audit.total, readiness:audit.readiness, canBuild:audit.canBuild} : null};
  });
  res.json(list);
});
app.get('/api/templates/:id', (req,res)=>{
  const t=templates.getTemplate(req.params.id);
  if(!t) return res.status(404).json({error:'Plantilla no encontrada'});
  res.json({id:req.params.id, ...t});
});
// Prueba de que la plantilla es 100% código nativo: genera manifest,
// lista de archivos Java/XML y audit verificado, sin compilar en GitHub.
app.get('/api/templates/:id/native', (req,res)=>{
  const t=templates.getTemplate(req.params.id);
  if(!t) return res.status(404).json({error:'Plantilla no encontrada'});
  try{
    const safeName=('Tpl '+t.name).replace(/[^A-Za-z0-9 ]/g, '').slice(0, 30) || 'Tpl App';
    const cfg=generator.normalizeConfig({appName:safeName, url:'https://example.com', packageName:'com.example.'+String(req.params.id).replace(/[^a-z0-9]/g,''), ...t.config});
    const files=generator.generateFiles(cfg);
    const names=Object.keys(files);
    const javaFiles=names.filter(n=>n.endsWith('.java')||n.endsWith('.xml'));
    const audit=generator.getPermissionAudit(cfg);
    res.json({
      id:req.params.id, name:t.name,
      native100: audit.verifiedAll !== false && audit.canBuild,
      manifest: files['main-manifest.xml'],
      files: names,
      javaFiles,
      hasNativePermissions: !!files['NativePermissions.java'],
      hasRadioService: !!files['RadioService.java'],
      hasCatalogPatch: !!files['patch-catalog.js'],
      provider: files['provider.json'] ? JSON.parse(files['provider.json']) : null,
      audit
    });
  }catch(e){ res.status(400).json({error:e.message}); }
});
app.get('/api/permissions/spec', (req,res)=> res.json(generator.PERMISSION_SPEC));
app.post('/api/permissions/audit', (req,res)=>{
  try{
    const cfg=generator.normalizeConfig(templates.applyTemplate(req.body||{}, (req.body||{}).template));
    const audit=generator.getPermissionAudit(cfg);
    res.json(audit);
  }catch(e){ res.status(400).json({error:e.message}); }
});
app.post('/api/permissions/suggest', async (req,res)=>{
  try{
    let html=String(req.body.html||'');
    const url=String(req.body.url||'').trim();
    let detected=[];
    if(html) detected=detectWebApis(html);
    else if(url && !isBlockedUrl(url)){
      try{
        const r=await fetch(url,{headers:{'User-Agent':'InteeBuild-PermSuggest/1.0'}, signal:AbortSignal.timeout(8000)});
        const t=await r.text();
        html=t.slice(0,500000);
        detected=detectWebApis(html);
      }catch{}
    } else if(req.body.detectedApis) detected=req.body.detectedApis;
    const suggested=generator.suggestPermissionsFromApis(detected);
    res.json({detected, suggested, count:suggested.length});
  }catch(e){ res.status(500).json({error:e.message}); }
});
app.post('/api/build-readiness', (req,res)=>{
  try{
    const cfg=generator.normalizeConfig(templates.applyTemplate(req.body||{}, (req.body||{}).template));
    const audit=generator.getPermissionAudit(cfg);
    const hasUrlOrHtml = !!(String(cfg.url||'').trim() && cfg.inputType==='url') || !!(String(cfg.htmlCode||'').trim() && cfg.inputType==='html');
    const checks={
      webAnalyzed: hasUrlOrHtml,
      permissionsValidated: audit.canBuild,
      manifestGenerated: true,
      nativeHandlers: audit.ok===audit.total || audit.total===0,
      sdkCompatible: audit.items.every(i=>i.version==='OK'),
      signingConfigured: true,
      workflowReady: true
    };
    const passed=Object.values(checks).filter(Boolean).length;
    const total=Object.keys(checks).length;
    const readiness=Math.round((passed/total*0.5 + (audit.total? audit.ok/audit.total : 1)*0.5)*100);
    const warnings=[];
    audit.items.forEach(i=>{ if(i.status==='warn') warnings.push(i.title+' requiere Android '+i.minSdk+'+'); });
    if(!hasUrlOrHtml) warnings.push('Falta URL o HTML');
    const nativeAudioOk = !cfg.nativeAudio || !!cfg.streamUrl;
    if(cfg.nativeAudio && !cfg.streamUrl) warnings.push('Audio nativo activo pero sin URL del stream: pon tu servidor en Audio nativo');
    if(cfg.nativeAudio && !!cfg.streamUrl && !/^https?:\/\//.test(cfg.streamUrl)) warnings.push('streamUrl debe empezar con http:// o https://');
    res.json({readiness, checks:{...checks, nativeAudio:nativeAudioOk}, audit, warnings, canBuild: audit.canBuild && hasUrlOrHtml && nativeAudioOk, message: readiness>=90?'Listo para compilar': readiness>=70?'Recomendado revisar':'Corrige permisos'});
  }catch(e){ res.status(400).json({error:e.message}); }
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
    const raw = templates.applyTemplate(req.body || {}, (req.body || {}).template);
    const cfg = generator.normalizeConfig(raw);
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

  const { iconBase64, keystoreBase64, iosP12Base64, iosProfileBase64, keystorePassword, keyPassword, iosP12Password, parsed, ...safeCfg } = cfg;
  addHistory({
    id, appName: cfg.appName, status: 'queued', outputType: cfg.outputType,
    createdAt: state.createdAt, runUrl: null, apkUrl: null, error: null,
    config: safeCfg
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
    const raw = templates.applyTemplate(req.body || {}, (req.body || {}).template);
    cfg = generator.normalizeConfig(raw);
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

app.post('/api/v1/build', requireApiKey, async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const body = req.body || {};

  const rawCfg = templates.applyTemplate({
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
          // El código subido ya no se necesita: borra la rama para no dejar código
          // Los artefactos (APK/AAB) siguen disponibles 30 min para descarga
          try { gh.deleteBranchSoon(g.owner, g.repo, state.branch, 60000); } catch (_) {}
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
            try { gh.deleteBranchSoon(g.owner, g.repo, state.branch, 60000); } catch (_) {}
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
        try { gh.deleteBranchSoon(g.owner, g.repo, state.branch, 60000); } catch (_) {}
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
  if (!CLEANUP_SECRET) return res.status(403).json({ error: 'Limpieza manual desactivada. Configura CLEANUP_SECRET para activarla.' });
  if (req.query.secret !== CLEANUP_SECRET) return res.status(403).json({ error: 'Secret requerido' });
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
