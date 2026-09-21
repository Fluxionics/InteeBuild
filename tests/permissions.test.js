'use strict';
// Suite Permission Engine: spec íntegro, manifest 1:1, batch runtime,
// background two-step, accesos especiales y audit honesto.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const g = require('../server/generator');

const BG = 'android.permission.ACCESS_BACKGROUND_LOCATION';
const MANAGE = 'android.permission.MANAGE_EXTERNAL_STORAGE';

test('spec: toda key con runtime tiene manifest no vacío', () => {
  for (const [k, s] of Object.entries(g.PERMISSION_SPEC)) {
    assert.ok(Array.isArray(s.manifest) && s.manifest.length > 0, k);
    assert.equal(typeof s.runtime, 'boolean', k);
  }
});

test('normalize: conserva todas las keys del spec', () => {
  const all = Object.keys(g.PERMISSION_SPEC);
  const cfg = g.normalizeConfig({ appName: 'Test Suite', url: 'https://example.com', permissions: Object.fromEntries(all.map(k => [k, true])) });
  const lost = all.filter(k => !cfg.permissions[k]);
  assert.deepEqual(lost, []);
});

test('manifest: cubre 1:1 todo el spec + features + NFC', () => {
  const all = Object.keys(g.PERMISSION_SPEC);
  const cfg = g.normalizeConfig({ appName: 'Test Suite', url: 'https://example.com', permissions: Object.fromEntries(all.map(k => [k, true])) });
  const files = g.generateFiles(cfg);
  const man = files['main-manifest.xml'];
  for (const k of all) {
    for (const m of g.PERMISSION_SPEC[k].manifest) {
      assert.ok(man.includes('android:name="' + m + '"'), k + ':' + m);
    }
  }
  assert.ok(man.includes('android.hardware.camera'));
  assert.ok(man.includes('TECH_DISCOVERED'));
  assert.ok(files['res/xml/nfc_tech_filter.xml']);
});

test('batch runtime: data-driven, sin background ni manage-storage', () => {
  const cfg = g.normalizeConfig({ appName: 'Test Suite', url: 'https://example.com', permissions: { cameraMic: true, gps: true, gpsBackground: true, manageExternalStorage: true, bluetoothScan: true } });
  const files = g.generateFiles(cfg);
  const java = files['NativePermissions.java'];
  assert.ok(java, 'existe NativePermissions.java');
  assert.ok(java.includes('Manifest.permission.CAMERA'));
  assert.ok(java.includes('Manifest.permission.BLUETOOTH_SCAN'));
  const batchBlock = java.slice(java.indexOf('BATCH = {'), java.indexOf('};', java.indexOf('BATCH = {')));
  assert.ok(!batchBlock.includes('BACKGROUND_LOCATION'), 'background fuera del batch');
  assert.ok(!batchBlock.includes('MANAGE_EXTERNAL_STORAGE'), 'manage fuera del batch');
  assert.ok(java.includes('requestBackground'), 'two-step presente');
});

test('special: solo se genera lo pedido', () => {
  const cfg = g.normalizeConfig({ appName: 'Test Suite', url: 'https://example.com', permissions: { systemAlertWindow: true } });
  const files = g.generateFiles(cfg);
  assert.ok(files['SpecialAccess.java']);
  assert.ok(files['SpecialAccess.java'].includes('canDrawOverlays'));
  assert.ok(!files['SpecialAccess.java'].includes('NEED_MANAGE = true'));
  const cfg2 = g.normalizeConfig({ appName: 'Test Suite', url: 'https://example.com', permissions: { cameraMic: true } });
  assert.ok(!g.generateFiles(cfg2)['SpecialAccess.java']);
});

test('audit: GENERATED vs SPEC ONLY honesto', () => {
  const cfg = g.normalizeConfig({ appName: 'Test Suite', url: 'https://example.com', permissions: { cameraMic: true, gpsBackground: true } });
  const audit = g.getPermissionAudit(cfg);
  const cam = audit.items.find(i => i.key === 'cameraMic');
  assert.equal(cam.status, 'ok');
  assert.ok(cam.native.startsWith('GENERATED'));
  const bg = audit.items.find(i => i.key === 'gpsBackground');
  assert.equal(bg.status, 'fail', 'background sin gps es fail');
  const cfgAds = g.normalizeConfig({ appName: 'Test Suite', url: 'https://example.com', permissions: { ads: true } });
  const auditAds = g.getPermissionAudit(cfgAds);
  assert.equal(auditAds.items[0].status, 'fail', 'ads sin SDK bloquea');
  assert.equal(auditAds.canBuild, false);
});

test('grant WebView: selectivo, deny por defecto', () => {
  const cfg = g.normalizeConfig({ appName: 'Test Suite', url: 'https://example.com', permissions: { cameraMic: true } });
  const files = g.generateFiles(cfg);
  assert.ok(files['patch-permissions.js'].includes('request.deny()'));
  assert.ok(!files['patch-permissions.js'].includes('request.grant(request.getResources())'));
});
