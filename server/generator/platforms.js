'use strict';

const { nativeMainActivitySrc, geckoMainActivitySrc, cordovaConfigXml, geckoGradlePatchSrc } = require('./providers');
const { starterHtml, finalizeWebAssets } = require('./web-assets');

const WEBVIEW_LABELS = {
  droncito: 'Droncito Compiler',
  gecko: 'GeckoView',
  native: 'Native WebView',
  twa: 'TWA Chrome',
  cordova: 'Cordova WebView'
};

function providerFiles(cfg) {
  const files = {
    'provider.json': JSON.stringify({
      provider: cfg.provider,
      version: cfg.providerVersion,
      webview: WEBVIEW_LABELS[cfg.provider] || cfg.provider
    }, null, 2)
  };

  if (cfg.provider === 'native' || cfg.provider === 'droncito') files['native-MainActivity.java'] = nativeMainActivitySrc(cfg.packageName, cfg);
  if (cfg.provider === 'gecko') {
    files['gecko-MainActivity.java'] = geckoMainActivitySrc(cfg.packageName, cfg);
    files['patch-gecko-gradle.js'] = geckoGradlePatchSrc();
  }
  if (cfg.provider === 'cordova') files['config.xml'] = cordovaConfigXml(cfg);
  return files;
}

function integrationFiles(cfg) {
  const files = {};

  if (cfg.admobAppId) {
    files['admob-config.json'] = JSON.stringify({ appId: cfg.admobAppId, interstitial: cfg.admobInterstitial, rewarded: cfg.admobRewarded }, null, 2);
  }

  if (cfg.firebaseEnabled) {
    files['google-services.json'] = cfg.firebaseConfig || JSON.stringify({ project_info: { project_id: 'inteebuild-demo' }, client: [{ client_info: { mobilesdk_app_id: '1:000:android:000', package_name: cfg.packageName } }] }, null, 2);
    files['firebase-config.json'] = JSON.stringify({ enabled: true, package: cfg.packageName }, null, 2);
  }

  return files;
}


function resolveTwaDomain(cfg) {
  if (cfg.twaDomain) return cfg.twaDomain;
  if (cfg.deepLinkDomain) return cfg.deepLinkDomain;
  if (cfg.inputType !== 'url') return '';
  try { return new URL(cfg.url).hostname; } catch (_) { return ''; }
}



function twaHost(cfg) {
  if (cfg.twaDomain) return cfg.twaDomain;
  return cfg.inputType === 'url' ? new URL(cfg.url).hostname : 'example.com';
}

function appLinkFiles(cfg) {
  const domain = resolveTwaDomain(cfg);
  if (!domain) return {};


  const sha256 = '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00';
  const assetLinks = JSON.stringify([{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: cfg.packageName, sha256_cert_fingerprints: [sha256] }
  }], null, 2);

  return {
    'assetlinks.json': assetLinks,
    '.well-known/assetlinks.json': assetLinks
  };
}

function twaFiles(cfg) {
  const isTwa = cfg.provider === 'twa' || (cfg.twaEnabled && resolveTwaDomain(cfg));
  if (!isTwa) return {};

  const host = twaHost(cfg);
  const files = {
    'twa-manifest.json': JSON.stringify({
      packageId: cfg.packageName,
      host,
      name: cfg.appName,
      themeColor: cfg.accentColor || '#4f46e5',
      backgroundColor: cfg.splashColor || '#ffffff',
      display: 'standalone',
      orientation: cfg.orientation,
      startUrl: cfg.inputType === 'url' ? cfg.url : '/',
      iconUrl: 'https://example.com/icon.png',
      splashScreenFadeOutDuration: 300,
      enableNotifications: !!cfg.permissions.notifications,
      enableLocation: !!cfg.permissions.gps,
      screenOrientation: cfg.orientation === 'landscape' ? 'landscape' : 'portrait-primary'
    }, null, 2),

    'assetlinks.json': JSON.stringify([{
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: cfg.packageName,
        sha256_cert_fingerprints: ["SHA256_FINGERPRINT_HERE"]
      }
    }], null, 2),

    'twa/README.md': `# TWA (Trusted Web Activity)

## Setup Required
1. Upload \`assetlinks.json\` to your domain: \`https://${host}/.well-known/assetlinks.json\`
2. Replace \`SHA256_FINGERPRINT_HERE\` with your actual signing key fingerprint
3. Test with: \`bubblewrap build --manifest=twa-manifest.json\`

## Features
- Chrome-powered WebView
- Offline support with service worker
- ${cfg.permissions.notifications ? 'Notifications' : ''}
- ${cfg.permissions.gps ? 'Geolocation' : ''}
- PWA capabilities`
  };

  return files;
}

function projectSlug(appName) {
  return appName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^[^a-z]+/, '') || 'app';
}

function flutterFiles(cfg) {
  if (cfg.provider !== 'flutter') return {};

  return {
    'flutter/pubspec.yaml': `name: ${projectSlug(cfg.appName)}
description: ${cfg.appName}
version: ${cfg.versionName}+${cfg.versionCode}
environment:
  sdk: '>=3.0.0 <4.0.0'
dependencies:
  flutter:
    sdk: flutter
  webview_flutter: ^4.0.0
  permission_handler: ^11.0.0
  cupertino_icons: ^1.0.2

flutter:
  uses-material-design: true`,
    'flutter/lib/main.dart': `import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:permission_handler/permission_handler.dart';

void main() => runApp(MyApp());

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '${cfg.appName}',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: Color(0xff${cfg.accentColor.replace('#', '')})),
      ),
      home: WebViewScreen(url: '${cfg.inputType === 'url' ? cfg.url : ''}'),
    );
  }
}

class WebViewScreen extends StatefulWidget {
  final String url;
  const WebViewScreen({Key? key, required this.url}) : super(key: key);

  @override
  _WebViewScreenState createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xff0b0f1a))
      ..setNavigationDelegate(NavigationDelegate(
        onPageStarted: (_) {
          if (mounted) setState(() => _isLoading = true);
        },
        onPageFinished: (_) {
          if (mounted) setState(() => _isLoading = false);
        },
      ));
    if (widget.url.startsWith('http')) {
      controller.loadRequest(Uri.parse(widget.url));
    } else {
      controller.loadFlutterAsset('assets/www/index.html');
    }
    _controller = controller;
    _requestPermissions();
  }

  Future<void> _requestPermissions() async {
    ${cfg.permissions.cameraMic ? 'await Permission.camera.request();' : ''}
    ${cfg.permissions.microphone ? 'await Permission.microphone.request();' : ''}
    ${cfg.permissions.gps ? 'await Permission.location.request();' : ''}
    ${cfg.permissions.storage ? 'await Permission.storage.request();' : ''}
    ${cfg.permissions.notifications ? 'await Permission.notification.request();' : ''}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_isLoading)
            const Positioned.fill(
              child: Center(child: CircularProgressIndicator()),
            ),
        ],
      ),
    );
  }
}`,
    'flutter/android/app/src/main/AndroidManifest.xml': `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    ${cfg.permissions.cameraMic ? '<uses-permission android:name="android.permission.CAMERA" />' : ''}
    ${cfg.permissions.microphone ? '<uses-permission android:name="android.permission.RECORD_AUDIO" />' : ''}
    ${cfg.permissions.gps ? '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />' : ''}
    ${cfg.permissions.gps ? '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />' : ''}
    ${cfg.permissions.storage ? '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />' : ''}
    ${cfg.permissions.notifications ? '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />' : ''}
    ${cfg.permissions.foreground ? '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />' : ''}
    ${cfg.permissions.wakeLock ? '<uses-permission android:name="android.permission.WAKE_LOCK" />' : ''}
    <application
        android:label="${cfg.appName}"
        android:icon="@mipmap/ic_launcher"
        android:theme="@style/LaunchTheme"
        android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
        android:hardwareAccelerated="true"
        android:windowSoftInputMode="adjustResize">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:theme="@style/LaunchTheme"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
            android:hardwareAccelerated="true"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
        <meta-data
            android:name="flutterEmbedding"
            android:value="2" />
    </application>
</manifest>`,
    'flutter/README.md': `# Flutter Project

## Compilar
\`\`\`bash
cd flutter
flutter pub get
flutter build apk --release
flutter build appbundle --release
\`\`\`

## Assets
La web de la app vive en \`assets/www/\` (index.html + catalog.js) y esta
lista en \`pubspec.yaml\` bajo \`flutter.assets\`.

## Features
- WebView (webview_flutter 4) con ${cfg.inputType === 'url' ? 'URL: ' + cfg.url : 'HTML embebido'}
- Permisos nativos: ${Object.keys(cfg.permissions).filter(k => cfg.permissions[k]).join(', ') || 'ninguno'}
- Material 3 con color ${cfg.accentColor}`
  };
}

function finalizeFlutterProject(files) {
  const pubspec = files['flutter/pubspec.yaml'];
  if (!pubspec) return;
  const dirs = new Set(['www']);
  Object.keys(files).forEach((key) => {
    if (!key.startsWith('www/')) return;
    files['flutter/assets/' + key] = files[key];
    const dirParts = key.split('/').slice(0, -1);
    for (let i = 1; i <= dirParts.length; i++) dirs.add(dirParts.slice(0, i).join('/'));
  });
  const list = [...dirs].sort().map((d) => `    - assets/${d}/`).join('\n');
  files['flutter/pubspec.yaml'] = pubspec.replace(/\s+$/, '') + '\n  assets:\n' + list + '\n';
}

function tauriPngIcon(cfg) {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(cfg.iconBase64 || ''));
  if (!m) return null;
  let png;
  try { png = Buffer.from(m[1], 'base64'); } catch (_) { return null; }
  if (!png || png.length < 67 || png.length > 5 * 1024 * 1024) return null;
  if (png.slice(0, 4).toString('hex') !== '89504e47') return null;
  return png;
}

function tauriIconFiles(cfg) {
  const png = tauriPngIcon(cfg);
  if (!png) return {};

  const w = png.readUInt32BE(16) || 512;
  const ico = Buffer.alloc(22);
  ico.writeUInt16LE(0, 0);
  ico.writeUInt16LE(1, 2);
  ico.writeUInt16LE(1, 4);
  ico.writeUInt8(w >= 256 ? 0 : Math.min(w, 255), 6);
  ico.writeUInt8(w >= 256 ? 0 : Math.min(w, 255), 7);
  ico.writeUInt8(0, 8);
  ico.writeUInt8(0, 9);
  ico.writeUInt16LE(1, 10);
  ico.writeUInt16LE(32, 12);
  ico.writeUInt32LE(png.length, 14);
  ico.writeUInt32LE(22, 18);

  const icnsInner = Buffer.alloc(8);
  icnsInner.write('ic09', 0, 'ascii');
  icnsInner.writeUInt32BE(8 + png.length, 4);
  const icnsHead = Buffer.alloc(8);
  icnsHead.write('icns', 0, 'ascii');
  icnsHead.writeUInt32BE(16 + png.length, 4);

  return {
    'tauri/src-tauri/icons/32x32.png': png,
    'tauri/src-tauri/icons/128x128.png': png,
    'tauri/src-tauri/icons/128x128@2x.png': png,
    'tauri/src-tauri/icons/icon.ico': Buffer.concat([ico, png]),
    'tauri/src-tauri/icons/icon.icns': Buffer.concat([icnsHead, icnsInner, png])
  };
}

function tauriFiles(cfg) {
  if (cfg.provider !== 'tauri') return {};
  const slug = projectSlug(cfg.appName).replace(/_/g, '-');
  const iconFilesMap = tauriIconFiles(cfg);

  const bundle = { identifier: cfg.packageName };
  if (Object.keys(iconFilesMap).length) {
    bundle.icon = ['icons/32x32.png', 'icons/128x128.png', 'icons/128x128@2x.png', 'icons/icon.icns', 'icons/icon.ico'];
  }

  const conf = {
    build: { distDir: '../../www', devPath: '../../www' },
    tauri: {
      bundle,
      updater: { active: false },
      allowlist: {
        all: true,
        shell: { all: true, open: true },
        dialog: { all: true, ask: true, confirm: true },
        fs: { all: true, readFile: true, writeFile: true, readDir: true, removeFile: true, copyFile: true },
        http: { all: true, request: true, scope: ['https://*', 'http://*'] },
        notification: { all: true }
      },
      security: {
        csp: "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: filesystem: ws: wss: https: http:; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https: http: ws: wss:"
      },
      windows: [{
        title: cfg.appName,
        width: 1280,
        height: 720,
        resizable: true,
        fullscreen: cfg.fullscreen,
        decorations: true
      }]
    }
  };

  return Object.assign({
    'tauri/src-tauri/Cargo.toml': `[package]
name = "${slug}"
version = "${cfg.versionName}"
edition = "2021"

[dependencies]
tauri = { version = "1", features = ["api-all"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

[build-dependencies]
tauri-build = { version = "1", features = [] }

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]`,
    'tauri/src-tauri/build.rs': `fn main() {
    tauri_build::build()
}`,
    'tauri/src-tauri/tauri.conf.json': JSON.stringify(conf, null, 2),
    'tauri/src-tauri/src/main.rs': `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}`,
    'tauri/README.md': `# Tauri Project

## Compilar
\`\`\`bash
cd tauri/src-tauri
cargo build --release
\`\`\`

El binario queda en \`src-tauri/target/release/${slug}.exe\`.
La web se sirve de \`www/\` de la raiz del proyecto (distDir \`../../www\`).

## Features
- Desktop ligero (WebView2 en Windows, WebKit en macOS/Linux)
- Backend Rust
- ${Object.keys(cfg.permissions).filter(k => cfg.permissions[k]).join(', ') || 'ninguno'} permisos`
  }, iconFilesMap);
}






const DESKTOP_TARGETS = {
  win: { win: ['nsis', 'msi'] },
  mac: { win: ['nsis', 'msi'], mac: ['dmg'], linux: ['AppImage'] },
  both: { win: ['nsis', 'msi'], mac: ['dmg'], linux: ['AppImage'] }
};

const DESKTOP_DEPENDENCIES = { electron: '^31.3.1', 'electron-builder': '^24.13.3' };





function packagedWwwHtml(cfg) {
  const www = { 'www/index.html': starterHtml(cfg) };
  finalizeWebAssets(www, { ...cfg, pwaEnabled: false });
  return www['www/index.html'];
}

function desktopPackageJson(cfg) {
  const targets = DESKTOP_TARGETS[cfg.desktopPlatform] || DESKTOP_TARGETS.both;
  return JSON.stringify({
    name: cfg.appName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    productName: cfg.appName,
    version: cfg.versionName,
    main: 'main.js',
    scripts: { start: 'electron .', build: 'electron-builder' },
    devDependencies: DESKTOP_DEPENDENCIES,
    build: {
      appId: cfg.packageName,
      files: ['main.js', 'www/**'],
      directories: { output: 'dist' },
      ...targets
    }
  }, null, 2);
}



function desktopMainSrc(cfg) {
  const startUrl = JSON.stringify(cfg.inputType === 'url' ? cfg.url : '');
  return `'use strict';

const path = require('path');
const { app, BrowserWindow } = require('electron');

const START_URL = ${startUrl};

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  if (START_URL) {
    win.loadURL(START_URL);
  } else {
    win.loadFile(path.join(__dirname, 'www', 'index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
`;
}

function desktopReadme(cfg) {
  const targets = DESKTOP_TARGETS[cfg.desktopPlatform] || DESKTOP_TARGETS.both;
  const list = Object.entries(targets).map(([os, ts]) => `${os}: ${ts.join(', ')}`).join(' | ');
  return `# Desktop Export - Electron

\`npm install && npm start\` para probar. \`npm run build\` para empaquetar (${list}).

La app abre la URL de la config; si el proyecto es HTML pegado carga \`www/index.html\` de este mismo directorio.`;
}

function desktopFiles(cfg) {
  if (!cfg.desktopEnabled) return {};

  return {
    'desktop/package.json': desktopPackageJson(cfg),
    'desktop/main.js': desktopMainSrc(cfg),
    'desktop/www/index.html': packagedWwwHtml(cfg),
    'desktop/README.md': desktopReadme(cfg)
  };
}

function platformProjects(cfg) {
  return Object.assign(
    appLinkFiles(cfg),
    twaFiles(cfg),
    flutterFiles(cfg),
    tauriFiles(cfg),
    desktopFiles(cfg)
  );
}

module.exports = { providerFiles, integrationFiles, platformProjects, finalizeFlutterProject };
