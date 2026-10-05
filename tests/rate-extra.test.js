'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const store = require('../server/store');

function mockRes() {
  const res = { statusCode: 200, body: null, headers: {} };
  res.status = c => { res.statusCode = c; return res; };
  res.json = o => { res.body = o; return res; };
  res.send = o => { res.body = o; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}

function mockReq(ip, extra) {
  return Object.assign({ ip, headers: {}, query: {}, body: {}, params: {}, connection: { remoteAddress: ip } }, extra || {});
}

function loadRoutes(load, ctx) {
  const handlers = {};
  const app = {
    get: (p, ...h) => { handlers['GET ' + p] = h; },
    post: (p, ...h) => { handlers['POST ' + p] = h; },
    delete: (p, ...h) => { handlers['DELETE ' + p] = h; }
  };
  load(app, ctx);
  return handlers;
}

function exhaust(fn, times) {
  let ok = 0;
  for (let i = 0; i < times; i++) if (fn()) ok++;
  return ok;
}

test('rate: buckets separados para la misma IP', () => {
  const ip = '203.0.113.10';
  assert.equal(exhaust(() => store.checkRateLimit(ip, 'analyze'), 12), 10, 'bucket analyze se agota en 10');
  assert.equal(store.checkRateLimit(ip, 'analyze'), false, 'el onceavo del bucket analyze cae');
  assert.equal(store.checkRateLimit(ip, 'catalog'), true, 'bucket catalog sigue abierto');
  assert.equal(store.checkRateLimit(ip), true, 'sin bucket sigue abierto');
  let okX = 0;
  for (let i = 0; i < 12; i++) if (store.checkRateLimit(ip, 'x')) okX++;
  assert.equal(okX, 10, 'bucket x tiene su propia cuota de 10');
  assert.equal(store.checkRateLimit(ip, 'x'), false, 'bucket x ya agotado');
  assert.equal(store.checkRateLimit(ip, 'analyze'), false, 'analyze sigue bloqueado tras agotar x');
  assert.equal(store.checkRateLimit(ip, 'catalog'), true, 'catalog conserva su cuota');
});

test('rate: sin bucket se usa la clave antigua', () => {
  const ip = '203.0.113.20';
  assert.equal(exhaust(() => store.checkRateLimit(ip, ''), 10), 10, 'bucket vacio admite 10');
  assert.equal(store.checkRateLimit(ip), false, 'sin bucket comparte la clave antigua con el string vacio');
  const otro = '203.0.113.21';
  assert.equal(exhaust(() => store.checkRateLimit(otro), 10), 10, 'la llamada sin bucket conserva la cuota de 10 por hora');
  assert.equal(store.checkRateLimit(otro), false, 'el onceavo sin bucket cae');
  assert.equal(store.checkRateLimit(otro, 'analyze'), true, 'el bucket analyze no hereda la cuota antigua');
});

test('rate: las IPs no comparten cuota entre si', () => {
  const a = '203.0.113.30';
  const b = '203.0.113.31';
  assert.equal(exhaust(() => store.checkRateLimit(a, 'analyze'), 11), 10, 'la IP a se agota');
  assert.equal(store.checkRateLimit(a, 'analyze'), false, 'la IP a queda bloqueada');
  assert.equal(store.checkRateLimit(b, 'analyze'), true, 'la IP b sigue con cuota completa');
});

test('analyze: POST /api/analyze/fix responde 429 al agotar el bucket analyze', async () => {
  const ctx = {
    isBlockedUrl: () => false,
    detectFramework: () => [],
    detectWebApis: () => [],
    buildRecommendations: () => [],
    securityScan: () => ({}),
    errorDetection: () => ({}),
    optimizationReport: () => ({}),
    autoFixHtml: h => h,
    checkRateLimit: store.checkRateLimit
  };
  const handlers = loadRoutes(require('../server/routes/analyze'), ctx);
  const mw = handlers['POST /api/analyze/fix'][0];
  assert.ok(mw, 'ruta registrada');
  const ip = '203.0.113.40';
  let ok = 0;
  for (let i = 0; i < 10; i++) {
    const res = mockRes();
    await mw(mockReq(ip, { body: { html: '<p>hola</p>' } }), res);
    if (res.statusCode === 200) ok++;
  }
  assert.equal(ok, 10, 'las diez primeras pasan');
  const res = mockRes();
  await mw(mockReq(ip, { body: { html: '<p>hola</p>' } }), res);
  assert.equal(res.statusCode, 429, 'la decimoprimera cae');
  assert.equal(res.body.error, 'Rate limit: 10/h por IP');
});

test('analyze: el bucket analyze no consume la cuota de builds', async () => {
  const ctx = {
    isBlockedUrl: () => false,
    detectFramework: () => [],
    detectWebApis: () => [],
    buildRecommendations: () => [],
    securityScan: () => ({}),
    errorDetection: () => ({}),
    optimizationReport: () => ({}),
    autoFixHtml: h => h,
    checkRateLimit: store.checkRateLimit
  };
  const handlers = loadRoutes(require('../server/routes/analyze'), ctx);
  const mw = handlers['POST /api/analyze/fix'][0];
  const ip = '203.0.113.41';
  for (let i = 0; i < 10; i++) {
    const res = mockRes();
    await mw(mockReq(ip, { body: { html: '<p>hola</p>' } }), res);
    assert.equal(res.statusCode, 200);
  }
  assert.equal(store.checkRateLimit(ip, 'analyze'), false, 'bucket analyze agotado');
  assert.equal(store.checkRateLimit(ip), true, 'la cuota de builds sigue intacta');
});

test('catalog: POST /api/inspect responde 429 con el bucket catalog', async () => {
  const ctx = { checkRateLimit: store.checkRateLimit };
  const handlers = loadRoutes(require('../server/routes/catalog'), ctx);
  const mw = handlers['POST /api/inspect'][0];
  assert.ok(mw, 'ruta registrada');
  const ip = '203.0.113.50';
  for (let i = 0; i < 10; i++) {
    const res = mockRes();
    await mw(mockReq(ip, { body: {} }), res);
    assert.equal(res.statusCode, 400, 'sin apkBase64 responde 400 antes del limite');
  }
  const res = mockRes();
  await mw(mockReq(ip, { body: {} }), res);
  assert.equal(res.statusCode, 429, 'la decimoprimera cae');
  assert.equal(res.body.error, 'Rate limit: 10/h por IP');
  const otro = mockRes();
  await mw(mockReq('203.0.113.51', { body: {} }), otro);
  assert.equal(otro.statusCode, 400, 'otra IP no afectada');
});

test('outputs: GET /api/ad-proxy responde 429 con el bucket ads', async () => {
  const ctx = { checkRateLimit: store.checkRateLimit };
  const handlers = loadRoutes(require('../server/routes/outputs'), ctx);
  const mw = handlers['GET /api/ad-proxy'][0];
  assert.ok(mw, 'ruta registrada');
  const ip = '203.0.113.60';
  for (let i = 0; i < 10; i++) {
    const res = mockRes();
    await mw(mockReq(ip, { query: {} }), res);
    assert.equal(res.statusCode, 400, 'sin u valida responde 400 antes del limite');
  }
  const res = mockRes();
  await mw(mockReq(ip, { query: {} }), res);
  assert.equal(res.statusCode, 429, 'la decimoprimera cae');
  assert.equal(res.body.error, 'Rate limit: 10/h por IP');
  const slot = handlers['GET /api/ads/:slot'][0];
  const resSlot = mockRes();
  await slot(mockReq('203.0.113.61', { params: { slot: 'banner' } }), resSlot);
  assert.equal(resSlot.statusCode, 200, 'el listado de slots sigue respondiendo');
});
