'use strict';

const { PERMISSION_SPEC } = require('./permissions');

function permissionManifestBlocks(cfg) {
  const perms = [
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.ACCESS_WIFI_STATE'
  ];
  const p = cfg.permissions;
  Object.entries(p).forEach(([k,v])=>{
    if(v && PERMISSION_SPEC[k]) perms.push(...PERMISSION_SPEC[k].manifest);
  });
  if(cfg.notifySchedEnabled && !p.notifications && !p.foreground){
    perms.push(...PERMISSION_SPEC.notifications.manifest);
  }
  if (cfg.iapEnabled) perms.push('com.android.vending.BILLING');
  if (cfg.encryptedStorage) { perms.push('android.permission.USE_BIOMETRIC'); }

  const seen = new Set();
  return perms.filter(x => { if (seen.has(x)) return false; seen.add(x); return true; })
    .map(perm => `    <uses-permission android:name="${perm}" />`)
    .join('\n');
}




function hardwareFeatureBlocks(cfg) {
  const p = cfg.permissions || {};
  const has = (...keys) => keys.some(k => p[k]);
  const feats = [];
  if (has('cameraMic', 'cameraFlash', 'cameraAutoFocus', 'videoCapture')) feats.push('android.hardware.camera');
  if (has('bluetooth', 'bluetoothScan', 'bluetoothConnect', 'bluetoothAdvertise', 'bluetoothPrivileged')) feats.push('android.hardware.bluetooth_le');
  if (has('gps', 'accessFineLocation', 'accessCoarseLocation', 'gpsBackground', 'accessBackgroundLocation')) feats.push('android.hardware.location.gps');
  if (has('nfc')) feats.push('android.hardware.nfc');
  if (has('microphone', 'audioRecord')) feats.push('android.hardware.microphone');
  if (has('sensors', 'bodySensors')) feats.push('android.hardware.sensor.heartrate');

  if (has('ar')) { feats.push('android.hardware.camera.ar'); feats.push('android.hardware.camera'); }
  if (has('envSensors')) { feats.push('android.hardware.sensor.accelerometer'); feats.push('android.hardware.sensor.gyroscope'); feats.push('android.hardware.sensor.barometer'); }
  if (has('aiSuite')) feats.push('android.hardware.camera');
  if (has('advGeo')) feats.push('android.hardware.location.gps');

  if (has('vr')) { feats.push('android.hardware.vr.headtracking'); feats.push('android.software.vr.mode'); }
  if (has('mr')) { feats.push('android.hardware.camera.ar'); feats.push('android.hardware.vr.headtracking'); }
  if (has('iot')) feats.push('android.hardware.bluetooth_le');
  if (has('emoAI')) feats.push('android.hardware.camera');
  return [...new Set(feats)]
    .map(f => `    <uses-feature android:name="${f}" android:required="false" />`)
    .join('\n');
}


function nfcTechFilterXml() {
  return `<?xml version="1.0" encoding="utf-8"?>\n<resources xmlns:xliff="urn:oasis:names:tc:xliff:document">\n    <tech-list>\n        <tech>android.nfc.tech.NfcA</tech>\n        <tech>android.nfc.tech.NfcB</tech>\n        <tech>android.nfc.tech.NfcF</tech>\n        <tech>android.nfc.tech.NfcV</tech>\n        <tech>android.nfc.tech.Ndef</tech>\n        <tech>android.nfc.tech.NdefFormatable</tech>\n        <tech>android.nfc.tech.IsoDep</tech>\n        <tech>android.nfc.tech.MifareClassic</tech>\n        <tech>android.nfc.tech.MifareUltralight</tech>\n    </tech-list>\n</resources>\n`;
}


function generateAndroidManifest(cfg) {
  const orientationAttr = cfg.orientation !== 'any' ? `\n            android:screenOrientation="${cfg.orientation}"` : '';
  const keepOnAttr = cfg.keepScreenOn ? '\n            android:keepScreenOn="true"' : '';

  const hasSplash = cfg.splashEnabled && cfg.splashImageBase64;
  const themeColor = cfg.themeColor || '#4f46e5';
  const navBarTransparent = cfg.navBarTransparent || false;

  return `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

${permissionManifestBlocks(cfg)}
${hardwareFeatureBlocks(cfg)}

    <application
        android:allowBackup="true"
        android:usesCleartextTraffic="${cfg.useCleartext ? 'true' : 'false'}"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:networkSecurityConfig="@xml/network_security_config">

        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"${orientationAttr}${keepOnAttr}
            android:name="${cfg.provider==='native' || cfg.provider==='gecko' || cfg.provider==='droncito' ? '.MainActivity' : 'com.getcapacitor.BridgeActivity'}"
            android:label="@string/app_name"
            android:launchMode="singleTask"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:exported="true">
${hasSplash ? '' : `            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>`}

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
${cfg.permissions.nfc ? `            <intent-filter>
                <action android:name="android.nfc.action.TECH_DISCOVERED" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
            <meta-data
                android:name="android.nfc.action.TECH_DISCOVERED"
                android:resource="@xml/nfc_tech_filter" />` : ''}
        </activity>
${hasSplash ? `        <activity
            android:name=".SplashActivity"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:exported="true"
            android:screenOrientation="portrait">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>` : ''}

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths"></meta-data>
        </provider>
${cfg.admobAppId ? `        <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="${cfg.admobAppId}" />
        <meta-data android:name="com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT" android:value="true" />` : ''}
${cfg.permissions.ar ? `        <meta-data android:name="com.google.ar.core" android:value="required" />` : ''}
${cfg.permissions.foreground ? `        <service android:name=".RadioService" android:exported="false" android:foregroundServiceType="dataSync|mediaPlayback${cfg.permissions.advGeo ? '|location' : ''}" android:enabled="true" android:stopWithTask="false" />` : ''}
${cfg.permissions.advGeo && !cfg.permissions.foreground ? `        <service android:name=".DroncitoGeoService" android:exported="false" android:foregroundServiceType="location" />` : ''}
    </application>
</manifest>
`;
}


function patchNfcSrc() {
  return [
    "const fs = require('fs');",
    "const p = 'android/capacitor-cordova-android-plugins/src/main/java/com/chariotsolutions/nfc/plugin/NfcPlugin.java';",
    "if (!fs.existsSync(p)) { console.log('NfcPlugin no presente, patch NFC omitido'); process.exit(0); }",
    "let src = fs.readFileSync(p, 'utf8');",
    "const before = src;",
    "src = src.replace(/nfcAdapter\\.setNdefPushMessage\\([^;]*;/g, '');",
    "src = src.replace(/nfcAdapter\\.setOnNdefPushCompleteCallback\\([^;]*;/g, '');",
    "src = src.replace(/nfcAdapter\\.setBeamPushUris\\([^;]*;/g, '');",
    "src = src.replace(/!nfcAdapter\\.isNdefPushEnabled\\(\\)/g, 'true');",
    "if (src !== before) fs.writeFileSync(p, src);",
    "console.log('NFC Beam parcheado:' + (src !== before));"
  ].join('\n') + '\n';
}


module.exports = {
  permissionManifestBlocks,
  hardwareFeatureBlocks,
  nfcTechFilterXml,
  patchNfcSrc,
  generateAndroidManifest
};
