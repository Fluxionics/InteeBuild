'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { DEFAULT_LIMITS, loadZipGuarded, entryText, entryBuffer } = require('../server/zip-guard');

async function makeZip(files) {
  const zip = new JSZip();
  Object.entries(files).forEach(([name, content]) => zip.file(name, content));
  return zip.generateAsync({ type: 'nodebuffer' });
}

test('zip-guard: un ZIP normal pasa con los limites por defecto', async () => {
  const buf = await makeZip({
    'www/index.html': '<html><a href="https://demo.test">x</a></html>',
    'build-config.json': '{"packageName":"com.demo.app"}',
    'AndroidManifest.xml': '<manifest package="com.demo.app"></manifest>'
  });
  const r = await loadZipGuarded(buf);
  assert.equal(r.ok, true);
  assert.equal(r.error, null);
  assert.equal(r.unknownSize, false);
  assert.equal(r.entries, Object.keys(r.zip.files).length);
  assert.ok(r.entries >= 3);
  assert.ok(r.totalUncompressed > 0 && r.totalUncompressed <= DEFAULT_LIMITS.maxTotalUncompressed);
  assert.ok(r.zip.files['www/index.html']);
});

test('zip-guard: un buffer que no es ZIP devuelve error 400 en espanol', async () => {
  const r = await loadZipGuarded(Buffer.from('esto no es un zip'));
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
  assert.equal(r.error, 'Archivo no es ZIP válido');
  assert.equal(r.zip, null);
});

test('zip-guard: entrada por encima de maxEntryUncompressed se rechaza', async () => {
  const buf = await makeZip({ 'grande.txt': 'x'.repeat(500) });
  const r = await loadZipGuarded(buf, { maxEntryUncompressed: 100 });
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
  assert.equal(r.error, 'ZIP rechazado: entrada demasiado grande');
});

test('zip-guard: la suma por encima de maxTotalUncompressed se rechaza', async () => {
  const buf = await makeZip({ 'a.txt': 'x'.repeat(400), 'b.txt': 'y'.repeat(400) });
  const r = await loadZipGuarded(buf, { maxEntryUncompressed: 500, maxTotalUncompressed: 600 });
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
  assert.equal(r.error, 'ZIP rechazado: contenido descomprimido demasiado grande');
});

test('zip-guard: demasiadas entradas se rechaza con un limite pequeno', async () => {
  const files = {};
  for (let i = 0; i < 1000; i++) files['f' + i + '.txt'] = 'a';
  const buf = await makeZip(files);
  const freeRun = await loadZipGuarded(buf);
  assert.equal(freeRun.ok, true, 'con limites por defecto las 1000 entradas pasan');
  const r = await loadZipGuarded(buf, { maxEntries: 100 });
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
  assert.equal(r.error, 'ZIP rechazado: demasiadas entradas (max 100)');
});

test('zip-guard: las carpetas no marcan unknownSize', async () => {
  const zip = new JSZip();
  zip.file('a.txt', 'hola');
  zip.folder('sub');
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  const r = await loadZipGuarded(buf);
  assert.equal(r.ok, true);
  assert.equal(r.entries, 2);
  assert.equal(r.unknownSize, false);
});

test('zip-guard: entryText devuelve el texto si entra en el limite', async () => {
  const html = '<html><a href="https://demo.test">ok</a></html>';
  const buf = await makeZip({ 'www/index.html': html });
  const r = await loadZipGuarded(buf);
  const text = await entryText(r.zip.files['www/index.html']);
  assert.equal(text, html);
});

test('zip-guard: entryText devuelve null si supera maxBytes', async () => {
  const buf = await makeZip({ 'grande.html': 'a'.repeat(200) });
  const r = await loadZipGuarded(buf);
  assert.equal(await entryText(r.zip.files['grande.html'], 100), null);
  assert.equal((await entryText(r.zip.files['grande.html'], 1000)).length, 200);
  assert.equal(await entryText(undefined), null);
});

test('zip-guard: entryBuffer devuelve null si supera maxBytes', async () => {
  const buf = await makeZip({ 'icon.png': Buffer.alloc(600, 7) });
  const r = await loadZipGuarded(buf);
  assert.equal(await entryBuffer(r.zip.files['icon.png'], 512), null);
  const icon = await entryBuffer(r.zip.files['icon.png'], 1024);
  assert.ok(Buffer.isBuffer(icon));
  assert.equal(icon.length, 600);
  assert.equal(await entryBuffer(undefined), null);
});

test('zip-guard: decompile e inspect cargan el ZIP a traves del guard', () => {
  const decompileSrc = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'decompile.js'), 'utf8');
  const catalogSrc = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'catalog.js'), 'utf8');
  assert.match(decompileSrc, /loadZipGuarded\(buf\)/);
  assert.ok(!decompileSrc.includes('JSZip.loadAsync'), 'decompile ya no parsea ZIP sin guard');
  assert.match(catalogSrc, /loadZipGuarded\(buf\)/);
  assert.ok(!catalogSrc.includes('JSZip.loadAsync'), 'inspect ya no parsea ZIP sin guard');
});
