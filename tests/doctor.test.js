'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const g = require('../server/generator');
const { runDoctor } = require('../server/doctor');

const GOOD_HTML = '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body><p>ok</p></body></html>';

test('doctor: html sin doctype bloquea con error', () => {
  const cfg = g.normalizeConfig({ appName: 'Doc', inputType: 'html', htmlCode: '<div>hola</div>' });
  const d = runDoctor(cfg, { audit: g.getPermissionAudit(cfg), html: '<div>hola</div>' });
  const doctype = d.checks.find(c => c.label.includes('DOCTYPE'));
  assert.equal(doctype.status, 'error');
  assert.equal(d.canBuild, false, 'error de HTML impide compilar');
  assert.ok(d.score >= 0 && d.score <= 100);
});

test('doctor: config valida y html bueno pasa con cero errores', () => {
  const cfg = g.normalizeConfig({ appName: 'Doc Buena', url: 'https://example.com', packageName: 'com.doc.buena', appVersion: '1.2.3', permissions: { gps: true } });
  const d = runDoctor(cfg, {
    audit: g.getPermissionAudit(cfg),
    html: GOOD_HTML,
    detectedApis: ['geolocation'],
    security: { score: 95, issues: [] },
    errors: { errors: [], warnings: [] },
    suggest: g.suggestPermissionsFromApis(['geolocation'])
  });
  assert.equal(d.canBuild, true, JSON.stringify(d.checks.filter(c => c.status === 'error')));
  assert.equal(d.errors, 0);
  const pkg = d.checks.find(c => c.label.includes('packageName'));
  assert.equal(pkg.status, 'ok');
});

test('doctor: packageName malo y API detectada sin permiso avisan o bloquean', () => {
  const cfg = g.normalizeConfig({ appName: 'Doc Pkg', url: 'https://example.com', packageName: 'com.doc.pkg', permissions: {} });
  const d = runDoctor({ ...cfg, packageName: 'Paquete Malo' }, {
    audit: g.getPermissionAudit(cfg),
    html: GOOD_HTML,
    detectedApis: ['bluetooth'],
    suggest: g.suggestPermissionsFromApis(['bluetooth'])
  });
  const pkg = d.checks.find(c => c.label.includes('packageName'));
  assert.equal(pkg.status, 'error', 'packageName con mayusculas y espacios no pasa');
  const missing = d.checks.find(c => c.label.includes('API detectada sin permiso'));
  assert.ok(missing, 'la API detectada sin permiso debe aparecer');
  assert.equal(d.canBuild, false);
});

test('doctor: sin fuente web el error es claro', () => {
  const cfg = g.normalizeConfig({ appName: 'Doc Sin Fuente', url: 'https://example.com' });
  const d = runDoctor(cfg, { audit: g.getPermissionAudit(cfg) });
  const fuente = d.checks.find(c => c.label.includes('Fuente web'));
  assert.equal(fuente.status, 'ok', 'con URL presente la fuente esta lista');
  const d2 = runDoctor({ ...cfg, url: '' }, { audit: g.getPermissionAudit(cfg) });
  assert.equal(d2.checks.find(c => c.label.includes('Falta la URL')).status, 'error');
  assert.equal(d2.canBuild, false);
});

test('doctor: permisos fallidos y avisos de rango se reflejan en los checks', () => {
  const cfg = g.normalizeConfig({ appName: 'Doc Rangos', url: 'https://example.com', minSdk: 23, permissions: { gpsBackground: true, nearby: true } });
  const d = runDoctor(cfg, { audit: g.getPermissionAudit(cfg) });
  const fails = d.checks.find(c => c.status === 'error' && c.label.includes('sin generar'));
  assert.ok(fails, 'gpsBackground sin gps es fail');
  const rango = d.checks.find(c => c.label.includes('Rango de Android'));
  assert.ok(rango && rango.status === 'warn');
  assert.equal(d.canBuild, false);
});
