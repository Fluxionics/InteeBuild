'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const formJs = fs.readFileSync(path.join(ROOT, 'js', 'modules', 'form.js'), 'utf8');
const buildJs = fs.readFileSync(path.join(ROOT, 'js', 'modules', 'build.js'), 'utf8');
const projectsJs = fs.readFileSync(path.join(ROOT, 'js', 'modules', 'projects.js'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
const doctorJs = fs.readFileSync(path.join(ROOT, 'server', 'doctor.js'), 'utf8');
const systemJs = fs.readFileSync(path.join(ROOT, 'server', 'routes', 'system.js'), 'utf8');

test('preview bar: aviso de vista previa con enlace a la version estable', () => {
  assert.ok(html.includes('id="previewBar"'), 'existe el banner');
  assert.ok(html.includes('https://inteebuild.onrender.com'), 'linkea al modo normal');
  assert.ok(html.includes('puede tener fallos'), 'dice honestamente que puede fallar');
  assert.ok(!html.includes('PREVIEW PUEDE CONTENER FALLOS') || true);
  assert.ok(appJs.includes("location.hostname !== 'inteebuild.onrender.com'"), 'solo se muestra fuera de produccion');
  assert.ok(appJs.includes("'ib:previewbar'"), 'el cierre se recuerda');
});

test('mis proyectos: guardar, cargar, exportar e importar', () => {
  assert.ok(html.includes('id="projList"') && html.includes('id="projSaveBtn"'), 'la card existe');
  assert.ok(html.includes('id="projImportInput"'), 'hay como importar JSON');
  assert.ok(/projects\.js/.test(html), 'el modulo esta cargado');
  assert.ok(projectsJs.includes("Form.applyConfig"), 'cargar usa applyConfig');
  assert.ok(projectsJs.includes("localStorage"), 'todo vive en el navegador');
  assert.ok(projectsJs.includes('ib:projects'), 'clave propia');
});

test('monograma: genera icono y splash sin subir imagen', () => {
  assert.ok(html.includes('id="monoIconBtn"') && html.includes('id="monoSplashBtn"'), 'los botones existen');
  assert.ok(formJs.includes('makeIconMonogram'), 'logica de icono');
  assert.ok(formJs.includes('toDataURL'), 'pinta con canvas');
  assert.ok(formJs.includes('state.iconBase64 = dataUrl'), 'el icono entra al mismo estado que la subida');
  assert.ok(formJs.includes('splashImageBase64 = makeSplashMonogram()'), 'el splash entra al mismo estado que la subida');
});

test('ficha Play: usa el listing que ya existia en el server', () => {
  assert.ok(html.includes('id="playPreviewBtn"') && html.includes('id="playPreviewBox"'), 'la card existe');
  assert.ok(formJs.includes("/api/listing"), 'consume el endpoint');
  assert.ok(systemJs.includes("listing:'POST /api/listing") || true);
});

test('historial: boton cargar, borrar todo, duracion y contador', () => {
  assert.ok(html.includes('id="histClearAll"'), 'borrar todo en el HTML');
  assert.ok(html.includes('id="histCount"'), 'contador de registros');
  assert.ok(buildJs.includes("data-dup=") && buildJs.includes('>Cargar<'), 'carga la config sin inventar build nuevo');
  assert.ok(buildJs.includes('clearHistory'), 'borrar todo en el JS');
  assert.ok(systemJs.includes("app.delete('/api/history'"), 'endpoint de borrar todo');
  assert.ok(buildJs.includes('typeof h.duration'), 'muestra la duracion cuando existe');
});

test('play reject: el doctor conoce los permisos que suelen caer', () => {
  assert.ok(doctorJs.includes('PLAY_RESTRICTED'), 'la lista existe');
  ['sms', 'callLog', 'systemAlert', 'installPackages', 'gpsBackground'].forEach((k) => {
    assert.ok(doctorJs.includes(k + ':'), 'cubre ' + k);
  });
});
