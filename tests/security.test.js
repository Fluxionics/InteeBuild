'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const APIKEYS_FILE = path.join(__dirname, '..', 'data', 'apikeys.json');
const store = require('../server/store');
const corsConfig = require('../server/cors-config');

function withKeysFile(fn){
  const backup = fs.existsSync(APIKEYS_FILE) ? fs.readFileSync(APIKEYS_FILE, 'utf8') : null;
  try { return fn(); }
  finally {
    if (backup === null) { try { fs.unlinkSync(APIKEYS_FILE); } catch (_) {} }
    else fs.writeFileSync(APIKEYS_FILE, backup);
  }
}
function mockRes(){
  const res = { statusCode: 200, body: null, headers: {} };
  res.status = c => { res.statusCode = c; return res; };
  res.json = o => { res.body = o; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}
function mockReq(token, extra){
  const headers = {};
  if (token) headers['x-api-key'] = token;
  return Object.assign({ headers, ip: '9.9.9.9', path: '/api/v1/build' }, extra || {});
}

test('keys: sin keys la API queda abierta', () => withKeysFile(() => {
  fs.writeFileSync(APIKEYS_FILE, '[]');
  let passed = false;
  store.requireApiKey('build')(mockReq(), mockRes(), () => { passed = true; });
  assert.ok(passed, 'sin keys pasa al siguiente middleware');
}));

test('keys: scope build exigido y denegado en 403 si falta', () => withKeysFile(() => {
  const created = store.createApiKey('scoped', ['build']);
  let passed = false;
  store.requireApiKey('build')(mockReq(created.key), mockRes(), () => { passed = true; });
  assert.ok(passed, 'scope build presente -> next');
  const res = mockRes();
  let passedDecomp = false;
  store.requireApiKey('decompile')(mockReq(created.key), res, () => { passedDecomp = true; });
  assert.ok(!passedDecomp, 'scope decompile ausente -> no pasa');
  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /decompile/);
}));

test('keys: quota por key 429 tras API_KEY_RATE_LIMIT', () => withKeysFile(() => {
  process.env.API_KEY_RATE_LIMIT = '2';
  try {
    const created = store.createApiKey('limited', ['build']);
    const mw = store.requireApiKey('build');
    let ok = 0;
    for (let i = 0; i < 3; i++) {
      let passed = false;
      mw(mockReq(created.key), mockRes(), () => { passed = true; });
      if (passed) ok++;
    }
    assert.equal(ok, 2, 'pasa 2 y el tercero cae');
    const res = mockRes();
    let passed4 = false;
    mw(mockReq(created.key), res, () => { passed4 = true; });
    assert.ok(!passed4);
    assert.equal(res.statusCode, 429);
  } finally { delete process.env.API_KEY_RATE_LIMIT; }
}));

test('keys: expirada responde 401', () => withKeysFile(() => {
  const created = store.createApiKey('temp', ['build']);
  const all = store.loadKeys();
  const idx = all.findIndex(k => k.id === created.id);
  all[idx].expiresAt = Date.now() - 1000;
  store.saveKeys(all);
  const res = mockRes();
  let passed = false;
  store.requireApiKey('build')(mockReq(created.key), res, () => { passed = true; });
  assert.ok(!passed, 'key expirada no pasa');
  assert.equal(res.statusCode, 401);
  assert.match(res.body.error, /expirada/);
}));

test('keys: API_KEYS_DISABLED devuelve 503 aunque la key sea válida', () => withKeysFile(() => {
  const created = store.createApiKey('kill', ['build']);
  process.env.API_KEYS_DISABLED = '1';
  try {
    const res = mockRes();
    let passed = false;
    store.requireApiKey('build')(mockReq(created.key), res, () => { passed = true; });
    assert.ok(!passed, 'kill switch activo bloquea todo');
    assert.equal(res.statusCode, 503);
  } finally { delete process.env.API_KEYS_DISABLED; }
}));

test('keys: rotate revoca la vieja y sirve la nueva', () => withKeysFile(() => {
  const created = store.createApiKey('rot', ['build']);
  const rotated = store.rotateApiKey(created.id);
  assert.ok(rotated, 'rotate devuelve la key nueva');
  assert.notEqual(rotated.key, created.key, 'key distinta');
  const old = store.verifyApiKey(mockReq(created.key));
  assert.equal(old.valid, false, 'vieja revocada');
  assert.equal(old.reason, 'revoked');
  const fresh = store.verifyApiKey(mockReq(rotated.key));
  assert.equal(fresh.valid, true, 'nueva válida');
  assert.equal(fresh.key.scopes.includes('build'), true, 'conserva scopes');
}));

test('keys: audit log guarda eventos y readAudit filtra por keyId', () => {
  const id = 'test' + Date.now().toString(36);
  store.audit({ ev: 'unit_test', keyId: id });
  const rows = store.readAudit(id, 10);
  assert.ok(rows.some(r => r.ev === 'unit_test'), 'evento presente');
  assert.ok(rows.every(r => r.keyId === id), 'filtrado por keyId');
});

test('admin: ADMIN_TOKEN exige header en rutas admin', () => {
  process.env.ADMIN_TOKEN = 'secreto-admin';
  try {
    const res = mockRes();
    let passed = false;
    store.requireAdmin(mockReq(), res, () => { passed = true; });
    assert.ok(!passed, 'sin token no pasa');
    assert.equal(res.statusCode, 403);
    let passed2 = false;
    store.requireAdmin(mockReq(null, { headers: { 'x-admin-token': 'secreto-admin' } }), mockRes(), () => { passed2 = true; });
    assert.ok(passed2, 'con X-Admin-Token pasa');
    let passed3 = false;
    store.requireAdmin(mockReq(null, { headers: { authorization: 'Bearer secreto-admin' } }), mockRes(), () => { passed3 = true; });
    assert.ok(passed3, 'con Authorization Bearer pasa');
  } finally { delete process.env.ADMIN_TOKEN; }
});

test('admin: sin ADMIN_TOKEN las rutas admin siguen abiertas (opt-in)', () => {
  delete process.env.ADMIN_TOKEN;
  let passed = false;
  store.requireAdmin(mockReq(), mockRes(), () => { passed = true; });
  assert.ok(passed, 'sin env no se rompe nada');
});

test('account: GET /api/keys queda tras requireAdmin cuando hay token', () => {
  const handlers = {};
  const app = {
    get: (p, ...h) => { handlers['GET ' + p] = h; },
    post: (p, ...h) => { handlers['POST ' + p] = h; },
    delete: (p, ...h) => { handlers['DELETE ' + p] = h; }
  };
  require('../server/routes/account')(app, store);
  assert.ok(handlers['GET /api/keys'], 'ruta registrada');
  const mw = handlers['GET /api/keys'][0];
  process.env.ADMIN_TOKEN = 'abc123';
  try {
    const res = mockRes();
    let passed = false;
    mw(mockReq(), res, () => { passed = true; });
    assert.ok(!passed, 'middleware admin bloquea');
    assert.equal(res.statusCode, 403);
  } finally { delete process.env.ADMIN_TOKEN; }
});

test('builds: POST /api/v1/build exige scope build y limita por IP', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'builds.js'), 'utf8');
  assert.match(src, /requireApiKey\('build'\)/, 'v1 usa la factory con scope build');
  assert.match(src, /checkRateLimit\(ip\)/, 'POST /api/build tiene rate limit por IP');
});

test('cors: produccion sin CORS_ORIGIN no refleja origenes externos', () => {
  process.env.NODE_ENV = 'production';
  delete process.env.CORS_ORIGIN;
  try {
    const cfg = corsConfig();
    cfg.origin('https://evil.example', (err, allow) => {
      assert.equal(err, null);
      assert.equal(allow, false, 'produccion sin allowlist -> sin CORS');
    });
    cfg.origin(undefined, (err, allow) => {
      assert.equal(allow, true, 'same-origin/curl sin Origin -> permitido');
    });
  } finally { delete process.env.NODE_ENV; }
});

test('cors: con CORS_ORIGIN solo ese origen y en dev se permite todo', () => {
  process.env.CORS_ORIGIN = 'https://app.example.com';
  try {
    const cfg = corsConfig();
    cfg.origin('https://app.example.com', (e, a) => assert.equal(a, true));
    cfg.origin('https://otro.example', (e, a) => assert.equal(a, false));
  } finally { delete process.env.CORS_ORIGIN; }
  delete process.env.NODE_ENV;
  const dev = corsConfig();
  dev.origin('https://cualquiera.dev', (e, a) => assert.equal(a, true, 'dev permite origen'));
});

test('workflow: artifacts con retention y concurrencia serializada', () => {
  const { WORKFLOW_YML, DECOMPILE_WORKFLOW_YML } = require('../server/generator/workflow');
  const uploads = (WORKFLOW_YML.match(/upload-artifact@v4/g) || []).length;
  const retentions = (WORKFLOW_YML.match(/retention-days: 3/g) || []).length;
  assert.equal(uploads, retentions, 'todo upload tiene retention-days');
  assert.match(WORKFLOW_YML, /concurrency:\n  group: ib-build-/, 'grupo de concurrencia build');
  assert.match(DECOMPILE_WORKFLOW_YML, /concurrency:\n  group: ib-decompile-/, 'grupo de concurrencia decompile');
  assert.match(DECOMPILE_WORKFLOW_YML, /retention-days: 7/, 'decompile conserva 7 dias');
});

test('server: CORS sin fallback abierto en produccion', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'server', 'server.js'), 'utf8');
  assert.ok(!src.includes('origin: true'), 'sin origin: true reflejando todo');
  assert.match(src, /cors-config/, 'usa el modulo cors-config');
});
