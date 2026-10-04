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
  assert.ok(!files['AudioBridge.java']);
  assert.ok(files['main-manifest.xml'].includes('android.permission.INTERNET'));
});

test('foreground: servicio completo, puente y WAKE_LOCK', () => {
  const cfg = g.normalizeConfig({ appName: 'Fg Test', url: 'https://example.com', packageName: 'com.test.fg', permissions: { foreground: true } });
  const files = g.generateFiles(cfg);
  assert.ok(files['RadioService.java'].includes('PARTIAL_WAKE_LOCK'));
  assert.ok(files['RadioService.java'].includes('WIFI_MODE_FULL_HIGH_PERF'));
  assert.ok(files['RadioService.java'].includes('if (need && !wifiLock.isHeld()) wifiLock.acquire();'));
  assert.ok(files['RadioService.java'].includes('ACTION_KEEP'));
  assert.ok(files['RadioService.java'].includes('MediaSession'));
  assert.ok(files['AudioBridge.java'].includes('keepAwake'));
  assert.ok(files['patch-audio.js'].includes('BridgeActivity'));
  assert.ok(files['main-manifest.xml'].includes('android.permission.WAKE_LOCK'));
  assert.ok(String(files['www/catalog.js']).includes('__ibFg'));
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

test('native y gecko hornean DownloadManager y file chooser', () => {
  const fnat = g.generateFiles(g.normalizeConfig({ appName: 'Dl Test', url: 'https://example.com', provider: 'native', permissions: {}, downloadManager: true }));
  const j = fnat['native-MainActivity.java'];
  assert.ok(j.includes('setDownloadListener'));
  assert.ok(j.includes('DownloadManager.Request'));
  assert.ok(j.includes('onShowFileChooser'));
  assert.ok(j.includes('ValueCallback<Uri[]>'));
  assert.ok(j.includes('onActivityResult'));
  const fgek = g.generateFiles(g.normalizeConfig({ appName: 'Dl Test', url: 'https://example.com', provider: 'gecko', permissions: {}, downloadManager: true }));
  const k = fgek['gecko-MainActivity.java'];
  assert.ok(k.includes('onFilePrompt'));
  assert.ok(k.includes('setPromptDelegate'));
  assert.ok(k.includes('onExternalResponse'));
  assert.ok(k.includes('DownloadManager.Request'));
  assert.ok(k.includes('FilePrompt'));
  const foff = g.generateFiles(g.normalizeConfig({ appName: 'Dl Off', url: 'https://example.com', provider: 'native', permissions: {}, downloadManager: false }));
  assert.ok(!foff['native-MainActivity.java'].includes('setDownloadListener'));
});

test('cordova: config.xml real con prefs de SDK y job cordova-build', () => {
  const cfg = g.normalizeConfig({ appName: 'Cordova Test', url: 'https://example.com', provider: 'cordova', permissions: {} });
  const f = g.generateFiles(cfg);
  const xml = f['config.xml'];
  assert.ok(xml.includes('android-minSdkVersion" value="' + cfg.minSdk));
  assert.ok(xml.includes('android-targetSdkVersion'));
  assert.ok(xml.includes('android-compileSdkVersion'));
  assert.ok(xml.includes('<content src="'));
  assert.ok(xml.includes('example.com'));
  assert.ok(f['provider.json'].includes('cordova'));
  assert.ok(g.WORKFLOW_YML.includes('cordova-build:'));
  assert.ok(g.WORKFLOW_YML.includes("provider != 'cordova'"));
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

test('workflow principal: YAML valido y build-config leido sin escapes rotos', () => {
  const yaml = require('js-yaml');
  const src = require('../server/generator/workflow');
  const doc = yaml.load(src.WORKFLOW_YML);
  assert.ok(doc.jobs, 'jobs presentes');
  const steps = Object.values(doc.jobs)[0].steps;
  const read = steps.find((s) => s.name === 'Read build config');
  assert.ok(read, 'paso Read build config');
  assert.ok(!read.run.includes('\\"'), 'sin backslash escapado dentro de node -p');
  const envKeys = { compileSdk: 'COMPILE_SDK', targetSdk: 'TARGET_SDK', minSdk: 'MIN_SDK' };
  for (const [key, env] of Object.entries(envKeys)) {
    assert.ok(read.run.includes(`node -p 'require("./build-config.json").${key}'`), `lee ${key}`);
    assert.ok(read.run.includes(`${env}=$(node -p`), `exporta ${env}`);
  }
});

test('twa: emite generate-twa.js no interactivo y el workflow no usa init', () => {
  const files = g.generateFiles(g.normalizeConfig({ appName: 'Twa Test', url: 'https://example.com', provider: 'twa', permissions: {} }));
  const src = files['generate-twa.js'];
  assert.ok(src, 'generate-twa.js emitido');
  assert.ok(src.includes('createTwaProject'), 'genera el proyecto con TwaGenerator');
  assert.ok(src.includes('manifest-checksum.txt'), 'escribe checksum para evitar el prompt de update en build');
  assert.ok(src.includes('BUBBLEWRAP_KEYSTORE_PASSWORD'), 'exporta contrasenas via GITHUB_ENV');
  assert.ok(src.includes('process.exit(0)'), 'el servidor de iconos no deja el proceso colgado');
  const wf = require('../server/generator/workflow').WORKFLOW_YML;
  assert.ok(!wf.includes('bubblewrap init'), 'sin init interactiva');
  assert.ok(!wf.includes('bubblewrap sign'), 'sin comando sign inexistente');
  assert.ok(wf.includes('node generate-twa.js'), 'workflow corre generate-twa.js');
  assert.ok(wf.includes('twa-project/app-release-signed.apk'), 'sube el APK firmado de bubblewrap build');
});

test('gecko: geckoview usa version publicada en maven.mozilla.org', () => {
  const providers = require('../server/generator/providers');
  const wf = require('../server/generator/workflow').WORKFLOW_YML;
  const dep = 'geckoview:120.0.20231208211905';
  assert.ok(wf.includes(dep), 'job gecko-build fija la version verificada (POM/AAR 200, minSdk 21)');
  assert.ok(!wf.includes('20240514094915'), 'eliminada la version inexistente que daba 404');
  assert.ok(providers.geckoGradlePatchSrc().includes(dep), 'el patch del flujo compile usa la misma version');
  assert.ok(!providers.geckoGradlePatchSrc().includes('156.0'), 'sin la 156 que exige minSdk 26');
});

test('build-config.json incluye provider para la eleccion de provider en CI', () => {
  const cfg = g.normalizeConfig({ appName: 'Provider Test', url: 'https://example.com', provider: 'native' });
  const bc = JSON.parse(g.generateFiles(cfg)['build-config.json']);
  assert.equal(bc.provider, 'native');
  assert.equal(bc.compileSdk, cfg.compileSdk);
  assert.equal(bc.targetSdk, cfg.targetSdk);
  assert.equal(bc.minSdk, cfg.minSdk);
});

test('platform ios/both instala @capacitor/ios para que cap add ios no falle', () => {
  const { packageFiles } = require('../server/generator/package-files');
  const deps = (p) => JSON.parse(packageFiles(g.normalizeConfig({ appName: 'Plat Test', url: 'https://example.com', platform: p }))['package.json']).dependencies;
  assert.ok(deps('ios')['@capacitor/ios'], 'ios incluye @capacitor/ios');
  assert.ok(deps('both')['@capacitor/ios'], 'both incluye @capacitor/ios');
  assert.ok(!deps('android')['@capacitor/ios'], 'android no arrastra @capacitor/ios');
});

test('outputs de escritorio (exe/msi/dmg/appimage) generan el proyecto desktop', () => {
  const cfg = g.normalizeConfig({ appName: 'Desk Test', url: 'https://example.com', outputs: ['dmg', 'exe', 'msi', 'appimage'] });
  assert.equal(cfg.desktopEnabled, true, 'desktopEnabled autoactivado por los outputs');
  const files = g.generateFiles(cfg);
  assert.ok(files['desktop/package.json'], 'desktop/package.json presente');
  assert.ok(files['desktop/main.js'], 'desktop/main.js presente');
  const pkg = JSON.parse(files['desktop/package.json']);
  assert.ok(pkg.build.mac && pkg.build.win && pkg.build.linux, 'targets win/mac/linux configurados');

  const plain = g.normalizeConfig({ appName: 'Plain Test', url: 'https://example.com', outputs: ['apk'] });
  assert.equal(plain.desktopEnabled, false, 'apk solo no activa desktop');
  assert.ok(!g.generateFiles(plain)['desktop/package.json'], 'sin desktop si no se pide');
});
