'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { fireWebhook } = require('../server/build-engine');
const { isBlockedUrl } = require('../server/url-guard');
const { normalizeConfig } = require('../server/generator/config');

function mockRes() {
  const res = { statusCode: 200, body: null, headers: {} };
  res.status = c => { res.statusCode = c; return res; };
  res.json = o => { res.body = o; return res; };
  res.send = o => { res.body = o; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}

async function withFetchStub(fn) {
  const calls = [];
  const warns = [];
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  globalThis.fetch = async (url) => { calls.push(String(url)); return { ok: true }; };
  console.warn = (...args) => warns.push(args.map(String).join(' '));
  try {
    await fn(calls, warns);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
  return { calls, warns };
}

function registerBuildRoutes() {
  const handlers = {};
  const app = {
    get: (p, ...h) => { handlers['GET ' + p] = h; },
    post: (p, ...h) => { handlers['POST ' + p] = h; }
  };
  const ctx = {
    gh: { config: () => ({ ready: false }) },
    generator: { normalizeConfig: (o) => Object.assign({ inputType: 'url', url: 'https://example.com', htmlCode: '' }, o) },
    templates: { applyTemplate: (o) => o },
    configFromBody: (b) => Object.assign({ inputType: 'url', url: 'https://example.com', htmlCode: '' }, b || {}),
    isBlockedUrl,
    startBuild: async () => ({ id: 'nuevo1', status: 'queued', branch: 'main' }),
    requireApiKey: () => (req, res, next) => next(),
    checkRateLimit: () => true,
    builds: new Map(),
    loadHistory: () => [],
    addSSEListener: () => {},
    removeSSEListener: () => {}
  };
  require('../server/routes/builds')(app, ctx);
  return handlers;
}

function registerAccountRoutes(initialGits) {
  const handlers = {};
  const app = {
    get: (p, ...h) => { handlers['GET ' + p] = h; },
    post: (p, ...h) => { handlers['POST ' + p] = h; },
    delete: (p, ...h) => { handlers['DELETE ' + p] = h; }
  };
  const gits = (initialGits || []).slice();
  const ctx = {
    generator: { normalizeConfig: (o) => o },
    loadKeys: () => [],
    saveKeys: () => {},
    createApiKey: () => ({}),
    rotateApiKey: () => null,
    readAudit: () => [],
    audit: () => {},
    requireAdmin: (req, res, next) => next(),
    loadGits: () => gits.slice(),
    saveGits: (rows) => { gits.length = 0; rows.forEach(r => gits.push(r)); },
    startBuild: async () => ({ id: 'build-1', status: 'queued', branch: 'main' })
  };
  require('../server/routes/account')(app, ctx);
  return handlers;
}

test('fireWebhook: no sale ningun fetch hacia hosts privados, metadata o no-http', async () => {
  const payload = { event: 'build.completed', buildId: 'w1', status: 'success' };
  const { calls, warns } = await withFetchStub(async () => {
    await fireWebhook('http://169.254.169.254/latest/meta-data/', payload);
    await fireWebhook('http://metadata.google.internal/computeMetadata/v1/', payload);
    await fireWebhook('http://127.0.0.1:8787/api/logs/txt', payload);
    await fireWebhook('http://localhost:9999/hook', payload);
    await fireWebhook('http://192.168.1.10/hook', payload);
    await fireWebhook('http://10.0.0.5/hook', payload);
    await fireWebhook('http://[::1]:8787/hook', payload);
    await fireWebhook('http://[::ffff:7f00:1]/hook', payload);
    await fireWebhook('http://[fc00::1]/hook', payload);
    await fireWebhook('file:///etc/passwd', payload);
    await fireWebhook('', payload);
  });
  assert.equal(calls.length, 0, 'ningun fetch saliente a destinos bloqueados');
  assert.ok(warns.some(w => w.includes('SSRF')), 'aviso SSRF emitido en consola');
});

test('fireWebhook: si envia el evento a una URL https publica', async () => {
  const payload = { event: 'build.completed', buildId: 'w2', status: 'success' };
  const { calls } = await withFetchStub(async () => {
    await fireWebhook('https://example.com/hook', payload);
  });
  assert.equal(calls.length, 1, 'un solo envio');
  assert.equal(calls[0], 'https://example.com/hook');
});

test('fireWebhook: en produccion exige https y en desarrollo admite http', async () => {
  const payload = { event: 'build.completed', buildId: 'w3', status: 'success' };
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const bloqueado = await withFetchStub(async () => {
      await fireWebhook('http://example.com/hook', payload);
    });
    assert.equal(bloqueado.calls.length, 0, 'http cleartext bloqueado en produccion');
    const permitido = await withFetchStub(async () => {
      await fireWebhook('https://example.com/hook', payload);
    });
    assert.equal(permitido.calls.length, 1, 'https sigue permitido en produccion');
    delete process.env.NODE_ENV;
    const dev = await withFetchStub(async () => {
      await fireWebhook('http://example.com/hook', payload);
    });
    assert.equal(dev.calls.length, 1, 'en desarrollo http sigue permitido');
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test('url-guard: IPv6 en corchetes, ULA y trailing dot quedan bloqueados', () => {
  assert.equal(isBlockedUrl('http://[::1]/'), true);
  assert.equal(isBlockedUrl('http://[::ffff:7f00:1]/'), true);
  assert.equal(isBlockedUrl('http://[fc00::1]/'), true);
  assert.equal(isBlockedUrl('http://[fd00::1]/'), true);
  assert.equal(isBlockedUrl('http://[fe80::1]/'), true);
  assert.equal(isBlockedUrl('http://localhost./hook'), true);
  assert.equal(isBlockedUrl('http://169.254.169.254/'), true);
  assert.equal(isBlockedUrl('ftp://example.com/hook'), true);
  assert.equal(isBlockedUrl('https://example.com/hook'), false);
  assert.equal(isBlockedUrl('http://example.com:8080/hook'), false);
});

test('config: webhookUrl privado o metadata se descarta y el publico se conserva', () => {
  const base = { appName: 'Webhook Test', url: 'https://example.com' };
  assert.equal(normalizeConfig({ ...base, webhookUrl: 'http://169.254.169.254/latest' }).webhookUrl, '');
  assert.equal(normalizeConfig({ ...base, webhookUrl: 'http://localhost:9999/hook' }).webhookUrl, '');
  assert.equal(normalizeConfig({ ...base, webhookUrl: 'http://127.0.0.1:8787/hook' }).webhookUrl, '');
  assert.equal(normalizeConfig({ ...base, webhookUrl: 'http://[::1]/hook' }).webhookUrl, '');
  assert.equal(normalizeConfig({ ...base, webhookUrl: 'javascript:alert(1)' }).webhookUrl, '');
  assert.equal(normalizeConfig({ ...base, webhookUrl: 'https://example.com/hook' }).webhookUrl, 'https://example.com/hook');
  assert.equal(normalizeConfig(base).webhookUrl, '');
});

test('builds: POST /api/build responde 400 ante webhookUrl SSRF', async () => {
  const handlers = registerBuildRoutes();
  const res = mockRes();
  await handlers['POST /api/build'][0]({
    body: { inputType: 'url', url: 'https://example.com', webhookUrl: 'http://169.254.169.254/hook' },
    ip: '9.9.9.9',
    connection: { remoteAddress: '9.9.9.9' }
  }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Webhook URL bloqueada/);
  assert.match(res.body.error, /hosts privados/);
});

test('builds: POST /api/build acepta webhookUrl publica con 202', async () => {
  const handlers = registerBuildRoutes();
  const res = mockRes();
  await handlers['POST /api/build'][0]({
    body: { inputType: 'url', url: 'https://example.com', webhookUrl: 'https://example.com/hook' },
    ip: '9.9.9.9',
    connection: { remoteAddress: '9.9.9.9' }
  }, res);
  assert.equal(res.statusCode, 202);
  assert.equal(res.body.id, 'nuevo1');
});

test('builds: POST /api/v1/build responde 400 ante webhookUrl SSRF', async () => {
  const handlers = registerBuildRoutes();
  const res = mockRes();
  await handlers['POST /api/v1/build'][1]({
    body: { url: 'https://example.com', webhookUrl: 'http://localhost:9999/hook' },
    ip: '9.9.9.9'
  }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Webhook URL bloqueada/);
  const ok = mockRes();
  await handlers['POST /api/v1/build'][1]({
    body: { url: 'https://example.com', webhookUrl: 'https://example.com/hook' },
    ip: '9.9.9.9'
  }, ok);
  assert.equal(ok.statusCode, 202);
});

test('builds: POST /api/project responde 400 ante webhookUrl SSRF', async () => {
  const handlers = registerBuildRoutes();
  const res = mockRes();
  await handlers['POST /api/project'][0]({
    body: { inputType: 'url', url: 'https://example.com', webhookUrl: 'http://[::1]:8787/hook' }
  }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Webhook URL bloqueada/);
});

test('account: POST /api/git/connect rechaza webhookUrl privada y acepta la publica', async () => {
  const handlers = registerAccountRoutes();
  const res = mockRes();
  await handlers['POST /api/git/connect'][1]({
    body: { repo: 'user/repo', branch: 'main', webhookUrl: 'http://169.254.169.254/hook' }
  }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Webhook URL bloqueada/);
  const ok = mockRes();
  await handlers['POST /api/git/connect'][1]({
    body: { repo: 'user/repo', branch: 'main', webhookUrl: 'https://example.com/hook' }
  }, ok);
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.ok, true);
  const sinWebhook = mockRes();
  await handlers['POST /api/git/connect'][1]({ body: { repo: 'user/otro', branch: 'main' } }, sinWebhook);
  assert.equal(sinWebhook.statusCode, 200);
  assert.equal(sinWebhook.body.ok, true);
});

test('account: POST /api/git/webhook sigue operativo y dispara el build', async () => {
  const handlers = registerAccountRoutes([
    { id: 'g1', repo: 'user/repo', branch: 'main', webhookUrl: 'https://example.com/hook' }
  ]);
  const res = mockRes();
  await handlers['POST /api/git/webhook'][0]({
    body: { repository: { full_name: 'user/repo' }, ref: 'refs/heads/main' },
    ip: '9.9.9.9'
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.buildId, 'build-1');
  assert.equal(res.body.branch, 'main');
});
