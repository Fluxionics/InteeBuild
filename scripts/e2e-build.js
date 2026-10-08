'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const g = require('../server/generator');

const PREFIX_PROYECTO = 'inteebuild-e2e-';
const PREFIX_RESPALDO = 'prebuilt-android-';
const DEPS_CAPACITOR = ['@capacitor/cli', '@capacitor/core', '@capacitor/android'];
const ARCHIVOS_JAVA = ['NativePermissions.java', 'SpecialAccess.java', 'RadioService.java', 'AudioBridge.java', 'DroncitoBridge.java'];
const DENSIDADES = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
const PATCHES_PREVIO = [
  ['patch-permissions.js', 'NativePermissions.java'],
  ['patch-special.js', 'SpecialAccess.java'],
  ['patch-catalog.js', null],
  ['patch-gecko-gradle.js', null]
];
const PATCHES_POSTERIOR = [
  ['patch-main-activity.js', 'RadioService.java'],
  ['patch-audio.js', 'AudioBridge.java'],
  ['patch-droncito.js', 'DroncitoBridge.java'],
  ['patch-droncito-gradle.js', 'DroncitoBridge.java'],
  ['patch-droncito-native.js', 'native-MainActivity.java']
];
const ARCHIVOS_REQUERIDOS = [
  'package.json',
  'capacitor.config.json',
  'build-config.json',
  'main-manifest.xml',
  'www/index.html',
  'android/app/src/main/res/values/styles.xml',
  'android/app/src/main/res/values/colors.xml'
];

function log(mensaje) {
  console.log('[e2e-build] ' + mensaje);
}

function run(comando, args, cwd, shell) {
  log('$ ' + comando + ' ' + args.join(' '));
  const res = spawnSync(comando, args, {
    cwd,
    stdio: 'inherit',
    shell: shell === undefined ? process.platform === 'win32' : shell
  });
  if (res.error) throw new Error('no se pudo lanzar ' + comando + ': ' + res.error.message);
  if (res.status !== 0) throw new Error(comando + ' ' + args.join(' ') + ' termino con codigo ' + res.status);
}

function runNode(script, cwd) {
  run(process.execPath, [script], cwd, false);
}

function writeFiles(files, dir) {
  for (const rel of Object.keys(files)) {
    const dest = path.join(dir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const content = files[rel];
    fs.writeFileSync(dest, Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8'));
  }
}

function mergeDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) mergeDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function copyInto(dir, rel, destino, etiqueta) {
  const src = path.join(dir, rel);
  if (!fs.existsSync(src)) return false;
  const dest = path.join(dir, destino);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  log(etiqueta + ' aplicado: ' + destino);
  return true;
}

function createProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), PREFIX_PROYECTO));
  const cfg = g.normalizeConfig({
    appName: 'InteeBuild E2E',
    inputType: 'url',
    url: 'https://example.com',
    packageName: 'com.inteebuild.e2e',
    outputs: ['apk', 'aab'],
    provider: 'capacitor',
    themeColor: '#4f46e5',
    permissions: {}
  });
  const files = g.generateFiles(cfg);
  for (const rel of ARCHIVOS_REQUERIDOS) {
    if (!files[rel]) throw new Error('el generador no produjo ' + rel);
  }
  const pkg = JSON.parse(files['package.json']);
  const deps = pkg.dependencies || {};
  for (const dep of DEPS_CAPACITOR) {
    if (!deps[dep]) throw new Error('package.json de proyecto sin ' + dep);
  }
  const bc = JSON.parse(files['build-config.json']);
  if (bc.provider !== 'capacitor') throw new Error('provider inesperado: ' + bc.provider);
  if (bc.outputType !== 'both') throw new Error('outputType inesperado: ' + bc.outputType);
  if (!String(files['android/app/src/main/res/values/colors.xml']).includes(cfg.themeColor)) {
    throw new Error('themeColor no llego a colors.xml');
  }
  log('proyecto de prueba en ' + dir);
  log('capacitor ' + deps['@capacitor/core'] + ' | compileSdk ' + bc.compileSdk + ' | targetSdk ' + bc.targetSdk + ' | minSdk ' + bc.minSdk);
  writeFiles(files, dir);
  return { dir, cfg, files };
}

function installDependencies(dir) {
  run('npm', ['install'], dir);
  const core = path.join(dir, 'node_modules', '@capacitor', 'core', 'package.json');
  if (!fs.existsSync(core)) throw new Error('npm install no dejo @capacitor/core instalado');
  log('dependencias instaladas, @capacitor/core ' + JSON.parse(fs.readFileSync(core, 'utf8')).version);
}

function prepareAndroid(dir) {
  const android = path.join(dir, 'android');
  const hayPrebuilt = fs.existsSync(android);
  const respaldo = hayPrebuilt ? fs.mkdtempSync(path.join(os.tmpdir(), PREFIX_RESPALDO)) : null;
  if (hayPrebuilt) fs.renameSync(android, path.join(respaldo, 'android'));
  run('npx', ['cap', 'add', 'android'], dir);
  if (hayPrebuilt) {
    if (!fs.existsSync(android)) throw new Error('cap add android no creo la carpeta android');
    mergeDir(path.join(respaldo, 'android'), android);
    fs.rmSync(respaldo, { recursive: true, force: true });
    log('overlay de archivos pre-generados fusionado sobre android/');
  }
  run('npx', ['cap', 'sync', 'android'], dir);
}

function applySuppressWarning(dir) {
  const file = path.join(dir, 'android', 'gradle.properties');
  let text = fs.readFileSync(file, 'utf8');
  if (text.includes('android.suppressUnsupportedCompileSdk')) return;
  if (text.length && !text.endsWith('\n')) text += '\n';
  text += 'android.suppressUnsupportedCompileSdk=36\n';
  fs.writeFileSync(file, text);
  log('aviso de compileSdk suprimido');
}

function applySdkVersions(dir, bc) {
  const file = path.join(dir, 'android', 'variables.gradle');
  const valores = {
    minSdkVersion: bc.minSdk,
    compileSdkVersion: bc.compileSdk,
    targetSdkVersion: bc.targetSdk
  };
  const text = fs.readFileSync(file, 'utf8').split('\n').map(linea => {
    let salida = linea;
    for (const clave of Object.keys(valores)) {
      if (salida.includes(clave + ' = ')) {
        salida = salida.replace(new RegExp(clave + ' = .*'), clave + ' = ' + valores[clave]);
      }
    }
    return salida;
  }).join('\n');
  fs.writeFileSync(file, text);
  log('SDK aplicados: compile ' + bc.compileSdk + ' target ' + bc.targetSdk + ' min ' + bc.minSdk);
}

function applyNativeModules(dir, bc) {
  const raiz = fs.readdirSync(dir);
  const javaDir = path.join(dir, 'android', 'app', 'src', 'main', 'java', ...bc.packageName.split('.'));
  let copiadas = 0;
  for (const name of ARCHIVOS_JAVA) {
    if (!raiz.includes(name)) continue;
    fs.mkdirSync(javaDir, { recursive: true });
    fs.copyFileSync(path.join(dir, name), path.join(javaDir, name));
    copiadas++;
  }
  if (copiadas) log('clases nativas copiadas: ' + copiadas);
  copyInto(dir, 'res/xml/nfc_tech_filter.xml', 'android/app/src/main/res/xml/nfc_tech_filter.xml', 'filtro NFC');
  for (const [script, gate] of PATCHES_PREVIO) {
    if (raiz.includes(script) && (!gate || raiz.includes(gate))) runNode(script, dir);
  }
  const providerFile = (bc.provider === 'native' || bc.provider === 'droncito')
    ? 'native-MainActivity.java'
    : (bc.provider === 'gecko' ? 'gecko-MainActivity.java' : null);
  if (providerFile && raiz.includes(providerFile)) {
    fs.mkdirSync(javaDir, { recursive: true });
    fs.copyFileSync(path.join(dir, providerFile), path.join(javaDir, 'MainActivity.java'));
    log('provider ' + bc.provider + ' aplicado');
  }
  for (const [script, gate] of PATCHES_POSTERIOR) {
    if (raiz.includes(script) && (!gate || raiz.includes(gate))) runNode(script, dir);
  }
}

function applyAssets(dir) {
  const icon = path.join(dir, 'app-icon.png');
  if (fs.existsSync(icon)) {
    for (const density of DENSIDADES) {
      const dest = path.join(dir, 'android', 'app', 'src', 'main', 'res', density);
      fs.mkdirSync(dest, { recursive: true });
      fs.copyFileSync(icon, path.join(dest, 'ic_launcher.png'));
      fs.copyFileSync(icon, path.join(dest, 'ic_launcher_round.png'));
    }
    log('icono de la app aplicado');
  }
  if (fs.existsSync(path.join(dir, 'adaptive-foreground.png'))) {
    const anydpi = path.join(dir, 'android', 'app', 'src', 'main', 'res', 'mipmap-anydpi-v26');
    const valores = path.join(dir, 'android', 'app', 'src', 'main', 'res', 'values');
    const xxhdpi = path.join(dir, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxhdpi');
    fs.mkdirSync(anydpi, { recursive: true });
    fs.mkdirSync(valores, { recursive: true });
    fs.mkdirSync(xxhdpi, { recursive: true });
    fs.copyFileSync(path.join(dir, 'adaptive-ic_launcher.xml'), path.join(anydpi, 'ic_launcher.xml'));
    fs.copyFileSync(path.join(dir, 'adaptive-ic_launcher_round.xml'), path.join(anydpi, 'ic_launcher_round.xml'));
    fs.copyFileSync(path.join(dir, 'adaptive-foreground.png'), path.join(xxhdpi, 'ic_launcher_foreground.png'));
    fs.copyFileSync(path.join(dir, 'adaptive-bg.xml'), path.join(valores, 'ic_launcher_background.xml'));
    log('icono adaptativo aplicado');
  }
  copyInto(dir, 'custom-colors.xml', 'android/app/src/main/res/values/colors.xml', 'colores personalizados');
  copyInto(dir, 'inteebridge-inject.js', 'android/app/src/main/assets/public/inteebridge.js', 'puente JS');
  copyInto(dir, 'assetlinks.json', 'android/app/src/main/assets/.well-known/assetlinks.json', 'assetlinks');
  copyInto(dir, 'google-services.json', 'android/app/google-services.json', 'firebase');
  copyInto(dir, 'www/catalog.js', 'android/app/src/main/assets/public/catalog.js', 'catalogo web');
}

function applyProductionSteps(dir) {
  const bc = JSON.parse(fs.readFileSync(path.join(dir, 'build-config.json'), 'utf8'));
  applySuppressWarning(dir);
  applySdkVersions(dir, bc);
  fs.copyFileSync(path.join(dir, 'main-manifest.xml'), path.join(dir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'));
  log('manifest del generador aplicado');
  applyNativeModules(dir, bc);
  applyAssets(dir);
}

function compile(dir) {
  const android = path.join(dir, 'android');
  const wrapper = path.join(android, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
  if (!fs.existsSync(wrapper)) throw new Error('no existe el wrapper de Gradle: ' + wrapper);
  if (process.platform !== 'win32') fs.chmodSync(wrapper, 0o755);
  run(wrapper, ['assembleDebug', '--no-daemon'], android);
  run(wrapper, ['bundleDebug', '--no-daemon'], android);
}

function findBinary(dir, relDir, ext) {
  const out = path.join(dir, relDir);
  if (!fs.existsSync(out)) throw new Error('no existe la carpeta de salida ' + out);
  const found = fs.readdirSync(out)
    .filter(name => name.endsWith(ext))
    .map(name => path.join(out, name))
    .sort();
  if (!found.length) throw new Error('sin archivos ' + ext + ' en ' + out);
  if (found.length > 1) log('varios ' + ext + ', se verifica ' + path.basename(found[0]));
  return found[0];
}

async function expectEntries(file, entries, etiqueta) {
  const JSZip = require('jszip');
  let zip;
  try {
    zip = await JSZip.loadAsync(fs.readFileSync(file));
  } catch (err) {
    throw new Error(etiqueta + ' no es un ZIP valido: ' + err.message);
  }
  for (const entry of entries) {
    if (!zip.file(entry)) throw new Error(etiqueta + ' sin la entrada ' + entry);
  }
  log(etiqueta + ' OK: ' + Object.keys(zip.files).length + ' entradas, ' + fs.statSync(file).size + ' bytes');
}

async function verifyBinaries(dir) {
  const apk = findBinary(dir, 'android/app/build/outputs/apk/debug', '.apk');
  const aab = findBinary(dir, 'android/app/build/outputs/bundle/debug', '.aab');
  await expectEntries(apk, ['classes.dex', 'AndroidManifest.xml'], 'APK');
  await expectEntries(aab, ['base/manifest/AndroidManifest.xml'], 'AAB');
  return { apk, aab };
}

function copyArtifacts(apk, aab) {
  const outDir = process.env.E2E_OUT_DIR;
  if (!outDir) return null;
  fs.mkdirSync(outDir, { recursive: true });
  const destino = {
    apk: path.join(outDir, path.basename(apk)),
    aab: path.join(outDir, path.basename(aab))
  };
  fs.copyFileSync(apk, destino.apk);
  fs.copyFileSync(aab, destino.aab);
  log('binarios copiados a ' + outDir);
  return destino;
}

async function main() {
  const inicio = Date.now();
  const project = createProject();
  installDependencies(project.dir);
  prepareAndroid(project.dir);
  applyProductionSteps(project.dir);
  compile(project.dir);
  const { apk, aab } = await verifyBinaries(project.dir);
  const copiados = copyArtifacts(apk, aab);
  log('verificacion completa en ' + Math.round((Date.now() - inicio) / 1000) + 's');
  console.log('APK: ' + (copiados ? copiados.apk : apk));
  console.log('AAB: ' + (copiados ? copiados.aab : aab));
}

module.exports = {
  createProject,
  installDependencies,
  prepareAndroid,
  applyProductionSteps,
  compile,
  findBinary,
  expectEntries,
  verifyBinaries,
  main
};

if (require.main === module) {
  main().catch(err => {
    console.error('[e2e-build] FALLO: ' + (err && err.message ? err.message : String(err)));
    process.exit(1);
  });
}
