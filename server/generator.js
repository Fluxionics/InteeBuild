'use strict';

const CAPACITOR_VERSIONS = {
  6: { compileSdk: 34, minSdk: 23, targetSdk: 34, npm: '^6.2.1', java: '17' },
  7: { compileSdk: 35, minSdk: 23, targetSdk: 35, npm: '^7.4.1', java: '17' }
};

const VALID_COMPILE_SDKS = [33, 34, 35, 36, 37];
const VALID_TARGET_SDKS = [27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37];
const VALID_MIN_SDKS = [23, 24, 26, 27, 28, 29];

const PLUGIN_VERSIONS = {
  core: { 6: '^6.2.1', 7: '^7.4.1' },
  camera: { 6: '^6.0.2', 7: '^7.0.0' },
  geolocation: { 6: '^6.0.1', 7: '^7.0.0' },
  share: { 6: '^6.0.2', 7: '^7.0.0' },
  filesystem: { 6: '^6.0.1', 7: '^7.0.0' },
  haptics: { 6: '^6.0.1', 7: '^7.0.0' },
  clipboard: { 6: '^6.0.1', 7: '^7.0.0' },
  pushNotifications: { 6: '^6.0.2', 7: '^7.0.0' },
  localNotifications: { 6: '^6.1.0', 7: '^7.0.0' },
  preferences: { 6: '^6.0.2', 7: '^7.0.0' },
  browser: { 6: '^6.0.2', 7: '^7.0.0' },
  app: { 6: '^6.0.0', 7: '^7.0.0' },
  device: { 6: '^6.0.0', 7: '^7.0.0' },
  network: { 6: '^6.0.2', 7: '^7.0.0' },
  statusBar: { 6: '^6.0.1', 7: '^7.0.0' },
  splashScreen: { 6: '^6.0.2', 7: '^7.0.0' },
  toast: { 6: '^6.0.0', 7: '^7.0.0' },
  dialog: { 6: '^6.0.0', 7: '^7.0.0' },
  textZoom: { 6: '^6.0.0', 7: '^7.0.0' },
  bluetoothLe: '^5.1.0',
  nfc: '^1.2.0',
  admob: '^5.0.0',
  screenReader: { 6: '^6.0.0', 7: '^7.0.0' }
};

function pv(name, cap) {
  const v = PLUGIN_VERSIONS[name];
  if (!v) return '^1.0.0';
  if (typeof v === 'string') return v;
  return v[cap] || v[7];
}

function normalizeConfig(raw) {
  const appName = String(raw.appName || '').trim().slice(0, 40) || 'My Web App';
  const inputType = raw.inputType === 'html' ? 'html' : 'url';
  const htmlCode = inputType === 'html' ? String(raw.htmlCode || '').trim() : '';
  const url = inputType === 'url' ? String(raw.url || '').trim() : 'https://localhost';

  if (inputType === 'url') {
    let parsed;
    try {
      parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error();
    } catch (_) {
      throw Object.assign(new Error('La URL debe ser http(s):// valida'), { status: 400 });
    }
  }

  if (inputType === 'html' && !htmlCode) {
    throw Object.assign(new Error('Debes proporcionar codigo HTML'), { status: 400 });
  }

  let packageName = String(raw.packageName || '').trim().toLowerCase();
  if (!packageName) {
    const slug = appName.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'app';
    packageName = `com.inteebuild.${slug}`;
  }
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName)) {
    throw Object.assign(new Error('packageName invalido. Ej: com.miempresa.miniapp'), { status: 400 });
  }

  let compileSdk = Number(raw.compileSdk) || 35;
  if (!VALID_COMPILE_SDKS.includes(compileSdk)) compileSdk = 35;

  let targetSdk = Number(raw.targetSdk) || compileSdk;
  if (!VALID_TARGET_SDKS.includes(targetSdk)) targetSdk = compileSdk;

  let minSdk = Number(raw.minSdk) || 23;
  if (!VALID_MIN_SDKS.includes(minSdk)) minSdk = 23;
  if (targetSdk < minSdk) targetSdk = minSdk;

  const capMajor = compileSdk >= 35 ? 7 : 6;

  const permissions = {
    notifications: !!raw?.permissions?.notifications,
    foreground: !!raw?.permissions?.foreground,
    cameraMic: !!raw?.permissions?.cameraMic,
    storage: !!raw?.permissions?.storage,
    gps: !!raw?.permissions?.gps,
    bluetooth: !!raw?.permissions?.bluetooth,
    phone: !!raw?.permissions?.phone,
    sms: !!raw?.permissions?.sms,
    calendar: !!raw?.permissions?.calendar,
    contacts: !!raw?.permissions?.contacts,
    sensors: !!raw?.permissions?.sensors,
    nfc: !!raw?.permissions?.nfc,
    systemAlert: !!raw?.permissions?.systemAlert,
    installPackages: !!raw?.permissions?.installPackages,
    alarm: !!raw?.permissions?.alarm,
    nearby: !!raw?.permissions?.nearby,
    vibration: !!raw?.permissions?.vibration,
    wakeLock: !!raw?.permissions?.wakeLock,
    biometric: !!raw?.permissions?.biometric,
    microphone: !!raw?.permissions?.microphone,
    activityRecognition: !!raw?.permissions?.activityRecognition
  };

  const plugins = {
    camera: !!raw?.plugins?.camera,
    geolocation: !!raw?.plugins?.geolocation,
    bluetooth: !!raw?.plugins?.bluetooth,
    nfc: !!raw?.plugins?.nfc,
    vibration: !!raw?.plugins?.vibration,
    share: !!raw?.plugins?.share,
    filesystem: !!raw?.plugins?.filesystem,
    contacts: !!raw?.plugins?.contacts,
    calendar: !!raw?.plugins?.calendar,
    notifications: !!raw?.plugins?.notifications,
    localNotifications: !!raw?.plugins?.localNotifications,
    biometrics: !!raw?.plugins?.biometrics,
    clipboard: !!raw?.plugins?.clipboard,
    haptics: !!raw?.plugins?.haptics,
    preferences: !!raw?.plugins?.preferences,
    browser: !!raw?.plugins?.browser,
    app: !!raw?.plugins?.app,
    device: !!raw?.plugins?.device,
    network: !!raw?.plugins?.network,
    statusBar: !!raw?.plugins?.statusBar,
    toast: !!raw?.plugins?.toast,
    dialog: !!raw?.plugins?.dialog,
    admob: !!raw?.plugins?.admob,
    screenReader: !!raw?.plugins?.screenReader,
    inteebridge: !!raw?.plugins?.inteebridge
  };

  const orientation = ['portrait', 'landscape', 'any', 'sensor'].includes(raw.orientation) ? raw.orientation : 'any';
  const fullscreen = !!raw.fullscreen;
  const hideNavBar = !!raw.hideNavBar;
  const keepScreenOn = !!raw.keepScreenOn;
  const splashEnabled = !!raw.splashEnabled;
  const splashColor = typeof raw.splashColor === 'string' ? raw.splashColor.slice(0, 10) : '#ffffff';
  const splashDuration = Math.max(500, Math.min(5000, Number(raw.splashDuration) || 2000));
  const outputType = ['apk', 'aab', 'both'].includes(raw.outputType) ? raw.outputType : 'apk';
  const platform = ['android','ios','both'].includes(raw.platform) ? raw.platform : 'android';
  const useCleartext = raw.useCleartext === undefined ? true : !!raw.useCleartext;
  const author = String(raw.author || '').slice(0, 60);
  const description = String(raw.description || '').slice(0, 200);
  const accentColor = /^#[0-9a-fA-F]{6}$/.test(String(raw.accentColor||'')) ? String(raw.accentColor) : '#4f46e5';
  const statusBarColor = /^#[0-9a-fA-F]{6}$/.test(String(raw.statusBarColor||'')) ? String(raw.statusBarColor) : '#ffffff';
  const navigationBarColor = /^#[0-9a-fA-F]{6}$/.test(String(raw.navigationBarColor||'')) ? String(raw.navigationBarColor) : '#ffffff';
  const edgeToEdge = !!raw.edgeToEdge;
  const adaptiveIconEnabled = !!raw.adaptiveIconEnabled;
  const adaptiveIconBg = /^#[0-9a-fA-F]{6}$/.test(String(raw.adaptiveIconBg||'')) ? String(raw.adaptiveIconBg) : '#4f46e5';
  const adaptiveFgBase64 = typeof raw.adaptiveFgBase64 === 'string' && raw.adaptiveFgBase64.startsWith('data:image/') ? raw.adaptiveFgBase64 : null;
  const deepLinksEnabled = !!raw.deepLinksEnabled;
  const deepLinkDomain = String(raw.deepLinkDomain||'').slice(0,120).replace(/^https?:\/\//,'');
  const deepLinkPaths = Array.isArray(raw.deepLinkPaths) ? raw.deepLinkPaths.slice(0,10).map(s=>String(s).slice(0,80)) : [];
  const notifChannel = String(raw.notifChannel||'General').slice(0,40) || 'General';
  const notifImportance = ['low','default','high'].includes(raw.notifImportance) ? raw.notifImportance : 'high';
  const notifSound = !!raw.notifSound;
  const notifVibration = !!raw.notifVibration;
  const appTheme = ['light','dark','system'].includes(raw.appTheme) ? raw.appTheme : 'system';
  const entryAnimation = ['none','fade','slide'].includes(raw.entryAnimation) ? raw.entryAnimation : 'none';
  const userAgent = String(raw.userAgent||'').slice(0,256);
  const jsInjection = String(raw.jsInjection||'').slice(0,20000);
  const cssInjection = String(raw.cssInjection||'').slice(0,20000);
  const cacheMode = ['normal','no-cache','force-cache'].includes(raw.cacheMode) ? raw.cacheMode : 'normal';
  const backButtonBehavior = ['back','exit','confirm','none'].includes(raw.backButtonBehavior) ? raw.backButtonBehavior : 'back';
  const customHeaders = typeof raw.customHeaders === 'string' ? raw.customHeaders.slice(0,2000) : '';
  const webhookUrl = typeof raw.webhookUrl === 'string' && /^https?:\/\//.test(raw.webhookUrl.trim()) ? raw.webhookUrl.trim().slice(0,500) : '';

  let keystoreBase64 = null;
  let keystorePassword = '';
  let keyAlias = '';
  let keyPassword = '';
  let useCustomSigning = false;
  const rawKs = typeof raw.keystoreBase64 === 'string' ? raw.keystoreBase64.trim() : '';
  if (rawKs) {
    const m = /^data:.*?;base64,(.+)$/.exec(rawKs);
    const b64 = m ? m[1] : rawKs;
    if (b64.length > 100 && b64.length < 120000) {
      try { Buffer.from(b64, 'base64'); keystoreBase64 = b64; } catch (_) {}
    }
  }
  if (keystoreBase64) {
    keystorePassword = String(raw.keystorePassword || '').slice(0, 128);
    keyAlias = String(raw.keyAlias || '').slice(0, 128);
    keyPassword = String(raw.keyPassword || raw.keystorePassword || '').slice(0, 128);
    useCustomSigning = !!(keystorePassword && keyAlias);
    if (!useCustomSigning) keystoreBase64 = null;
  }

  return {
    appName, inputType, htmlCode, url,
    parsed: inputType === 'url' ? new URL(url) : { protocol: 'https:', href: 'https://localhost' },
    packageName,
    versionCode: Math.max(1, Number(raw.versionCode) || 1),
    versionName: String(raw.versionName || '1.0.0').slice(0, 20) || '1.0.0',
    compileSdk, targetSdk, minSdk, capMajor,
    npmVersion: CAPACITOR_VERSIONS[capMajor].npm,
    javaVersion: CAPACITOR_VERSIONS[capMajor].java,
    permissions, plugins, orientation, fullscreen, hideNavBar, keepScreenOn,
    splashEnabled, splashColor, splashDuration, outputType, useCleartext,
    author, description, accentColor, statusBarColor, navigationBarColor,
    edgeToEdge, adaptiveIconEnabled, adaptiveIconBg, adaptiveFgBase64,
    deepLinksEnabled, deepLinkDomain, deepLinkPaths,
    notifChannel, notifImportance, notifSound, notifVibration,
    appTheme, entryAnimation, userAgent, jsInjection, cssInjection,
    cacheMode, backButtonBehavior, customHeaders, webhookUrl,
    useCustomSigning, keystoreBase64, keystorePassword, keyAlias, keyPassword,
    iconBase64: typeof raw.iconBase64 === 'string' && (raw.iconBase64.startsWith('data:image/png') || raw.iconBase64.startsWith('data:image/jpeg') || raw.iconBase64.startsWith('data:image/webp')) ? raw.iconBase64 : null
  };
}

function permissionManifestBlocks(cfg) {
  const perms = [
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.ACCESS_WIFI_STATE'
  ];
  const p = cfg.permissions;

  if (p.notifications || p.foreground) {
    perms.push('android.permission.POST_NOTIFICATIONS');
    perms.push('android.permission.VIBRATE');
  }
  if (p.foreground) {
    perms.push('android.permission.FOREGROUND_SERVICE');
    perms.push('android.permission.FOREGROUND_SERVICE_DATA_SYNC');
    perms.push('android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK');
  }
  if (p.cameraMic) {
    perms.push('android.permission.CAMERA');
    perms.push('android.permission.RECORD_AUDIO');
    perms.push('android.permission.MODIFY_AUDIO_SETTINGS');
  }
  if (p.microphone && !p.cameraMic) {
    perms.push('android.permission.RECORD_AUDIO');
    perms.push('android.permission.MODIFY_AUDIO_SETTINGS');
  }
  if (p.storage) {
    perms.push('android.permission.READ_EXTERNAL_STORAGE');
    perms.push('android.permission.READ_MEDIA_IMAGES');
    perms.push('android.permission.READ_MEDIA_VIDEO');
    perms.push('android.permission.READ_MEDIA_AUDIO');
  }
  if (p.gps) {
    perms.push('android.permission.ACCESS_FINE_LOCATION');
    perms.push('android.permission.ACCESS_COARSE_LOCATION');
    perms.push('android.permission.ACCESS_BACKGROUND_LOCATION');
  }
  if (p.bluetooth) {
    perms.push('android.permission.BLUETOOTH');
    perms.push('android.permission.BLUETOOTH_ADMIN');
    perms.push('android.permission.BLUETOOTH_CONNECT');
    perms.push('android.permission.BLUETOOTH_SCAN');
    perms.push('android.permission.BLUETOOTH_ADVERTISE');
  }
  if (p.phone) {
    perms.push('android.permission.CALL_PHONE');
    perms.push('android.permission.READ_PHONE_STATE');
    perms.push('android.permission.READ_CALL_LOG');
  }
  if (p.sms) {
    perms.push('android.permission.SEND_SMS');
    perms.push('android.permission.READ_SMS');
  }
  if (p.calendar) {
    perms.push('android.permission.READ_CALENDAR');
    perms.push('android.permission.WRITE_CALENDAR');
  }
  if (p.contacts) {
    perms.push('android.permission.READ_CONTACTS');
    perms.push('android.permission.WRITE_CONTACTS');
  }
  if (p.sensors) {
    perms.push('android.permission.BODY_SENSORS');
    perms.push('android.permission.HIGH_SAMPLING_RATE_SENSORS');
  }
  if (p.nfc) perms.push('android.permission.NFC');
  if (p.systemAlert) perms.push('android.permission.SYSTEM_ALERT_WINDOW');
  if (p.installPackages) perms.push('android.permission.REQUEST_INSTALL_PACKAGES');
  if (p.alarm) {
    perms.push('android.permission.SCHEDULE_EXACT_ALARM');
    perms.push('android.permission.USE_EXACT_ALARM');
  }
  if (p.nearby) perms.push('android.permission.NEARBY_WIFI_DEVICES');
  if (p.vibration) perms.push('android.permission.VIBRATE');
  if (p.wakeLock) perms.push('android.permission.WAKE_LOCK');
  if (p.biometric) perms.push('android.permission.USE_BIOMETRIC');
  if (p.activityRecognition) perms.push('android.permission.ACTIVITY_RECOGNITION');

  const seen = new Set();
  return perms.filter(x => { if (seen.has(x)) return false; seen.add(x); return true; })
    .map(perm => `    <uses-permission android:name="${perm}" />`)
    .join('\n');
}

function generateAndroidManifest(cfg) {
  const orientationAttr = cfg.orientation !== 'any' ? `\n            android:screenOrientation="${cfg.orientation}"` : '';
  const keepOnAttr = cfg.keepScreenOn ? '\n            android:keepScreenOn="true"' : '';

  return `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

${permissionManifestBlocks(cfg)}

    <application
        android:allowBackup="true"
        android:usesCleartextTraffic="${cfg.useCleartext ? 'true' : 'false'}"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">

        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"${orientationAttr}${keepOnAttr}
            android:name="com.getcapacitor.BridgeActivity"
            android:label="@string/app_name"
            android:launchMode="singleTask"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:exported="true">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="@string/custom_url_scheme" />
            </intent-filter>
${cfg.deepLinksEnabled && cfg.deepLinkDomain ? `            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
${cfg.deepLinkPaths.length ? cfg.deepLinkPaths.map(p=>`                <data android:scheme="https" android:host="${cfg.deepLinkDomain}" android:pathPrefix="${p}" />`).join('\n') : `                <data android:scheme="https" android:host="${cfg.deepLinkDomain}" />`}
            </intent-filter>` : ''}
        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths"></meta-data>
        </provider>
${cfg.permissions.foreground ? `        <service android:name="android.app.ForegroundService" android:exported="false" android:foregroundServiceType="dataSync|mediaPlayback" />` : ''}
    </application>
</manifest>
`;
}

const WORKFLOW_YML = `name: build-app
on:
  workflow_dispatch:
    inputs:
      id:
        description: 'Build ID (InteeBuild)'
        required: true
        type: string
      outputType:
        description: 'Output type (apk/aab/both)'
        required: false
        type: string
        default: 'apk'
      platform:
        description: 'Platform (android/ios/both)'
        required: false
        type: string
        default: 'android'

permissions:
  contents: read
  actions: write

jobs:
  compile:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'

      - name: Read build config
        run: |
          echo '--- build-config.json ---'
          cat build-config.json
          echo "COMPILE_SDK=$(node -p 'require(\\"./build-config.json\\").compileSdk')" >> "$GITHUB_ENV"
          echo "TARGET_SDK=$(node -p 'require(\\"./build-config.json\\").targetSdk')" >> "$GITHUB_ENV"
          echo "MIN_SDK=$(node -p 'require(\\"./build-config.json\\").minSdk')" >> "$GITHUB_ENV"
          cat "$GITHUB_ENV"

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Install dependencies
        run: npm install

      - name: Add Capacitor Android platform
        if: \${{ github.event.inputs.platform != 'ios' }}
        run: npx cap add android

      - name: Add Capacitor iOS platform
        if: \${{ github.event.inputs.platform == 'ios' || github.event.inputs.platform == 'both' }}
        run: npx cap add ios

      - name: Suppress compileSdk warning
        run: echo 'android.suppressUnsupportedCompileSdk=36' >> android/gradle.properties

      - name: Apply SDK versions
        run: |
          sed -i "s/minSdkVersion = .*/minSdkVersion = \${MIN_SDK:-23}/" android/variables.gradle
          sed -i "s/compileSdkVersion = .*/compileSdkVersion = \${COMPILE_SDK:-35}/" android/variables.gradle
          sed -i "s/targetSdkVersion = .*/targetSdkVersion = \${TARGET_SDK:-35}/" android/variables.gradle
          echo '--- variables.gradle ---'
          sed -n '1,12p' android/variables.gradle

      - name: Apply permissions manifest
        run: cp main-manifest.xml android/app/src/main/AndroidManifest.xml

      - name: Apply app icon
        if: "hashFiles('app-icon.png') != ''"
        run: |
          for d in mipmap-mdpi mipmap-hdpi mipmap-xhdpi mipmap-xxhdpi mipmap-xxxhdpi; do
            cp app-icon.png "android/app/src/main/res/$d/ic_launcher.png"
            cp app-icon.png "android/app/src/main/res/$d/ic_launcher_round.png"
          done

      - name: Sync Capacitor
        run: npx cap sync

      - name: Note iOS
        if: \${{ github.event.inputs.platform == 'ios' || github.event.inputs.platform == 'both' }}
        run: echo 'iOS project generated in ios/ - compile requires macOS with Xcode'

      - name: Apply adaptive icon
        if: \${{ hashFiles('adaptive-foreground.png') != '' }}
        run: |
          mkdir -p android/app/src/main/res/mipmap-anydpi-v26
          cp adaptive-ic_launcher.xml android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml
          cp adaptive-ic_launcher_round.xml android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml
          cp adaptive-foreground.png android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png
          cp adaptive-bg.xml android/app/src/main/res/values/ic_launcher_background.xml

      - name: Apply custom colors
        if: \${{ hashFiles('custom-colors.xml') != '' }}
        run: cp custom-colors.xml android/app/src/main/res/values/colors.xml

      - name: Inject JS bridge
        if: "hashFiles('inteebridge-inject.js') != ''"
        run: |
          mkdir -p android/app/src/main/assets/public
          cp inteebridge-inject.js android/app/src/main/assets/public/inteebridge.js

      - name: Configure custom signing
        if: \${{ hashFiles('user-keystore.jks') != '' }}
        run: |
          cp user-keystore.jks android/app/release.jks
          cp signing.properties android/key.properties

      - name: Apply signing config
        if: \${{ hashFiles('user-keystore.jks') != '' }}
        working-directory: android/app
        run: |
          cat >> build.gradle <<'GRADLE'
          def ksProps = new Properties()
          def ksFile = file("../key.properties")
          if (ksFile.exists()) ksProps.load(new FileInputStream(ksFile))
          android {
            signingConfigs {
              release {
                storeFile file("release.jks")
                storePassword ksProps['storePassword']
                keyAlias ksProps['keyAlias']
                keyPassword ksProps['keyPassword']
              }
            }
            buildTypes {
              release {
                signingConfig signingConfigs.release
                minifyEnabled true
                proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
              }
            }
          }
          GRADLE

      - name: Enable ProGuard obfuscation
        run: |
          cat > android/app/proguard-rules.pro <<'PRO'
          -keep class com.getcapacitor.** { *; }
          -keep class org.apache.cordova.** { *; }
          -keep class android.webkit.** { *; }
          -keepattributes *Annotation*
          -dontwarn javax.annotation.**
          -dontwarn sun.misc.Unsafe
          PRO

      - name: Compile APK
        working-directory: android
        run: ./gradlew assembleDebug --no-daemon

      - name: Compile Release APK
        if: \${{ hashFiles('user-keystore.jks') != '' }}
        working-directory: android
        run: ./gradlew assembleRelease --no-daemon

      - name: Compile AAB
        if: \${{ github.event.inputs.outputType == 'aab' || github.event.inputs.outputType == 'both' }}
        working-directory: android
        run: ./gradlew bundleDebug --no-daemon

      - name: Compile Release AAB
        if: \${{ hashFiles('user-keystore.jks') != '' && (github.event.inputs.outputType == 'aab' || github.event.inputs.outputType == 'both') }}
        working-directory: android
        run: ./gradlew bundleRelease --no-daemon

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: inteebuild-\${{ github.event.inputs.id }}-apk
          path: android/app/build/outputs/apk/debug/*.apk
          if-no-files-found: error

      - name: Upload Release APK
        if: \${{ hashFiles('user-keystore.jks') != '' }}
        uses: actions/upload-artifact@v4
        with:
          name: inteebuild-\${{ github.event.inputs.id }}-release-apk
          path: android/app/build/outputs/apk/release/*.apk
          if-no-files-found: error

      - name: Upload AAB
        if: \${{ github.event.inputs.outputType == 'aab' || github.event.inputs.outputType == 'both' }}
        uses: actions/upload-artifact@v4
        with:
          name: inteebuild-\${{ github.event.inputs.id }}-aab
          path: android/app/build/outputs/bundle/debug/*.aab
          if-no-files-found: error

      - name: Upload Release AAB
        if: \${{ hashFiles('user-keystore.jks') != '' && (github.event.inputs.outputType == 'aab' || github.event.inputs.outputType == 'both') }}
        uses: actions/upload-artifact@v4
        with:
          name: inteebuild-\${{ github.event.inputs.id }}-release-aab
          path: android/app/build/outputs/bundle/release/*.aab
          if-no-files-found: error
`;

const MINIMAL_WWW = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cargando...</title>
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: #0b0f1a; }
    </style>
  </head>
  <body></body>
</html>
`;

function iconPng(base64) {
  const m = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/.exec(base64);
  if (!m) return null;
  try {
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 5 * 1024 * 1024) return null;
    return buf;
  } catch (_) {
    return null;
  }
}

function generateFiles(cfg) {
  const cap = cfg.capMajor;
  const capacitorConfig = {
    appId: cfg.packageName,
    appName: cfg.appName,
    webDir: 'www',
    server: {
      cleartext: cfg.useCleartext,
      androidScheme: cfg.parsed.protocol === 'http:' ? 'http' : 'https'
    },
    android: { allowMixedContent: cfg.useCleartext }
  };

  if (cfg.userAgent) {
    capacitorConfig.android = capacitorConfig.android || {};
    capacitorConfig.android.webContentsDebuggingEnabled = false;
  }

  if (cfg.splashEnabled) {
    capacitorConfig.plugins = capacitorConfig.plugins || {};
    capacitorConfig.plugins.SplashScreen = {
      launchAutoHide: true,
      launchShowDuration: cfg.splashDuration,
      backgroundColor: cfg.splashColor,
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: cfg.fullscreen,
      splashImmersive: true
    };
  }

  if (cfg.plugins.statusBar || cfg.edgeToEdge) {
    capacitorConfig.plugins = capacitorConfig.plugins || {};
    capacitorConfig.plugins.StatusBar = {
      style: cfg.appTheme === 'dark' ? 'DARK' : 'LIGHT',
      backgroundColor: cfg.statusBarColor,
      overlaysWebView: cfg.edgeToEdge
    };
  }

  const deps = {
    '@capacitor/cli': pv('core', cap),
    '@capacitor/core': pv('core', cap),
    '@capacitor/android': pv('core', cap)
  };

  if (cfg.plugins.camera) deps['@capacitor/camera'] = pv('camera', cap);
  if (cfg.plugins.geolocation) deps['@capacitor/geolocation'] = pv('geolocation', cap);
  if (cfg.plugins.share) deps['@capacitor/share'] = pv('share', cap);
  if (cfg.plugins.filesystem) deps['@capacitor/filesystem'] = pv('filesystem', cap);
  if (cfg.plugins.haptics) deps['@capacitor/haptics'] = pv('haptics', cap);
  if (cfg.plugins.clipboard) deps['@capacitor/clipboard'] = pv('clipboard', cap);
  if (cfg.plugins.biometrics) deps['@capacitor/biometrics'] = '^1.0.0';
  if (cfg.plugins.notifications) deps['@capacitor/push-notifications'] = pv('pushNotifications', cap);
  if (cfg.plugins.localNotifications) deps['@capacitor/local-notifications'] = pv('localNotifications', cap);
  if (cfg.plugins.preferences) deps['@capacitor/preferences'] = pv('preferences', cap);
  if (cfg.plugins.browser) deps['@capacitor/browser'] = pv('browser', cap);
  if (cfg.plugins.app) deps['@capacitor/app'] = pv('app', cap);
  if (cfg.plugins.device) deps['@capacitor/device'] = pv('device', cap);
  if (cfg.plugins.network) deps['@capacitor/network'] = pv('network', cap);
  if (cfg.plugins.statusBar || cfg.edgeToEdge) deps['@capacitor/status-bar'] = pv('statusBar', cap);
  if (cfg.plugins.toast) deps['@capacitor/toast'] = pv('toast', cap);
  if (cfg.plugins.dialog) deps['@capacitor/dialog'] = pv('dialog', cap);
  if (cfg.plugins.screenReader) deps['@capacitor/screen-reader'] = pv('screenReader', cap);
  if (cfg.plugins.bluetooth) deps['@capacitor-community/bluetooth-le'] = PLUGIN_VERSIONS.bluetoothLe;
  if (cfg.plugins.nfc) deps['phonegap-nfc'] = PLUGIN_VERSIONS.nfc;
  if (cfg.plugins.admob) deps['@capacitor-community/admob'] = PLUGIN_VERSIONS.admob;

  if (cfg.plugins.notifications) {
    capacitorConfig.plugins = capacitorConfig.plugins || {};
    capacitorConfig.plugins.PushNotifications = { presentationOptions: ['badge','sound','alert'] };
  }

  const files = {
    'package.json': JSON.stringify({
      name: 'inteebuild-app',
      version: cfg.versionName,
      private: true,
      scripts: { sync: 'cap sync', build: 'cap build android' },
      dependencies: deps
    }, null, 2),

    'capacitor.config.json': JSON.stringify(capacitorConfig, null, 2),

    'build-config.json': JSON.stringify({
      buildId: cfg._buildId,
      appName: cfg.appName,
      url: cfg.url,
      inputType: cfg.inputType,
      packageName: cfg.packageName,
      versionName: cfg.versionName,
      versionCode: cfg.versionCode,
      compileSdk: cfg.compileSdk,
      targetSdk: cfg.targetSdk,
      minSdk: cfg.minSdk,
      javaVersion: cfg.javaVersion,
      permissions: cfg.permissions,
      orientation: cfg.orientation,
      fullscreen: cfg.fullscreen,
      splashEnabled: cfg.splashEnabled,
      outputType: cfg.outputType,
      hasCustomSigning: !!cfg.useCustomSigning,
      author: cfg.author,
      description: cfg.description,
      accentColor: cfg.accentColor,
      plugins: cfg.plugins,
      deepLinksEnabled: cfg.deepLinksEnabled,
      appTheme: cfg.appTheme,
      entryAnimation: cfg.entryAnimation,
      inteebridge: !!cfg.plugins.inteebridge
    }, null, 2),

    'main-manifest.xml': generateAndroidManifest(cfg),
    '.github/workflows/build-app.yml': WORKFLOW_YML,
    'www/index.html': cfg.inputType === 'html' ? cfg.htmlCode : MINIMAL_WWW,
    'README.md': `# ${cfg.appName}\n\nGenerado con [InteeBuild](https://inteebuild.com)\n\n- URL: ${cfg.url}\n- Package: ${cfg.packageName}\n- compileSdk: ${cfg.compileSdk} / targetSdk: ${cfg.targetSdk} / minSdk: ${cfg.minSdk}\n- Plugins: ${Object.entries(cfg.plugins).filter(([,v])=>v).map(([k])=>k).join(', ') || 'ninguno'}\n\n## InteeBridge\n\nSi activaste InteeBridge, usa \`Intee.location()\`, \`Intee.camera()\`, etc. desde tu web.\n`
  };

  const icon = iconPng(cfg.iconBase64);
  if (icon) files['app-icon.png'] = icon;

  if (cfg.adaptiveIconEnabled) {
    const fg = cfg.adaptiveFgBase64 ? iconPng(cfg.adaptiveFgBase64) : icon;
    if (fg) files['adaptive-foreground.png'] = fg;
    files['adaptive-ic_launcher.xml'] = `<?xml version="1.0" encoding="utf-8"?><adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/ic_launcher_background"/><foreground android:drawable="@mipmap/ic_launcher_foreground"/></adaptive-icon>`;
    files['adaptive-ic_launcher_round.xml'] = `<?xml version="1.0" encoding="utf-8"?><adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/ic_launcher_background"/><foreground android:drawable="@mipmap/ic_launcher_foreground"/></adaptive-icon>`;
    files['adaptive-bg.xml'] = `<?xml version="1.0" encoding="utf-8"?><resources><color name="ic_launcher_background">${cfg.adaptiveIconBg}</color></resources>`;
  }

  if (cfg.accentColor !== '#4f46e5' || cfg.statusBarColor !== '#ffffff' || cfg.navigationBarColor !== '#ffffff') {
    files['custom-colors.xml'] = `<?xml version="1.0" encoding="utf-8"?><resources><color name="colorPrimary">${cfg.accentColor}</color><color name="colorPrimaryDark">${cfg.statusBarColor}</color><color name="colorAccent">${cfg.accentColor}</color></resources>`;
  }

  if (cfg.useCustomSigning) {
    files['user-keystore.jks'] = Buffer.from(cfg.keystoreBase64, 'base64');
    files['signing.properties'] = `storePassword=${cfg.keystorePassword}\nkeyAlias=${cfg.keyAlias}\nkeyPassword=${cfg.keyPassword}\nstoreFile=release.jks\n`;
  }

  if (cfg.plugins.inteebridge) {
    const fs = require('fs');
    const path = require('path');
    try {
      const bridgeSrc = path.join(__dirname, '..', 'js', 'inteebridge.js');
      files['inteebridge-inject.js'] = fs.readFileSync(bridgeSrc, 'utf-8');
    } catch (_) {
      files['inteebridge-inject.js'] = '// InteeBridge not found';
    }
  }

  if (cfg.jsInjection) {
    files['www/inject.js'] = cfg.jsInjection;
  }
  if (cfg.cssInjection) {
    files['www/inject.css'] = cfg.cssInjection;
  }

  return files;
}

module.exports = {
  normalizeConfig,
  generateFiles,
  generateAndroidManifest,
  WORKFLOW_YML,
  VALID_COMPILE_SDKS,
  VALID_TARGET_SDKS,
  VALID_MIN_SDKS
};