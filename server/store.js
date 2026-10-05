'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const { DATA_DIR, HISTORY_FILE, APIKEYS_FILE, GIT_FILE, VERSIONS_FILE } = require('./deps');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]', 'utf-8');
if (!fs.existsSync(APIKEYS_FILE)) fs.writeFileSync(APIKEYS_FILE, '[]', 'utf-8');
if (!fs.existsSync(GIT_FILE)) fs.writeFileSync(GIT_FILE, '[]', 'utf-8');
if (!fs.existsSync(VERSIONS_FILE)) fs.writeFileSync(VERSIONS_FILE, '{}', 'utf-8');

const builds = new Map();
const rateLimits = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 3600000;

const MAX_HISTORY = 50;
const MAX_HISTORY_BYTES = 2 * 1024 * 1024;
const MAX_FIELD_PERSIST = 100000;
const AUDIT_MAX_BYTES = 2 * 1024 * 1024;
const AUDIT_KEEP_LINES = 500;
const MAX_KEYS = 100;
const MAX_GITS = 50;
const MAX_VERSION_APPS = 100;
const MAX_VERSIONS_PER_APP = 20;
const MAX_CHANGELOG = 500;

const LIMITS = {
  MAX_HISTORY,
  MAX_HISTORY_BYTES,
  MAX_FIELD_PERSIST,
  AUDIT_MAX_BYTES,
  AUDIT_KEEP_LINES,
  MAX_KEYS,
  MAX_GITS,
  MAX_VERSION_APPS,
  MAX_VERSIONS_PER_APP,
  MAX_CHANGELOG
};

function checkRateLimit(ip, bucket = '') {
  const key = bucket ? ip + '|' + bucket : ip;
  const now = Date.now();
  const entry = rateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function loadHistory() {
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')); }
  catch (_) { return []; }
}

function entryNeedsTrim(entry) {
  if (!entry || typeof entry !== 'object' || !entry.config || typeof entry.config !== 'object') return false;
  return Object.keys(entry.config).some(k => typeof entry.config[k] === 'string' && entry.config[k].length > MAX_FIELD_PERSIST);
}

function trimEntry(entry) {
  if (!entryNeedsTrim(entry)) return entry;
  const config = {};
  const omitted = [];
  Object.keys(entry.config).forEach(k => {
    const v = entry.config[k];
    if (typeof v === 'string' && v.length > MAX_FIELD_PERSIST) {
      config[k] = '';
      omitted.push(k);
    } else {
      config[k] = v;
    }
  });
  config.omittedFields = omitted;
  return Object.assign({}, entry, { config });
}

function buildHistory(arr) {
  let kept = (Array.isArray(arr) ? arr : []).slice(0, MAX_HISTORY).map(trimEntry);
  let text = JSON.stringify(kept, null, 2);
  while (kept.length > 1 && text.length > MAX_HISTORY_BYTES) {
    kept = kept.slice(0, -1);
    text = JSON.stringify(kept, null, 2);
  }
  return { kept, text };
}

function saveHistory(arr) {
  fs.writeFileSync(HISTORY_FILE, buildHistory(arr).text, 'utf-8');
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


function loadKeys(){ try{ return JSON.parse(fs.readFileSync(APIKEYS_FILE,'utf-8')); }catch{ return []; } }
function pruneKeys(list){
  if(list.length <= MAX_KEYS) return list;
  const exceso = list.length - MAX_KEYS;
  const victimas = new Set();
  list.forEach((k, i) => { if(victimas.size < exceso && k && k.revokedAt) victimas.add(i); });
  for(let i = 0; i < list.length && victimas.size < exceso; i++) if(!victimas.has(i)) victimas.add(i);
  return list.filter((_, i) => !victimas.has(i));
}
function saveKeys(a){ fs.writeFileSync(APIKEYS_FILE, JSON.stringify(pruneKeys(Array.isArray(a)?a:[]),null,2),'utf-8'); }
function hashKey(key){ return crypto.createHash('sha256').update(String(key)).digest('hex'); }
function safeEq(a, b){
  const ha=crypto.createHash('sha256').update(String(a||'')).digest();
  const hb=crypto.createHash('sha256').update(String(b||'')).digest();
  return crypto.timingSafeEqual(ha,hb);
}
function apiKeysDisabled(){ return /^(1|true|yes)$/i.test(String(process.env.API_KEYS_DISABLED||'')); }

const AUDIT_FILE = path.join(DATA_DIR, 'audit.log');

function fileSize(file){
  try{ return fs.statSync(file).size; }catch(_){ return 0; }
}

function trimAudit(force){
  try{
    const size = fs.statSync(AUDIT_FILE).size;
    if(!force && size <= AUDIT_MAX_BYTES) return false;
    const lines = fs.readFileSync(AUDIT_FILE, 'utf-8').split('\n').filter(Boolean);
    const keep = lines.slice(-AUDIT_KEEP_LINES);
    const trimmed = lines.length > keep.length;
    fs.writeFileSync(AUDIT_FILE, keep.join('\n')+'\n', 'utf-8');
    return trimmed;
  }catch(_){ return false; }
}

function audit(ev){
  try{
    fs.appendFileSync(AUDIT_FILE, JSON.stringify(Object.assign({ts:Date.now()}, ev))+'\n');
    trimAudit(false);
  }catch(_){}
}
function readAudit(keyId, limit){
  try{
    const lines=fs.readFileSync(AUDIT_FILE,'utf-8').split('\n').filter(Boolean).map(l=>{try{return JSON.parse(l);}catch{return null;}}).filter(Boolean);
    const filtered=keyId?lines.filter(l=>l.keyId===keyId):lines;
    return filtered.slice(-(limit||100)).reverse();
  }catch(_){ return []; }
}

const keyLimits = new Map();
function checkKeyQuota(keyId){
  const limit=parseInt(process.env.API_KEY_RATE_LIMIT||'20',10)||20;
  const now=Date.now();
  const entry=keyLimits.get(keyId);
  if(!entry || now>entry.resetAt){ keyLimits.set(keyId,{count:1,resetAt:now+3600000}); return true; }
  if(entry.count>=limit) return false;
  entry.count++;
  return true;
}

function createApiKey(name, scopes, expiresInDays){
  const keys=loadKeys();
  const id=crypto.randomBytes(4).toString('hex');
  const key='ib_'+crypto.randomBytes(24).toString('hex');
  const days=parseInt(expiresInDays,10);
  const entry={id, keyHash:hashKey(key), prefix:key.slice(0,10), name:name||'default', createdAt:Date.now(), lastUsed:null, uses:0, revokedAt:null, expiresAt:(days>0&&days<=365)?Date.now()+days*86400000:null, scopes:Array.isArray(scopes)&&scopes.length?scopes:['build','decompile','analyze']};
  keys.push(entry); saveKeys(keys); audit({ev:'key_created',keyId:id,name:entry.name,scopes:entry.scopes}); return {...entry, key};
}
function rotateApiKey(id){
  const all=loadKeys();
  const old=all.find(k=>k.id===id && !k.revokedAt);
  if(!old) return null;
  const key='ib_'+crypto.randomBytes(24).toString('hex');
  const daysLeft=old.expiresAt?Math.max(1,Math.ceil((old.expiresAt-Date.now())/86400000)):null;
  const entry={id:crypto.randomBytes(4).toString('hex'), keyHash:hashKey(key), prefix:key.slice(0,10), name:old.name, createdAt:Date.now(), lastUsed:null, uses:0, revokedAt:null, expiresAt:daysLeft?Date.now()+daysLeft*86400000:null, scopes:old.scopes||['build','decompile','analyze']};
  const idx=all.findIndex(k=>k.id===id);
  all[idx]=Object.assign({},old,{revokedAt:Date.now()});
  delete all[idx].key;
  all.push(entry); saveKeys(all);
  audit({ev:'key_rotated',keyId:id,newKeyId:entry.id,name:old.name});
  return {...entry, key, revokedId:id};
}
function verifyApiKey(req){
  const header = req.headers['x-api-key'] || req.headers['authorization'] || '';
  let token = String(header).replace(/^Bearer\s+/i,'').trim();
  if(!token) return { valid:false, reason:'missing' };
  const now=Date.now();
  const keys=loadKeys().filter(k=>!k.revokedAt && !(k.expiresAt && now>k.expiresAt));
  if(!keys.length && !loadKeys().length) return { valid:true, isPublic:true };
  const h=hashKey(token);
  const found=keys.find(k=>k.keyHash===h || k.key===token);
  if(found){
    if(found.key && !found.keyHash){ found.keyHash=hashKey(found.key); delete found.key; }
    found.lastUsed=Date.now(); found.uses=(found.uses||0)+1;
    const all=loadKeys(); const idx=all.findIndex(k=>k.id===found.id); if(idx!==-1){ all[idx]=found; saveKeys(all); }
    return {valid:true, key:found};
  }
  const any=loadKeys().find(k=>k.keyHash===h);
  if(any && any.revokedAt) return { valid:false, reason:'revoked' };
  if(any && any.expiresAt && now>any.expiresAt) return { valid:false, reason:'expired' };
  return { valid:false };
}
function requireApiKey(scope){
  return function(req,res,next){
    if(apiKeysDisabled()){ audit({ev:'api_disabled',ip:req.ip,path:req.path}); return res.status(503).json({error:'API deshabilitada por el administrador (API_KEYS_DISABLED)'}); }
    const keys=loadKeys();
    if(!keys.length) return next();
    const v=verifyApiKey(req);
    if(!v.valid){
      audit({ev:'key_denied',reason:v.reason||'invalid',ip:req.ip,path:req.path});
      const msg=v.reason==='expired'?'API Key expirada':v.reason==='revoked'?'API Key revocada':'API Key requerida. Envía X-API-Key o Authorization: Bearer ib_... Genera una en POST /api/keys';
      return res.status(401).json({error:msg});
    }
    if(scope && !(v.key.scopes||[]).includes(scope)){
      audit({ev:'scope_denied',keyId:v.key.id,scope:scope,ip:req.ip,path:req.path});
      return res.status(403).json({error:'La key no tiene el scope "'+scope+'". Scopes: '+(v.key.scopes||[]).join(', ')});
    }
    if(scope==='build' && !checkKeyQuota(v.key.id)){
      audit({ev:'quota_exceeded',keyId:v.key.id,ip:req.ip});
      return res.status(429).json({error:'Límite de builds por hora alcanzado (API_KEY_RATE_LIMIT, default 20/h)'});
    }
    req.apiKeyId=v.key.id;
    if(scope) audit({ev:'ok_'+scope,keyId:v.key.id,ip:req.ip,path:req.path});
    next();
  };
}
function requireAdmin(req,res,next){
  const t=process.env.ADMIN_TOKEN;
  if(!t) return next();
  const got=String(req.headers['x-admin-token']||'');
  const auth=String(req.headers['authorization']||'').replace(/^Bearer\s+/i,'');
  if(safeEq(got,t)||safeEq(auth,t)) return next();
  audit({ev:'admin_denied',ip:req.ip,path:req.path});
  res.status(403).json({error:'ADMIN_TOKEN requerido (header X-Admin-Token)'});
}


function loadGits(){ try{ return JSON.parse(fs.readFileSync(GIT_FILE,'utf-8')); }catch{ return []; } }
function saveGits(a){ const list=Array.isArray(a)?a:[]; fs.writeFileSync(GIT_FILE, JSON.stringify(list.slice(-MAX_GITS),null,2),'utf-8'); }


function loadVersions(){ try{ return JSON.parse(fs.readFileSync(VERSIONS_FILE,'utf-8')); }catch{ return {}; } }
function trimVersionEntry(entry){
  const src = entry && typeof entry === 'object' ? entry : {};
  const versions = (Array.isArray(src.versions)?src.versions:[]).slice(0, MAX_VERSIONS_PER_APP).map(v => {
    const one = v && typeof v === 'object' ? v : {};
    return { version: String(one.version||'').slice(0,20), changelog: String(one.changelog||'').slice(0,MAX_CHANGELOG), publishedAt: Number(one.publishedAt)||0 };
  });
  return Object.assign({}, src, { versions });
}
function pruneVersions(v){
  const src = (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  const apps = Object.keys(src).map(k => {
    const entry = trimVersionEntry(src[k]);
    return { key: k, entry, last: entry.versions.length ? entry.versions[0].publishedAt : 0 };
  });
  apps.sort((a,b)=>b.last-a.last);
  const out = {};
  apps.slice(0, MAX_VERSION_APPS).forEach(a => { out[a.key]=a.entry; });
  return out;
}
function saveVersions(v){ fs.writeFileSync(VERSIONS_FILE, JSON.stringify(pruneVersions(v),null,2),'utf-8'); }

function readJson(file, fallback){
  try{ return JSON.parse(fs.readFileSync(file, 'utf-8')); }catch(_){ return fallback; }
}

function pruneData(){
  const out = { auditTrimmed:false, auditBytes:0, historyTrimmed:false, historyEntries:0, historyBytes:0, versionApps:0, versionTrimmed:false, versionBytes:0 };
  const history = readJson(HISTORY_FILE, null);
  if(Array.isArray(history)){
    const built = buildHistory(history);
    out.historyEntries = built.kept.length;
    if(built.text !== JSON.stringify(history, null, 2)){
      fs.writeFileSync(HISTORY_FILE, built.text, 'utf-8');
      out.historyTrimmed = true;
    }
  }
  out.historyBytes = fileSize(HISTORY_FILE);
  out.auditTrimmed = trimAudit(true);
  out.auditBytes = fileSize(AUDIT_FILE);
  const versions = readJson(VERSIONS_FILE, null);
  if(versions && typeof versions === 'object' && !Array.isArray(versions)){
    const pruned = pruneVersions(versions);
    out.versionApps = Object.keys(pruned).length;
    const text = JSON.stringify(pruned, null, 2);
    if(text !== JSON.stringify(versions, null, 2)){
      fs.writeFileSync(VERSIONS_FILE, text, 'utf-8');
      out.versionTrimmed = true;
    }
  }
  out.versionBytes = fileSize(VERSIONS_FILE);
  return out;
}

module.exports = {
  builds,
  LIMITS,
  checkRateLimit,
  loadHistory,
  saveHistory,
  addHistory,
  updateHistory,
  loadKeys,
  saveKeys,
  hashKey,
  safeEq,
  apiKeysDisabled,
  audit,
  readAudit,
  checkKeyQuota,
  createApiKey,
  rotateApiKey,
  verifyApiKey,
  requireApiKey,
  requireAdmin,
  loadGits,
  saveGits,
  loadVersions,
  saveVersions,
  pruneData
};
