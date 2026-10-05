'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, after } = require('node:test');
const assert = require('node:assert/strict');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'inteebuild-cleanup-'));
process.env.INTEE_DATA_DIR = TMP;
process.env.CLEANUP_SECRET = 'secreto-limpieza-test';

const store = require('../server/store');
const registerSystemRoutes = require('../server/routes/system');

const HISTORY_FILE = path.join(TMP, 'builds.json');
const AUDIT_FILE = path.join(TMP, 'audit.log');
const VERSIONS_FILE = path.join(TMP, 'versions.json');
const APIKEYS_FILE = path.join(TMP, 'apikeys.json');
const GIT_FILE = path.join(TMP, 'git-integrations.json');

after(() => {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
});

function resetData() {
  fs.writeFileSync(HISTORY_FILE, '[]', 'utf-8');
  fs.writeFileSync(AUDIT_FILE, '', 'utf-8');
  fs.writeFileSync(VERSIONS_FILE, '{}', 'utf-8');
  fs.writeFileSync(APIKEYS_FILE, '[]', 'utf-8');
  fs.writeFileSync(GIT_FILE, '[]', 'utf-8');
}

function lineasAudit() {
  return fs.readFileSync(AUDIT_FILE, 'utf-8').split('\n').filter(Boolean);
}

function semillaAudit(prefijo) {
  const linea = JSON.stringify({ ts: Date.now(), ev: 'semilla', blob: prefijo.repeat(1000) }) + '\n';
  fs.writeFileSync(AUDIT_FILE, linea.repeat(2600), 'utf-8');
}

function mockRes() {
  const res = { statusCode: 200, body: null, headers: {} };
  res.status = c => { res.statusCode = c; return res; };
  res.json = o => { res.body = o; return res; };
  res.send = o => { res.body = o; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}

function loadHandlers(register, ctx) {
  const handlers = {};
  const app = {
    get: (p, ...h) => { handlers['GET ' + p] = h; },
    post: (p, ...h) => { handlers['POST ' + p] = h; },
    delete: (p, ...h) => { handlers['DELETE ' + p] = h; }
  };
  register(app, ctx);
  return handlers;
}

async function waitFor(predicate) {
  const limite = Date.now() + 3000;
  while (!predicate()) {
    if (Date.now() > limite) throw new Error('sin respuesta a tiempo');
    await new Promise(r => setTimeout(r, 5));
  }
}

test('audit: audit.log se poda al superar el limite', () => {
  resetData();
  semillaAudit('x');
  const antes = fs.statSync(AUDIT_FILE).size;
  assert.ok(antes > store.LIMITS.AUDIT_MAX_BYTES, 'la semilla supera el umbral');
  store.audit({ ev: 'post_recorte' });
  const lineas = lineasAudit();
  assert.ok(lineas.length <= store.LIMITS.AUDIT_KEEP_LINES, 'quedan como maximo AUDIT_KEEP_LINES lineas');
  assert.ok(fs.statSync(AUDIT_FILE).size < antes, 'el archivo baja de tamano');
  const ultima = JSON.parse(lineas[lineas.length - 1]);
  assert.equal(ultima.ev, 'post_recorte', 'se conserva el evento mas reciente');
  const leidas = store.readAudit(null, 10);
  assert.equal(leidas[0].ev, 'post_recorte', 'readAudit sigue leyendo tras el recorte');
});

test('audit: un archivo por debajo del limite no se recorta', () => {
  resetData();
  store.audit({ ev: 'uno' });
  store.audit({ ev: 'dos' });
  assert.equal(lineasAudit().length, 2, 'las dos lineas siguen intactas');
  assert.equal(JSON.parse(lineasAudit()[1]).ev, 'dos', 'el orden se conserva');
});

test('historial: saveHistory se queda en MAX_HISTORY y conserva los mas recientes', () => {
  resetData();
  const total = store.LIMITS.MAX_HISTORY + 25;
  for (let i = 0; i < total; i++) store.addHistory({ id: 'b' + i, status: 'success', createdAt: Date.now() + i });
  const historial = store.loadHistory();
  assert.equal(historial.length, store.LIMITS.MAX_HISTORY, 'tope de entradas');
  assert.equal(historial[0].id, 'b' + (total - 1), 'la mas reciente va primero');
  assert.equal(historial[historial.length - 1].id, 'b' + (total - store.LIMITS.MAX_HISTORY), 'las mas viejas se podan');
  const enDisco = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
  assert.equal(enDisco.length, store.LIMITS.MAX_HISTORY, 'el tope tambien vale en disco');
});

test('historial: los campos de config muy grandes no se persisten', () => {
  resetData();
  const htmlPesado = 'a'.repeat(store.LIMITS.MAX_FIELD_PERSIST + 1);
  const splashPesado = 'data:image/png;base64,' + 'b'.repeat(store.LIMITS.MAX_FIELD_PERSIST + 500);
  store.addHistory({ id: 'pesado', status: 'success', config: { inputType: 'html', htmlCode: htmlPesado, splashImageBase64: splashPesado, appName: 'Pesada' } });
  store.addHistory({ id: 'ligero', status: 'success', config: { inputType: 'html', htmlCode: '<p>hola</p>', appName: 'Ligera' } });
  const historial = store.loadHistory();
  const pesado = historial.find(x => x.id === 'pesado');
  assert.equal(pesado.config.htmlCode, '', 'el HTML grande no viaja a disco');
  assert.equal(pesado.config.splashImageBase64, '', 'la imagen grande no viaja a disco');
  assert.deepEqual(pesado.config.omittedFields, ['htmlCode', 'splashImageBase64'], 'lista los campos omitidos');
  assert.equal(pesado.config.appName, 'Pesada', 'el resto de la configuracion se conserva');
  const ligero = historial.find(x => x.id === 'ligero');
  assert.equal(ligero.config.htmlCode, '<p>hola</p>', 'el HTML pequeno se conserva integro');
  assert.equal(ligero.config.omittedFields, undefined, 'sin campos omitidos cuando no hace falta');
  assert.ok(fs.statSync(HISTORY_FILE).size < store.LIMITS.MAX_FIELD_PERSIST, 'el archivo queda lejos del campo gigante');
});

test('historial: builds.json no supera MAX_HISTORY_BYTES', () => {
  resetData();
  const gordo = () => ({ inputType: 'html', htmlCode: 'c'.repeat(90000), splash: 'd'.repeat(90000), fg: 'e'.repeat(90000), bg: 'f'.repeat(90000) });
  for (let i = 0; i < 12; i++) store.addHistory({ id: 'g' + i, status: 'success', createdAt: i, config: gordo() });
  const tamano = fs.statSync(HISTORY_FILE).size;
  assert.ok(tamano <= store.LIMITS.MAX_HISTORY_BYTES, 'dentro del presupuesto de bytes');
  const historial = store.loadHistory();
  assert.equal(historial[0].id, 'g11', 'la mas reciente se conserva');
  assert.ok(historial.length >= 1 && historial.length < 12, 'las mas viejas se podan por presupuesto');
});

test('versions: saveVersions acota por app y en total', () => {
  resetData();
  const totalApps = store.LIMITS.MAX_VERSION_APPS + 40;
  const versiones = {};
  for (let i = 0; i < totalApps; i++) {
    const lista = [];
    for (let j = 0; j < store.LIMITS.MAX_VERSIONS_PER_APP + 5; j++) {
      lista.unshift({ version: '1.0.' + j, changelog: 'c'.repeat(600), publishedAt: 1000 + i * 100 + j });
    }
    versiones['com.example.app' + i] = { appId: 'com.example.app' + i, versions: lista };
  }
  store.saveVersions(versiones);
  const cargado = store.loadVersions();
  const claves = Object.keys(cargado);
  assert.equal(claves.length, store.LIMITS.MAX_VERSION_APPS, 'tope de proyectos');
  claves.forEach(k => assert.ok(cargado[k].versions.length <= store.LIMITS.MAX_VERSIONS_PER_APP, 'tope por proyecto'));
  assert.ok(cargado['com.example.app' + (totalApps - 1)], 'el proyecto mas reciente se conserva');
  assert.equal(cargado['com.example.app0'], undefined, 'los proyectos mas antiguos se podan');
  const changelog = cargado['com.example.app' + (totalApps - 1)].versions[0].changelog;
  assert.ok(changelog.length <= store.LIMITS.MAX_CHANGELOG, 'el changelog se acota');
});

test('keys: saveKeys poda las revocadas antiguas al pasar de MAX_KEYS', () => {
  resetData();
  const keys = [];
  for (let i = 0; i < store.LIMITS.MAX_KEYS + 40; i++) {
    keys.push({ id: 'k' + i, keyHash: 'h'.repeat(64), name: 'n' + i, createdAt: i, revokedAt: i < 40 ? i : null, scopes: ['build'] });
  }
  store.saveKeys(keys);
  const trasRevocadas = store.loadKeys();
  assert.equal(trasRevocadas.length, store.LIMITS.MAX_KEYS, 'tope de keys');
  assert.ok(trasRevocadas.every(k => !k.revokedAt), 'solo quedan activas');
  assert.ok(trasRevocadas.find(k => k.id === 'k139'), 'la activa mas nueva se conserva');

  const activas = [];
  for (let i = 0; i < store.LIMITS.MAX_KEYS + 10; i++) activas.push({ id: 'a' + i, keyHash: 'h'.repeat(64), createdAt: i, revokedAt: null, scopes: ['build'] });
  store.saveKeys(activas);
  const trasActivas = store.loadKeys();
  assert.equal(trasActivas.length, store.LIMITS.MAX_KEYS, 'tope tambien sin revocadas');
  assert.ok(trasActivas.find(k => k.id === 'a' + (store.LIMITS.MAX_KEYS + 9)), 'se descartan las mas antiguas');
});

test('gits: saveGits se queda con las ultimas integraciones', () => {
  resetData();
  const gits = [];
  for (let i = 0; i < store.LIMITS.MAX_GITS + 20; i++) gits.push({ id: 'g' + i, repo: 'u/r' + i, branch: 'main', createdAt: i });
  store.saveGits(gits);
  const cargado = store.loadGits();
  assert.equal(cargado.length, store.LIMITS.MAX_GITS, 'tope de integraciones');
  assert.equal(cargado[0].id, 'g20', 'las mas viejas se podan');
  assert.equal(cargado[cargado.length - 1].id, 'g' + (store.LIMITS.MAX_GITS + 19), 'la mas nueva se conserva');
});

test('pruneData: no pisa un builds.json corrupto', () => {
  resetData();
  fs.writeFileSync(HISTORY_FILE, 'esto no es json', 'utf-8');
  fs.writeFileSync(VERSIONS_FILE, 'tampoco es json', 'utf-8');
  const parte = store.pruneData();
  assert.equal(parte.historyTrimmed, false, 'no intenta reescribir el historial ilegible');
  assert.equal(parte.versionTrimmed, false, 'no intenta reescribir las versiones ilegibles');
  assert.equal(fs.readFileSync(HISTORY_FILE, 'utf-8'), 'esto no es json', 'builds.json queda tal cual');
  assert.equal(fs.readFileSync(VERSIONS_FILE, 'utf-8'), 'tampoco es json', 'versions.json queda tal cual');
});

test('cleanup: GET /api/cleanup poda audit.log y builds.json', async () => {
  resetData();
  semillaAudit('y');
  const sucio = [];
  for (let i = store.LIMITS.MAX_HISTORY + 4; i >= 0; i--) {
    sucio.push({ id: 'c' + i, status: 'success', createdAt: i, config: { inputType: 'html', htmlCode: 'z'.repeat(store.LIMITS.MAX_FIELD_PERSIST + 1), appName: 'App' + i } });
  }
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(sucio, null, 2), 'utf-8');
  assert.ok(fs.statSync(AUDIT_FILE).size > store.LIMITS.AUDIT_MAX_BYTES, 'audit.log empieza sobre el limite');
  assert.ok(fs.statSync(HISTORY_FILE).size > store.LIMITS.MAX_FIELD_PERSIST, 'builds.json arrastra el HTML gigante');

  const gh = { config: () => ({ ready: true, owner: 'u', repo: 'r' }), cleanup: async () => ({ branches: 1, runs: 2, artifacts: 3 }) };
  const handlers = loadHandlers(registerSystemRoutes, {
    gh,
    VERSION: 'test',
    loadHistory: store.loadHistory,
    saveHistory: store.saveHistory,
    safeEq: store.safeEq,
    pruneData: store.pruneData
  });
  const mw = handlers['GET /api/cleanup'][0];
  assert.ok(mw, 'ruta registrada');

  const sinSecreto = mockRes();
  mw({ query: {} }, sinSecreto);
  assert.equal(sinSecreto.statusCode, 403, 'sin secret no pasa');

  const res = mockRes();
  mw({ query: { secret: process.env.CLEANUP_SECRET } }, res);
  await waitFor(() => res.body);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true, 'la respuesta de GitHub sigue igual');
  assert.equal(res.body.branches, 1, 'devuelve la limpieza de GitHub');
  assert.ok(res.body.data, 'devuelve el parte de poda de data/');
  assert.equal(res.body.data.historyTrimmed, true, 'marca el historial como podado');
  assert.equal(res.body.data.auditTrimmed, true, 'marca el audit como podado');

  const historial = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
  assert.equal(historial.length, store.LIMITS.MAX_HISTORY, 'el historial queda en el tope');
  assert.equal(historial[0].id, 'c' + (store.LIMITS.MAX_HISTORY + 4), 'conserva los mas recientes');
  assert.equal(historial[0].config.htmlCode, '', 'el HTML pesado ya no esta en disco');
  const lineas = lineasAudit();
  assert.ok(lineas.length <= store.LIMITS.AUDIT_KEEP_LINES, 'audit.log podado');
  assert.ok(fs.statSync(AUDIT_FILE).size < store.LIMITS.AUDIT_MAX_BYTES, 'audit.log bajo el limite');
});
