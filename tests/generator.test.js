'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const g = require('../server/generator');
const t = require('../server/templates');

test('mínimo: solo INTERNET, sin java extra', () => {
  const cfg = g.normalizeConfig({ appName: 'Minima Test', url: 'https://example.com', permissions: {} });
  const files = g.generateFiles(cfg);
  assert.ok(!files['NativePermissions.java']);
  assert.ok(!files['RadioService.java']);
  assert.ok(files['main-manifest.xml'].includes('android.permission.INTERNET'));
});

test('plantillas: las 29 verifican canBuild', () => {
  for (const { id, name } of t.listTemplates()) {
    const safe = 'Tpl ' + name.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 20);
    const cfg = g.normalizeConfig({ appName: safe, url: 'https://example.com', ...t.getTemplate(id).config });
    const audit = g.getPermissionAudit(cfg);
    assert.equal(audit.canBuild, true, id);
    g.generateFiles(cfg);
  }
});

test('plantilla lab trae cara de pruebas', () => {
  const lab = t.getTemplate('lab');
  assert.ok(lab && lab.faceHtml.includes('runLab'));
});

test('providers capacitor/native generan MainActivity válido', () => {
  const cap = g.normalizeConfig({ appName: 'Prov Test', url: 'https://example.com', provider: 'capacitor', permissions: { gps: true } });
  const fcap = g.generateFiles(cap);
  assert.ok(fcap['provider.json'].includes('capacitor'));
  assert.ok(fcap['main-manifest.xml'].includes('com.getcapacitor.BridgeActivity'));
  const nat = g.normalizeConfig({ appName: 'Prov Test', url: 'https://example.com', provider: 'native', permissions: { gps: true } });
  const fnat = g.generateFiles(nat);
  assert.ok(fnat['provider.json'].includes('native'));
  assert.ok(fnat['main-manifest.xml'].includes('android:name=".MainActivity"'));
  assert.ok(fnat['native-MainActivity.java'].includes('NativePermissions.requestAll'));
});

test('PWA gratis siempre incluida (salvo opt-out)', () => {
  const cfg = g.normalizeConfig({ appName: 'Pwa Test', url: 'https://example.com', permissions: {} });
  const files = g.generateFiles(cfg);
  assert.ok(files['www/manifest.webmanifest']);
  assert.ok(files['www/sw.js']);
  assert.ok(files['www/index.html'].includes('manifest.webmanifest'));
  const cfg2 = g.normalizeConfig({ appName: 'Pwa Test', url: 'https://example.com', pwaEnabled: false });
  assert.ok(!g.generateFiles(cfg2)['www/sw.js']);
});

test('listing Play Store', () => {
  const cfg = g.normalizeConfig({ appName: 'Radio Test', url: 'https://example.com', packageName: 'com.test.radio', permissions: { foreground: true } });
  const listing = g.buildPlayListing(cfg);
  assert.ok(listing.title.length > 0 && listing.title.length <= 30);
  assert.ok(listing.fullDescription.includes('foreground'));
});

test('workflow de descompilacion: YAML valido, jadx + apktool', () => {
  const yaml = require('js-yaml');
  const src = require('../server/generator/workflow');
  const doc = yaml.load(src.DECOMPILE_WORKFLOW_YML);
  assert.equal(doc.name, 'decompile-app');
  const wd = doc.on && (doc.on.workflow_dispatch || doc.on['workflow_dispatch']);
  assert.ok(wd && wd.inputs && wd.inputs.id && wd.inputs.id.required === true);
  const steps = doc.jobs.decompile.steps.map((s) => [s.name || '', s.run || '', s.uses || '', JSON.stringify(s.with || {})].join(' '));
  const all = steps.join('\n');
  assert.ok(all.includes('jadx'), 'jadx instalado');
  assert.ok(all.includes('apktool'), 'apktool instalado');
  assert.ok(all.includes('upload-artifact'), 'artefacto subido');
  assert.ok(!/\\\$\{/.test(src.DECOMPILE_WORKFLOW_YML), 'sin backslashes escapados en el YAML');
  assert.ok(src.DECOMPILE_WORKFLOW_YML.includes('${{ github.event.inputs.id }}'), 'expresiones GH intactas');
  assert.ok(g.DECOMPILE_WORKFLOW_YML === src.DECOMPILE_WORKFLOW_YML, 'exportado por generator');
});

test('github: helpers de decompilation en la nube exportados', () => {
  const gh = require('../server/github');
  for (const fn of ['syncWorkflow', 'pushProject', 'dispatchDecompile', 'findRunForBranch', 'downloadArtifact', 'deleteBranchSoon']) {
    assert.equal(typeof gh[fn], 'function', fn);
  }
});
