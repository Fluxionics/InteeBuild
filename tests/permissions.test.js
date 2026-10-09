'use strict';


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
  assert.ok(files['patch-nfc.js'], 'emite patch-nfc.js con NFC');
  const patch = files['patch-nfc.js'];
  assert.ok(patch.includes("isNdefPushEnabled"), 'parchea isNdefPushEnabled');
  assert.ok(patch.includes("setNdefPushMessage"), 'parchea setNdefPushMessage');
  assert.ok(patch.includes("setBeamPushUris"), 'parchea setBeamPushUris');
  assert.ok(patch.includes("setOnNdefPushCompleteCallback"), 'parchea setOnNdefPushCompleteCallback');
});

test('nfc: sin NFC no emite patch-nfc.js', () => {
  const cfg = g.normalizeConfig({ appName: 'Test Suite', url: 'https://example.com', permissions: { cameraMic: true } });
  const files = g.generateFiles(cfg);
  assert.ok(!files['patch-nfc.js'], 'sin NFC no hay patch');
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

test('audit droncito: 15 esenciales sin fails y provider READY', () => {
  const cfg = g.normalizeConfig({ appName: 'Dron Test', url: 'https://example.com', provider: 'droncito' });
  const audit = g.getPermissionAudit(cfg);
  assert.equal(audit.total, 15, 'solo esenciales Play-safe por defecto');
  assert.equal(audit.canBuild, true);
  assert.equal(audit.verifiedAll, true);
  assert.ok(!audit.items.some(i => i.key === 'ar'), 'las features pesadas no vienen ON');
  assert.ok(!audit.items.some(i => i.key === 'ads'), 'los defaults nunca encienden ads');
  const cfgAr = g.normalizeConfig({ appName: 'Dron Test', url: 'https://example.com', provider: 'droncito', permissions: { ar: true } });
  const auditAr = g.getPermissionAudit(cfgAr);
  const ar = auditAr.items.find(i => i.key === 'ar');
  assert.ok(ar && ar.provider.startsWith('OK (droncito)'), ar && ar.provider);
  assert.equal(auditAr.canBuild, true, 'AR explicito sigue compilandose');
});

test('grant WebView: Capacitor ya concede camara/mic, el parche no sustituye su WebChromeClient', () => {
  const cfg = g.normalizeConfig({ appName: 'Test Suite', url: 'https://example.com', permissions: { cameraMic: true } });
  const files = g.generateFiles(cfg);
  assert.ok(!files['patch-permissions.js'].includes('onPermissionRequest'), 'BridgeWebChromeClient de Capacitor ya maneja onPermissionRequest; reemplazarlo romperia el file chooser');
  assert.ok(!files['patch-permissions.js'].includes('request.grant(request.getResources())'), 'sin grant-all');
  const nat = g.generateFiles(g.normalizeConfig({ appName: 'Test Suite', url: 'https://example.com', provider: 'native', permissions: { cameraMic: true } }));
  assert.ok(nat['native-MainActivity.java'].includes('onPermissionRequest'), 'el provider native si trae su propio grant selectivo');
  assert.ok(nat['native-MainActivity.java'].includes('r.deny()'), 'native niega por defecto');
  const mj = nat['native-MainActivity.java'];
  assert.ok(mj.includes('x.contains("VIDEO")') && mj.includes('ok.add(x)'), 'el grant compara el recurso x, no el PermissionRequest r');
  assert.ok(!mj.includes('ok.add(r)'), 'nunca mete r (PermissionRequest) a la lista de String');
  assert.ok(!mj.includes('r.contains('), 'PermissionRequest no tiene contains');
});
