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


function loadKeys(){ try{ return JSON.parse(fs.readFileSync(APIKEYS_FILE,'utf-8')); }catch{ return []; } }
function saveKeys(a){ fs.writeFileSync(APIKEYS_FILE, JSON.stringify(a,null,2),'utf-8'); }
function hashKey(key){ return crypto.createHash('sha256').update(String(key)).digest('hex'); }
function safeEq(a, b){
  const ha=crypto.createHash('sha256').update(String(a||'')).digest();
  const hb=crypto.createHash('sha256').update(String(b||'')).digest();
  return crypto.timingSafeEqual(ha,hb);
}
function apiKeysDisabled(){ return /^(1|true|yes)$/i.test(String(process.env.API_KEYS_DISABLED||'')); }

const AUDIT_FILE = path.join(DATA_DIR, 'audit.log');
function audit(ev){
  try{
    fs.appendFileSync(AUDIT_FILE, JSON.stringify(Object.assign({ts:Date.now()}, ev))+'\n');
    if(fs.statSync(AUDIT_FILE).size > 2*1024*1024){
      const lines=fs.readFileSync(AUDIT_FILE,'utf-8').split('\n').filter(Boolean).slice(-500);
      fs.writeFileSync(AUDIT_FILE, lines.join('\n')+'\n');
    }
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
function saveGits(a){ fs.writeFileSync(GIT_FILE, JSON.stringify(a,null,2),'utf-8'); }


function loadVersions(){ try{ return JSON.parse(fs.readFileSync(VERSIONS_FILE,'utf-8')); }catch{ return {}; } }
function saveVersions(v){ fs.writeFileSync(VERSIONS_FILE, JSON.stringify(v,null,2),'utf-8'); }

module.exports = {
  builds,
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
  saveVersions
};
