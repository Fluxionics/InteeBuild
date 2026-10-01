'use strict';

const fs = require('fs');
const crypto = require('crypto');

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
  createApiKey,
  verifyApiKey,
  requireApiKey,
  loadGits,
  saveGits,
  loadVersions,
  saveVersions
};
