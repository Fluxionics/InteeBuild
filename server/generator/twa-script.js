'use strict';

function generateTwaScriptSrc() {
  return `const fs = require('fs');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const crypto = require('crypto');
const cp = require('child_process');

function npmRootGlobal() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return cp.execFileSync(npm, ['root', '-g'], { encoding: 'utf8' }).trim();
}

function req(name) {
  try {
    return require(name);
  } catch (err) {}
  const root = npmRootGlobal();
  return require(require.resolve(name, { paths: [path.dirname(root), root] }));
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return fallback;
  }
}

function readProps(file) {
  const out = {};
  try {
    fs.readFileSync(file, 'utf8').split(/\\r?\\n/).forEach((line) => {
      const i = line.indexOf('=');
      if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    });
  } catch (err) {}
  return out;
}

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    crc32.table = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function solidPng(size, hex) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#4f46e5';
  const r = parseInt(valid.slice(1, 3), 16);
  const g = parseInt(valid.slice(3, 5), 16);
  const b = parseInt(valid.slice(5, 7), 16);
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function mapOrientation(value) {
  if (value === 'landscape') return 'landscape';
  if (value === 'portrait') return 'portrait';
  return 'default';
}

function pickIcon(themeColor) {
  const candidates = ['app-icon.png', 'adaptive-foreground.png'];
  for (const name of candidates) {
    if (fs.existsSync(name)) return name;
  }
  fs.writeFileSync('generated-icon.png', solidPng(512, themeColor));
  return 'generated-icon.png';
}

function serveIcon(file) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(fs.readFileSync(file));
      } catch (err) {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, url: 'http://127.0.0.1:' + server.address().port + '/' + path.basename(file) });
    });
  });
}

function prepareSigning(projectDir) {
  if (fs.existsSync('user-keystore.jks')) {
    fs.copyFileSync('user-keystore.jks', path.join(projectDir, 'user-keystore.jks'));
    const props = readProps('signing.properties');
    return {
      signingKey: { path: 'user-keystore.jks', alias: props.keyAlias || 'inteebuild' },
      store: props.storePassword || 'android',
      key: props.keyPassword || 'android'
    };
  }
  const keytool = path.join(process.env.JAVA_HOME || '', 'bin', 'keytool');
  const keytoolBin = fs.existsSync(keytool) ? keytool : (fs.existsSync(keytool + '.exe') ? keytool + '.exe' : 'keytool');
  cp.execFileSync(keytoolBin, [
    '-genkeypair', '-keystore', path.join(projectDir, 'android-keystore'),
    '-storepass', 'android', '-keypass', 'android', '-alias', 'androiddebugkey',
    '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
    '-dname', 'CN=Android Debug,O=Android,C=US'
  ], { stdio: 'inherit' });
  return {
    signingKey: { path: 'android-keystore', alias: 'androiddebugkey' },
    store: 'android',
    key: 'android'
  };
}

async function main() {
  const cfg = readJson('build-config.json', {});
  const src = readJson('twa-manifest.json', {});
  const projectDir = 'twa-project';
  fs.mkdirSync(projectDir, { recursive: true });

  const themeColor = src.themeColor || cfg.accentColor || '#4f46e5';
  const signing = prepareSigning(projectDir);
  console.log('signing listo: ' + signing.signingKey.path + ' alias=' + signing.signingKey.alias);

  const iconFile = pickIcon(themeColor);
  const served = await serveIcon(iconFile);
  console.log('icono servido: ' + iconFile + ' -> ' + served.url);

  let startUrl = src.startUrl || '/';
  let host = src.host || '';
  try {
    const u = new URL(startUrl);
    if (!host) host = u.host;
    startUrl = u.pathname + u.search;
  } catch (err) {}
  if (!host) host = 'example.com';

  const name = src.name || cfg.appName || 'App';
  const manifest = {
    packageId: src.packageId || cfg.packageName || 'com.inteebuild.app',
    host,
    name,
    launcherName: name.slice(0, 12),
    display: src.display || 'standalone',
    themeColor,
    navigationColor: themeColor,
    backgroundColor: src.backgroundColor || '#ffffff',
    enableNotifications: !!src.enableNotifications,
    startUrl,
    iconUrl: served.url,
    splashScreenFadeOutDuration: src.splashScreenFadeOutDuration || 300,
    signingKey: signing.signingKey,
    appVersion: cfg.versionName || '1.0.0',
    appVersionCode: cfg.versionCode || 1,
    orientation: mapOrientation(src.orientation || cfg.orientation),
    minSdkVersion: cfg.minSdk || 23,
    shortcuts: []
  };

  const core = req('@bubblewrap/core');
  const twa = new core.TwaManifest(manifest);
  const invalid = twa.validate();
  if (invalid) throw new Error('TWA manifest invalido: ' + invalid);

  const generator = new core.TwaGenerator();
  await generator.createTwaProject(projectDir, twa, new core.ConsoleLog('twa'));
  served.server.close();
  if (served.server.closeAllConnections) served.server.closeAllConnections();

  await twa.saveToFile(path.join(projectDir, 'twa-manifest.json'));
  const saved = fs.readFileSync(path.join(projectDir, 'twa-manifest.json'));
  fs.writeFileSync(path.join(projectDir, 'manifest-checksum.txt'), crypto.createHash('sha1').update(saved).digest('hex'));

  if (process.env.GITHUB_ENV) {
    fs.appendFileSync(process.env.GITHUB_ENV, 'BUBBLEWRAP_KEYSTORE_PASSWORD=' + signing.store + '\\nBUBBLEWRAP_KEY_PASSWORD=' + signing.key + '\\n');
  }

  fs.writeSync(1, 'TWA project generado en ' + projectDir + ' (host=' + host + ', pkg=' + manifest.packageId + ')\\n');
  process.exit(0);
}

main().catch((err) => {
  try {
    fs.writeSync(2, String((err && err.stack) || err) + '\\n');
  } catch (e) {}
  process.exit(1);
});
`;
}

module.exports = { generateTwaScriptSrc };
