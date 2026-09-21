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

// Hardware declarado honestamente: required=false para no filtrar en Play,
// pero visible en el APK y en el Audit.

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
        android:theme="@style/AppTheme">

        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"${orientationAttr}${keepOnAttr}
            android:name="${cfg.provider==='native' || cfg.provider==='gecko' ? '.MainActivity' : 'com.getcapacitor.BridgeActivity'}"
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
${cfg.permissions.nfc ? `            <intent-filter>
                <action android:name="android.nfc.action.TECH_DISCOVERED" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
            <meta-data
                android:name="android.nfc.action.TECH_DISCOVERED"
                android:resource="@xml/nfc_tech_filter" />` : ''}
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
${cfg.admobAppId ? `        <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="${cfg.admobAppId}" />
        <meta-data android:name="com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT" android:value="true" />` : ''}
${cfg.permissions.foreground ? `        <service android:name=".RadioService" android:exported="false" android:foregroundServiceType="dataSync|mediaPlayback" android:enabled="true" android:stopWithTask="false" />` : ''}
    </application>
</manifest>
`;
}


module.exports = {
  permissionManifestBlocks,
  hardwareFeatureBlocks,
  nfcTechFilterXml,
  generateAndroidManifest
};
