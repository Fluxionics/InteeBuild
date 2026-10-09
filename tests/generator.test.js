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

test('provider droncito: shell nativo + DroncitoPack + 85 permisos por defecto', () => {
  const cfg = g.normalizeConfig({ appName: 'Dron Test', url: 'https://example.com', provider: 'droncito' });
  assert.equal(cfg.provider, 'droncito');
  assert.equal(Object.values(cfg.permissions).filter(Boolean).length, 85, 'todos los defaults menos ads');
  assert.equal(cfg.permissions.ads, false, 'ads se queda fuera: requiere AdMob App ID');
  assert.equal(cfg.permissions.ar, true);
  assert.equal(cfg.permissions.iot, true);
  assert.equal(cfg.plugins.inteebridge, true, 'InteeBridge activo por defecto');
  assert.equal(cfg.plugins.ar, true, 'los permisos del pack encienden sus plugins');
  const f = g.generateFiles(cfg);
  assert.ok(f['provider.json'].includes('droncito'));
  assert.ok(f['provider.json'].includes('Droncito Compiler'));
  assert.ok(f['native-MainActivity.java'], 'trae la MainActivity nativa');
  assert.ok(f['DroncitoBridge.java'], 'trae el puente del pack');
  const br = f['DroncitoBridge.java'];
  assert.ok(br.includes('ArCoreApk.Availability'), 'checkAvailability devuelve Availability, no int');
  assert.ok(br.includes('startsWith("AVAILABLE")'), 'available se deriva del nombre del enum');
  assert.ok(!br.includes('int v = com.google.ar'), 'sin cast int obsoleto');
  assert.ok(f['patch-droncito-native.js']);
  assert.ok(f['patch-droncito-gradle.js']);
  assert.ok(f['main-manifest.xml'].includes('android:name=".MainActivity"'));
  assert.ok(g.WORKFLOW_YML.includes('[ "$PROVIDER" = "droncito" ]'), 'el workflow copia la MainActivity nativa para droncito');
  assert.ok(f['.github/workflows/build-app.yml'].includes('DroncitoBridge.java'), 'el CI instala el pack');
  assert.equal(g.getPermissionAudit(cfg).canBuild, true, 'los defaults de droncito compilan');
  const invalid = g.normalizeConfig({ appName: 'Dron Test', url: 'https://example.com', provider: 'nope' });
  assert.equal(invalid.provider, 'capacitor', 'provider desconocido sigue cayendo a capacitor');
});

test('native y gecko hornean DownloadManager y file chooser', () => {
  const fnat = g.generateFiles(g.normalizeConfig({ appName: 'Dl Test', url: 'https://example.com', provider: 'native', permissions: {}, downloadManager: true }));
  const j = fnat['native-MainActivity.java'];
  assert.ok(j.includes('setDownloadListener'));
  assert.ok(j.includes('DownloadManager.Request'));
  assert.ok(j.includes('onShowFileChooser'));
  assert.ok(j.includes('getMode()==WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE'), 'multiple por getMode: allowMultiple() no existe en FileChooserParams');
  assert.ok(!j.includes('allowMultiple()'), 'sin allowMultiple() que no compila');
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
  const twaJob = /twa-build:\n([\s\S]*?)(?=\n  [a-z][\w-]*:\n|$)/.exec(wf)[1];
  assert.ok(twaJob.includes("java-version: '17'"), 'bubblewrap exige JDK 17 literal en el release file');
  assert.ok(!twaJob.includes("java-version: '21'"), 'sin JDK 21 en el job TWA');
  assert.ok(twaJob.includes('$ANDROID_HOME/bin/sdkmanager'), 'symlink bin/sdkmanager para validatePath de bubblewrap');
  assert.ok(twaJob.includes('platforms;android-'), 'instala la plataforma que pide el template');
});

test('gecko: geckoview usa version publicada en maven.mozilla.org', () => {
  const providers = require('../server/generator/providers');
  const wf = require('../server/generator/workflow').WORKFLOW_YML;
  const dep = 'geckoview:120.0.20231208211905';
  assert.ok(wf.includes(dep), 'job gecko-build fija la version verificada (POM/AAR 200, minSdk 21)');
  assert.ok(!wf.includes('20240514094915'), 'eliminada la version inexistente que daba 404');
  assert.ok(providers.geckoGradlePatchSrc().includes(dep), 'el patch del flujo compile usa la misma version');
  assert.ok(!providers.geckoGradlePatchSrc().includes('156.0'), 'sin la 156 que exige minSdk 26');
  assert.ok(wf.includes('geckoSession.open(geckoRuntime)'), 'API 120: new GeckoSession + open(runtime)');
  assert.ok(!wf.includes('openSession()'), 'sin openSession() que no existe en GV 120');
  assert.ok(wf.includes('geckoRuntime.shutdown()'), 'API 120: runtime.shutdown() en onDestroy');
  assert.ok(!wf.includes('geckoRuntime.close()'), 'sin close() en el runtime');
  assert.ok(wf.includes('onCanGoBack'), 'canGoBack via NavigationDelegate (default method de la 120)');
  assert.ok(!wf.includes('geckoSession.canGoBack()'), 'sin canGoBack() sincrono inexistente');
});

test('gecko: emite make-icons.js y el workflow lo corre (mipmap ic_launcher)', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { execFileSync } = require('child_process');
  const cfg = g.normalizeConfig({ appName: 'Icon Test', url: 'https://example.com', provider: 'gecko' });
  const files = g.generateFiles(cfg);
  const src = files['make-icons.js'];
  assert.ok(src, 'make-icons.js emitido para provider gecko');
  assert.ok(src.includes('mipmap-mdpi') && src.includes('mipmap-xxxhdpi'), '5 densidades');
  assert.ok(src.includes('ic_launcher.png'), 'escribe ic_launcher.png');
  const wf = require('../server/generator/workflow').WORKFLOW_YML;
  assert.ok(wf.includes('node make-icons.js gecko-project'), 'workflow ejecuta el script');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ib-icons-'));
  const prev = process.cwd();
  try {
    process.chdir(tmp);
    fs.writeFileSync('make-icons.js', src);
    execFileSync(process.execPath, ['make-icons.js', 'gecko-project'], { stdio: 'pipe' });
    const densities = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
    for (const d of densities) {
      const png = path.join(tmp, 'gecko-project', 'app', 'src', 'main', 'res', d, 'ic_launcher.png');
      assert.ok(fs.existsSync(png), d + '/ic_launcher.png existe');
      const head = fs.readFileSync(png).subarray(0, 4);
      assert.deepEqual(head, Buffer.from([0x89, 0x50, 0x4e, 0x47]), d + ' es PNG valido');
    }
    assert.ok(fs.existsSync(path.join(tmp, 'gecko-project', 'app', 'src', 'main', 'res', 'values', 'ic_launcher_background.xml')), 'color de fondo del icono presente');
  } finally {
    process.chdir(prev);
  }
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

test('workflow: cap add android respeta los archivos pre-generados (overlay)', () => {
  const { WORKFLOW_YML } = require('../server/generator/workflow');
  const adds = (WORKFLOW_YML.match(/npx cap add android/g) || []).length;
  const refs = (WORKFLOW_YML.match(/prebuilt-android/g) || []).length;
  assert.equal(adds, 4, 'los 4 jobs de android pasan por cap add');
  assert.equal(refs, 12, 'cada cap add hace backup y fusion (3 referencias)');
  assert.match(WORKFLOW_YML, /if \[ -d android \]; then cp -r android \/tmp\/prebuilt-android && rm -rf android; fi/, 'backup antes de cap add');
  assert.match(WORKFLOW_YML, /if \[ -d \/tmp\/prebuilt-android \]; then cp -r \/tmp\/prebuilt-android\/\. android\/; fi/, 'fusion despues de cap add');
});

test('tema: styles.xml propio pisa el de Capacitor (sin AppTheme duplicado)', () => {
  const cfg = g.normalizeConfig({ appName: 'Theme Test', url: 'https://example.com', outputs: ['apk'], themeColor: '#123456' });
  const files = g.generateFiles(cfg);
  const styles = files['android/app/src/main/res/values/styles.xml'];
  assert.ok(styles, 'emite styles.xml con el tema');
  assert.ok(!files['android/app/src/main/res/values/themes.xml'], 'no emite themes.xml aparte');
  assert.match(styles, /style name="AppTheme"/, 'AppTheme definido');
  assert.match(styles, /style name="AppTheme.NoActionBarLaunch"/, 'NoActionBarLaunch definido');
  assert.match(styles, /Theme\.AppCompat\.DayNight\.DarkActionBar/, 'parent AppCompat: la app solo incluye appcompat');
  assert.ok(!/splash_background/.test(styles), 'sin splash no referencia drawable/splash_background');
  assert.ok(cfg.themeColor, 'themeColor siempre tiene valor tras normalize -> styles.xml siempre pisa el de Capacitor');
  const conSplash = g.normalizeConfig({ appName: 'Splash Theme', url: 'https://example.com', outputs: ['apk'], themeColor: '#123456', splashEnabled: true, splashImageBase64: 'data:image/png;base64,aGVsbG8=' });
  const f2 = g.generateFiles(conSplash);
  assert.match(f2['android/app/src/main/res/values/styles.xml'], /splash_background/, 'con splash usa splash_background como fondo de lanzamiento');
  const custom = g.normalizeConfig({ appName: 'Color Test', url: 'https://example.com', outputs: ['apk'], accentColor: '#22d3a7' });
  const f3 = g.generateFiles(custom);
  assert.ok(f3['custom-colors.xml'], 'con acento personalizado sale custom-colors.xml');
  assert.match(f3['custom-colors.xml'], /name="theme_color"/, 'custom-colors conserva theme_color aunque el CI lo copie sobre colors.xml');
  assert.match(f3['custom-colors.xml'], /#22d3a7/, 'custom-colors lleva el acento');
});

test('modo URL: www/index.html es una pagina de arranque que redirige a la web', () => {
  const cfg = g.normalizeConfig({ appName: 'Boot Test', url: 'https://example.com/app?x=1', permissions: {} });
  const files = g.generateFiles(cfg);
  const html = String(files['www/index.html']);
  assert.ok(!html.includes('<body></body>'), 'sin placeholder vacio');
  assert.ok(html.includes('https://example.com/app?x=1'), 'la URL destino esta en la pagina');
  assert.ok(html.includes('location.replace('), 'redirige con location.replace');
  assert.ok(html.includes('http-equiv="refresh"'), 'fallback sin JS via meta refresh');
  assert.ok(html.includes('Reintentar'), 'estado de error con boton de reintento');
  assert.ok(html.includes('navigator.onLine'), 'detecta offline antes de navegar');
});

test('modo HTML: conserva el codigo del usuario tal cual', () => {
  const cfg = g.normalizeConfig({ appName: 'Html Boot', inputType: 'html', htmlCode: '<!DOCTYPE html><html><head><meta charset="UTF-8" /></head><body><h1>Hola</h1></body></html>', permissions: {} });
  const files = g.generateFiles(cfg);
  const html = String(files['www/index.html']);
  assert.ok(html.includes('<h1>Hola</h1>'), 'el HTML del usuario se empaqueta');
  assert.ok(!html.includes('location.replace('), 'sin redirect en modo HTML');
});

test('patch-catalog: crea onCreate si falta y delega en BridgeWebViewClient', () => {
  const cfg = g.normalizeConfig({ appName: 'Cat Patch', url: 'https://example.com', permissions: {} });
  const files = g.generateFiles(cfg);
  const p = String(files['patch-catalog.js']);
  assert.ok(p.includes('onCreate(android.os.Bundle ibState)'), 'asegura onCreate en el scaffold vacio');
  assert.ok(p.includes('super\\s*\\.\\s*onCreate'), 'el guard chequea super.onCreate real');
  assert.ok(p.includes('com.getcapacitor.BridgeWebViewClient'), 'subclase BridgeWebViewClient para no romper el servicio de assets locales');
  assert.ok(!p.includes('setWebViewClient(new WebViewClient('), 'nunca reemplaza el client con WebViewClient plano');
  assert.ok(!p.includes('setWebChromeClient('), 'no toca el WebChromeClient (file chooser)');
  assert.ok(p.includes('\\"http\\".equals(rs)||\\"https\\".equals(rs)') && p.includes('return false'), 'http/https quedan en el WebView y no saltan al navegador');
  assert.ok(p.includes('\\"http\\".equals(ss)||\\"https\\".equals(ss)'), 'tambien en el overload deprecado de String');
  assert.ok(p.includes('/_capacitor_http_interceptor_'), 'el proxy de Capacitor sigue bloqueado');
  assert.ok(String(files['www/catalog.js']).includes('__ibCat'), 'catalog.js es idempotente (no duplica UI)');
});

test('patch-permissions: ya no inyecta onPermissionRequest (lo maneja Capacitor)', () => {
  const cfg = g.normalizeConfig({ appName: 'Perm Patch', url: 'https://example.com', permissions: { gps: true } });
  const files = g.generateFiles(cfg);
  const p = String(files['patch-permissions.js']);
  assert.ok(p.includes('NativePermissions'), 'sigue inyectando el helper de permisos');
  assert.ok(!p.includes('onPermissionRequest'), 'sin WebChromeClient propio');
});

test('patch-main-activity (Radio): no crea un segundo onCreate si ya existe', () => {
  const cfg = g.normalizeConfig({ appName: 'Radio Patch', url: 'https://example.com', permissions: { foreground: true, voiceRec: true } });
  const files = g.generateFiles(cfg);
  const p = String(files['patch-main-activity.js']);
  assert.ok(p.includes('super\\s*\\.\\s*onCreate'), 'detecta un onCreate existente');
  assert.ok(p.includes('radioHook'), 'reutiliza el hook de arranque del servicio');
  const audio = String(files['patch-audio.js']);
  assert.ok(audio.includes('onCreate(android.os.Bundle ibState)'), 'patch-audio tambien asegura onCreate');
  const dron = String(files['patch-droncito.js']);
  assert.ok(dron.includes('onCreate(android.os.Bundle ibState)'), 'patch-droncito tambien asegura onCreate');
});

