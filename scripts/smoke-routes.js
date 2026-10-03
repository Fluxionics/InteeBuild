'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const JSZip = require(ROOT + '/node_modules/jszip');
const express = require(ROOT + '/node_modules/express');
const store = require(ROOT + '/server/store');
const buildEngine = require(ROOT + '/server/build-engine');
const urlGuard = require(ROOT + '/server/url-guard');
const analyzers = require(ROOT + '/server/analyzers');

let failures = 0;
function check(label, cond, extra) {
  if (cond) { console.log('  ok  ' + label); }
  else { failures++; console.log('  FAIL ' + label + (extra === undefined ? '' : ' -> ' + JSON.stringify(extra))); }
}

async function main() {
  const zip = new JSZip();
  zip.file('app-debug.apk', 'PK-APK-BYTES');
  const apkZip = await zip.generateAsync({ type: 'nodebuffer' });
  const zipX = new JSZip();
  zipX.file('Bundle.xapk', 'PK-XAPK-BYTES');
  const xapkZip = await zipX.generateAsync({ type: 'nodebuffer' });

  const zipA = new JSZip();
  zipA.file('app-release.aab', 'PK-AAB-BYTES');
  const aabZip = await zipA.generateAsync({ type: 'nodebuffer' });
  const ZIPS = { 11: xapkZip, 12: apkZip, 13: aabZip };
  const artifacts = [
    { id: 11, name: 'inteebuild-abc123-xapk', size_in_bytes: 10 },
    { id: 12, name: 'inteebuild-abc123-apk', size_in_bytes: 20 },
    { id: 13, name: 'inteebuild-abc123-release-aab', size_in_bytes: 30 }
  ];
  const fakeGh = {
    config: () => ({ ready: true, owner: 'o', repo: 'r', token: 't', defaultBranch: 'main' }),
    getArtifacts: async () => artifacts,
    downloadArtifact: async (owner, repo, id) => ({
      arrayBuffer: async () => {
        const buf = ZIPS[id];
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      }
    })
  };

  const ctx = {
    ...require(ROOT + '/server/deps'),
    ...store,
    ...buildEngine,
    ...urlGuard,
    ...analyzers,
    gh: fakeGh
  };

  const app = express();
  app.use(express.json());
  require(ROOT + '/server/routes/builds')(app, ctx);
  require(ROOT + '/server/routes/artifacts')(app, ctx);

  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;

  store.builds.set('abc123', {
    id: 'abc123', status: 'success', step: 'Build completado', appName: 'Mi App',
    outputType: 'apk', outputs: ['apk', 'xapk'], runId: 999, runUrl: 'u', apkUrl: 'a',
    artifacts: artifacts.map(a => ({ name: a.name, url: 'u', size: a.size_in_bytes })), error: null
  });
  store.builds.set('norun', { id: 'norun', status: 'queued', step: 'x', appName: 'A', outputs: ['apk'], runId: null, artifacts: null });

  console.log('GET /api/build/:id');
  let res = await fetch(base + '/api/build/abc123');
  let body = await res.json();
  check('status 200', res.status === 200, res.status);
  check('outputs echoed', JSON.stringify(body.outputs) === '["apk","xapk"]', body.outputs);
  check('formats from artifacts (suffix exacto)', JSON.stringify(body.formats) === '["xapk","apk","aab"]', body.formats);
  check('outputType kept', body.outputType === 'apk', body.outputType);

  res = await fetch(base + '/api/build/norun');
  body = await res.json();
  check('formats [] sin runId', JSON.stringify(body.formats) === '[]', body.formats);
  check('outputs [] si falta', JSON.stringify(body.outputs) === '["apk"]', body.outputs);

  res = await fetch(base + '/api/build/nope');
  check('404 desconocido', res.status === 404, res.status);

  console.log('GET /api/download/:id/:fmt');
  res = await fetch(base + '/api/download/abc123/apk');
  check('apk 200', res.status === 200, res.status);
  check('apk mime', res.headers.get('content-type') === 'application/vnd.android.package-archive', res.headers.get('content-type'));
  check('apk filename', /mi-app\.apk/.test(res.headers.get('content-disposition') || ''), res.headers.get('content-disposition'));
  check('apk body', Buffer.from(await res.arrayBuffer()).toString() === 'PK-APK-BYTES');

  res = await fetch(base + '/api/download/abc123/xapk');
  check('xapk 200 (no casado con apk)', res.status === 200, res.status);
  check('xapk body', Buffer.from(await res.arrayBuffer()).toString() === 'PK-XAPK-BYTES');

  res = await fetch(base + '/api/download/abc123/aab');
  check('aab por sufijo exacto (release-aab)', res.status === 200, res.status);
  check('aab body', Buffer.from(await res.arrayBuffer()).toString() === 'PK-AAB-BYTES');

  res = await fetch(base + '/api/download/abc123/zip');
  check('fmt desconocido 404', res.status === 404, res.status);
  body = await res.json();
  check('mensaje de formato claro', /Formato no disponible/.test(body.error) && /appimage/.test(body.error), body.error);

  res = await fetch(base + '/api/download/abc123/ipa');
  check('ipa 404 propio', res.status === 404 && (await res.json()).error.includes('firma iOS'), res.status);

  console.log('rutas legacy');
  res = await fetch(base + '/api/download/abc123');
  check('/:id = apk', res.status === 200 && Buffer.from(await res.arrayBuffer()).toString() === 'PK-APK-BYTES', res.status);

  fakeGh.getArtifacts = async () => [artifacts[1]];
  res = await fetch(base + '/api/download/abc123/aab');
  body = await res.json();
  check('aab sin artefacto -> 404 sin fallback', res.status === 404 && body.error === 'AAB no encontrado', [res.status, body.error]);

  fakeGh.getArtifacts = async () => [artifacts[0]];
  res = await fetch(base + '/api/download/abc123/apk');
  check('apk fallbackFirst -> sirve zip', res.status === 200 && /filename="Mi App\.apk\.zip"/.test(res.headers.get('content-disposition') || ''), res.headers.get('content-disposition'));
  fakeGh.getArtifacts = async () => artifacts;

  res = await fetch(base + '/api/download/norun/xapk');
  check('en progreso 404', res.status === 404 && (await res.json()).error.includes('progreso'), res.status);

  console.log('GET /api/apk-info/:id');
  res = await fetch(base + '/api/apk-info/abc123');
  body = await res.json();
  check('apk-info 200', res.status === 200, res.status);
  check('apk-info artefacto exacto', body.artifactName === 'inteebuild-abc123-apk', body.artifactName);
  check('apk-info tipos', JSON.stringify(body.artifacts.map(a => a.type)) === '["XAPK","APK","AAB"]', body.artifacts.map(a => a.type));
  check('apk-info links', JSON.stringify(body.artifacts.map(a => a.download)) === '["/api/download/abc123/xapk","/api/download/abc123","/api/download/abc123/aab"]', body.artifacts.map(a => a.download));

  console.log(failures ? 'FAILURES: ' + failures : 'ALL ROUTE SMOKES OK');
  if (server.closeAllConnections) server.closeAllConnections();
  server.close();
  process.exitCode = failures ? 1 : 0;
}

main().catch(e => { console.error(e); process.exit(1); });
