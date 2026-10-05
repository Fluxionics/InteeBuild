'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'e2e-build.js');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'test-build.yml');

test('e2e-build: el script existe y monta el flujo real de compilacion', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  const tokens = [
    'normalizeConfig',
    'generateFiles',
    'mkdtempSync',
    'outputs: [\'apk\', \'aab\']',
    'themeColor',
    '@capacitor/cli',
    '@capacitor/core',
    '@capacitor/android',
    'cap add android',
    '\'cap\', \'sync\', \'android\'',
    'prebuilt-android',
    'main-manifest.xml',
    'assembleDebug',
    'bundleDebug',
    'classes.dex',
    'base/manifest/AndroidManifest.xml',
    'process.exit(1)'
  ];
  for (const token of tokens) assert.ok(src.includes(token), 'incluye ' + token);
  const mod = require('../scripts/e2e-build');
  for (const fn of ['createProject', 'installDependencies', 'prepareAndroid', 'applyProductionSteps', 'compile', 'verifyBinaries', 'main']) {
    assert.equal(typeof mod[fn], 'function', fn + ' exportado');
  }
});

test('e2e-build: genera el proyecto minimo en un directorio temporal', () => {
  const { createProject } = require('../scripts/e2e-build');
  const { dir, cfg, files } = createProject();
  try {
    assert.equal(cfg.provider, 'capacitor');
    assert.deepEqual(cfg.outputs, ['apk', 'aab']);
    assert.equal(cfg.themeColor, '#4f46e5');
    assert.equal(path.relative(os.tmpdir(), dir).startsWith('..'), false, 'el proyecto vive en tmp');
    for (const rel of ['package.json', 'capacitor.config.json', 'build-config.json', 'main-manifest.xml', 'www/index.html']) {
      assert.ok(fs.existsSync(path.join(dir, rel)), rel + ' escrito en disco');
    }
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    for (const dep of ['@capacitor/cli', '@capacitor/core', '@capacitor/android']) {
      assert.match(pkg.dependencies[dep], /^\^\d+\.\d+\.\d+$/, dep + ' con version fijada');
    }
    const bc = JSON.parse(fs.readFileSync(path.join(dir, 'build-config.json'), 'utf8'));
    assert.equal(bc.provider, 'capacitor');
    assert.equal(bc.outputType, 'both');
    assert.equal(bc.compileSdk, 35);
    const colors = fs.readFileSync(path.join(dir, 'android', 'app', 'src', 'main', 'res', 'values', 'colors.xml'), 'utf8');
    assert.ok(colors.includes('#4f46e5'), 'themeColor en colors.xml');
    const styles = fs.readFileSync(path.join(dir, 'android', 'app', 'src', 'main', 'res', 'values', 'styles.xml'), 'utf8');
    assert.match(styles, /style name="AppTheme"/, 'tema propio presente');
    const manifest = fs.readFileSync(path.join(dir, 'main-manifest.xml'), 'utf8');
    assert.ok(manifest.includes('android.permission.INTERNET'), 'manifest con permisos');
    assert.ok(files['.github/workflows/build-app.yml'], 'workflow de produccion emitido');
    assert.ok(!files['.github/workflows/test-build.yml'], 'el e2e no pisa el workflow del repo');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('test-build: workflow de e2e valido, serializado y sin secretos', () => {
  const src = fs.readFileSync(WORKFLOW, 'utf8');
  assert.ok(!/^\s*#/m.test(src), 'sin comentarios en YAML');
  assert.ok(!/secrets\./.test(src), 'sin secretos');
  const doc = yaml.load(src);
  assert.ok(doc.jobs, 'jobs presentes');
  const triggers = doc.on || doc[true];
  assert.ok(triggers, 'disparos definidos');
  assert.ok(Object.prototype.hasOwnProperty.call(triggers, 'workflow_dispatch'), 'disparo manual');
  assert.ok(Array.isArray(triggers.schedule) && triggers.schedule.length === 1, 'disparo programado');
  assert.match(triggers.schedule[0].cron, /^\d{1,2} \d{1,2} \* \* \*$/, 'cron diario');
  assert.deepEqual(doc.permissions, { contents: 'read' }, 'permisos minimos');
  assert.ok(doc.concurrency, 'concurrency definido');
  assert.equal(doc.concurrency['cancel-in-progress'], false, 'serializado, sin cancelar');
  const steps = doc.jobs[Object.keys(doc.jobs)[0]].steps;
  const texto = steps.map(s => [s.name || '', s.run || '', s.uses || '', JSON.stringify(s.with || {}), JSON.stringify(s.env || {})].join(' ')).join('\n');
  const esperados = [
    'actions/checkout@v4',
    'actions/setup-java@v4',
    'temurin',
    'actions/setup-node@v4',
    'npm ci',
    'node scripts/e2e-build.js',
    'actions/upload-artifact@v4',
    'retention-days":3',
    'if-no-files-found":"error"'
  ];
  for (const token of esperados) assert.ok(texto.includes(token), 'incluye ' + token);
  assert.ok(!texto.includes('npm test'), 'el e2e no duplica la suite unitaria');
  const prod = yaml.load(require('../server/generator/workflow').WORKFLOW_YML);
  const javaProd = prod.jobs.compile.steps.find(s => (s.with || {})['java-version']);
  const javaE2E = steps.find(s => (s.with || {})['java-version']);
  assert.ok(javaProd && javaE2E, 'ambos fijan version de Java');
  assert.equal(String(javaE2E.with['java-version']), String(javaProd.with['java-version']), 'el e2e usa el mismo JDK que el build de produccion');
  assert.equal(javaE2E.with.distribution, javaProd.with.distribution, 'misma distribucion que el build de produccion');
});

test('e2e-build: las verificaciones cubren APK y AAB', async () => {
  const mod = require('../scripts/e2e-build');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ib-e2e-check-'));
  try {
    await assert.rejects(() => mod.verifyBinaries(tmp), /no existe la carpeta de salida/);
    const salidas = path.join(tmp, 'salidas');
    const outApk = path.join(salidas, 'android', 'app', 'build', 'outputs', 'apk', 'debug');
    const outAab = path.join(salidas, 'android', 'app', 'build', 'outputs', 'bundle', 'debug');
    fs.mkdirSync(outApk, { recursive: true });
    fs.mkdirSync(outAab, { recursive: true });
    await assert.rejects(() => mod.verifyBinaries(salidas), /sin archivos \.apk/);
    const outAabFake = path.join(salidas, 'android', 'app', 'build', 'outputs', 'bundle', 'debug', 'app-debug.aab');
    fs.writeFileSync(path.join(outApk, 'app-debug.apk'), Buffer.from('no soy zip'));
    fs.writeFileSync(outAabFake, Buffer.from('no soy zip'));
    await assert.rejects(() => mod.verifyBinaries(salidas), /no es un ZIP valido/);
    const JSZip = require('jszip');
    const zip = path.join(tmp, 'muestra.zip');
    const z = new JSZip();
    z.file('classes.dex', Buffer.from([0]));
    z.file('AndroidManifest.xml', '<manifest/>');
    fs.writeFileSync(zip, await z.generateAsync({ type: 'nodebuffer' }));
    await mod.expectEntries(zip, ['classes.dex', 'AndroidManifest.xml'], 'APK');
    await assert.rejects(() => mod.expectEntries(zip, ['base/manifest/AndroidManifest.xml'], 'AAB'), /sin la entrada base/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
