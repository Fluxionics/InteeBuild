'use strict';





const PERM_TO_KEYS = {
  'android.permission.POST_NOTIFICATIONS': ['notifications'],
  'android.permission.CAMERA': ['cameraMic'],
  'android.permission.RECORD_AUDIO': ['microphone', 'audioRecord'],
  'android.permission.MODIFY_AUDIO_SETTINGS': ['microphone'],
  'android.permission.READ_MEDIA_IMAGES': ['storage'],
  'android.permission.READ_MEDIA_VIDEO': ['storage'],
  'android.permission.READ_MEDIA_AUDIO': ['storage'],
  'android.permission.READ_EXTERNAL_STORAGE': ['readExternalStorage'],
  'android.permission.WRITE_EXTERNAL_STORAGE': ['writeExternalStorage'],
  'android.permission.MANAGE_EXTERNAL_STORAGE': ['manageExternalStorage'],
  'android.permission.ACCESS_FINE_LOCATION': ['gps', 'accessFineLocation'],
  'android.permission.ACCESS_COARSE_LOCATION': ['gps', 'accessCoarseLocation'],
  'android.permission.ACCESS_BACKGROUND_LOCATION': ['gpsBackground', 'accessBackgroundLocation'],
  'android.permission.FOREGROUND_SERVICE_LOCATION': ['advGeo'],
  'android.permission.BLUETOOTH_SCAN': ['bluetoothScan'],
  'android.permission.BLUETOOTH_CONNECT': ['bluetoothConnect'],
  'android.permission.BLUETOOTH_ADVERTISE': ['bluetoothAdvertise'],
  'android.permission.BLUETOOTH': ['bluetooth'],
  'android.permission.BLUETOOTH_ADMIN': ['bluetooth'],
  'android.permission.CALL_PHONE': ['phone', 'callPhone'],
  'android.permission.READ_PHONE_STATE': ['phone', 'readPhoneState'],
  'android.permission.READ_PHONE_NUMBERS': ['readPhoneNumber'],
  'android.permission.READ_CALL_LOG': ['phone', 'readCallLog'],
  'android.permission.ANSWER_PHONE_CALLS': ['answerPhone'],
  'android.permission.SEND_SMS': ['sms', 'sendSms'],
  'android.permission.READ_SMS': ['sms', 'readSms'],
  'android.permission.RECEIVE_SMS': ['receiveSms'],
  'android.permission.RECEIVE_MMS': ['receiveMms'],
  'android.permission.READ_CONTACTS': ['contacts', 'readContacts'],
  'android.permission.WRITE_CONTACTS': ['contacts', 'writeContacts'],
  'android.permission.READ_CALENDAR': ['calendar', 'readCalendar'],
  'android.permission.WRITE_CALENDAR': ['calendar', 'writeCalendar'],
  'android.permission.BODY_SENSORS': ['sensors', 'bodySensors'],
  'android.permission.HIGH_SAMPLING_RATE_SENSORS': ['sensors', 'highSamplingRateSensors'],
  'android.permission.ACTIVITY_RECOGNITION': ['activityRecognition'],
  'android.permission.NFC': ['nfc'],
  'android.permission.SYSTEM_ALERT_WINDOW': ['systemAlert', 'systemAlertWindow'],
  'android.permission.REQUEST_INSTALL_PACKAGES': ['installPackages', 'requestInstallPackages'],
  'android.permission.SCHEDULE_EXACT_ALARM': ['alarmSchedule', 'scheduleExactAlarm'],
  'android.permission.USE_EXACT_ALARM': ['alarmUse', 'useExactAlarm'],
  'android.permission.NEARBY_WIFI_DEVICES': ['nearby', 'nearbyWifiDevices'],
  'android.permission.VIBRATE': ['vibration', 'vibrate'],
  'android.permission.WAKE_LOCK': ['wakeLock'],
  'android.permission.USE_BIOMETRIC': ['biometric', 'advSecurity'],
  'android.permission.USE_FINGERPRINT': ['biometric'],
  'android.permission.FOREGROUND_SERVICE': ['foreground', 'foregroundService'],
  'android.permission.FOREGROUND_SERVICE_DATA_SYNC': ['foreground', 'foregroundService'],
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK': ['foreground', 'foregroundService'],
  'android.permission.FOREGROUND_SERVICE_LOCATION': ['advGeo'],
  'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS': ['powerMgmt'],
  'android.permission.GET_ACCOUNTS': ['getAccounts', 'socialAnalytics'],
  'android.permission.TRANSMIT_IR': ['infrared'],
  'android.permission.CHANGE_WIFI_STATE': ['changeWifiState'],
  'android.permission.CHANGE_NETWORK_STATE': ['changeNetworkState'],
  'android.permission.USE_EXACT_ALARM': ['alarmUse'],
  'android.permission.INTERNET': [],
  'android.permission.ACCESS_NETWORK_STATE': [],
  'android.permission.ACCESS_WIFI_STATE': []
};

function mapPermsToKeys(perms) {
  const out = {};
  (perms || []).forEach((p) => {
    const keys = PERM_TO_KEYS[p] || PERM_TO_KEYS[String(p).toLowerCase()] || null;
    if (keys) keys.forEach((k) => { out[k] = true; });
    else {

      const short = String(p).split('.').pop().replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
      if (short) out['raw_' + short] = true;
    }
  });

  if (out.gpsBackground || out.accessBackgroundLocation) out.advGeo = out.advGeo || true;
  if (out.cameraMic && out.ar === undefined && out._hasAr) out.ar = true;
  return out;
}




function decodeAxml(buf) {
  const res = { binary: false, strings: [], package: null, versionName: null, versionCode: null, minSdk: null, targetSdk: null, permissions: [], features: [], label: null, debuggable: false, allowBackup: null };
  try {
    if (!buf || buf.length < 8) return res;
    if (buf.readUInt16LE(0) !== 0x0003 || buf.readUInt16LE(2) !== 0x0008) return res; 
    res.binary = true;
    let off = 8; 
    const strings = [];

    while (off + 8 <= buf.length) {
      const type = buf.readUInt16LE(off);
      const headerSize = buf.readUInt16LE(off + 2);
      const size = buf.readUInt32LE(off + 4);
      if (size < 8 || off + size > buf.length) break;
      if (type === 0x0001) {
        const strCount = buf.readUInt32LE(off + 8);
        const styleCount = buf.readUInt32LE(off + 12);
        const flags = buf.readUInt32LE(off + 16);
        const stringsStart = buf.readUInt32LE(off + 20);
        const isUtf8 = (flags & (1 << 8)) !== 0;
        const offsetsOff = off + 28;
        for (let i = 0; i < strCount && i < 20000; i++) {
          const strOff = buf.readUInt32LE(offsetsOff + i * 4);
          const base = off + stringsStart + strOff;
          if (base >= buf.length) continue;
          try {
            if (isUtf8) {

              let p = base;
              const charLen = buf.readUInt16LE(p); p += 2;
              let byteLen = buf[p]; p += 1;
              if (byteLen & 0x80) { byteLen = ((byteLen & 0x7f) << 8) | buf[p]; p += 1; }
              if (p + byteLen > buf.length) continue;
              strings.push(buf.toString('utf8', p, p + byteLen));
            } else {
              const charLen = buf.readUInt16LE(base);
              const p = base + 2;
              if (p + charLen * 2 > buf.length) continue;
              strings.push(buf.toString('utf16le', p, p + charLen * 2));
            }
          } catch (_) {   }
        }
        break; 
      }
      off += size;
      if (off <= headerSize) break;
    }
    res.strings = strings;
    const join = strings.join('\n');

    const pkgRe = /[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+/g;
    let m; const cands = [];
    while ((m = pkgRe.exec(join)) !== null) { if (m[0].length < 80) cands.push(m[0]); }
    const pref = cands.find((s) => /^(com|io|app|net|org|dev|mx|es)\./.test(s) && !s.includes('permission') && !s.includes('android'));
    if (pref) res.package = pref;

    res.permissions = [...new Set(strings.filter((s) => s.startsWith('android.permission.') || s.startsWith('com.android.vending.')))];

    res.features = [...new Set(strings.filter((s) => s.startsWith('android.hardware.') || s.startsWith('android.software.')))];

    const vi = strings.findIndex((s) => /^\d+(\.\d+){0,3}$/.test(s) && s.length <= 12);
    if (vi >= 0) res.versionName = strings[vi];

    const labelCand = strings.filter((s) => s.length >= 2 && s.length <= 40 && !s.includes('.') && !s.includes('/') && !/^android/i.test(s)).slice(0, 5);
    if (labelCand.length) res.label = labelCand[0];

    if (!res.permissions.length) {
      const raw = buf.toString('latin1');
      const found = [...raw.matchAll(/android\.permission\.([A-Z_]+)/g)].map((x) => 'android.permission.' + x[1]);
      res.permissions = [...new Set(found)];
    }

    const idxMin = strings.findIndex((s) => s === 'minSdkVersion');
    if (idxMin >= 0) { for (let i = idxMin + 1; i < Math.min(strings.length, idxMin + 4); i++) { const n = Number(strings[i]); if (n >= 1 && n <= 40) { res.minSdk = n; break; } } }
    const idxT = strings.findIndex((s) => s === 'targetSdkVersion');
    if (idxT >= 0) { for (let i = idxT + 1; i < Math.min(strings.length, idxT + 4); i++) { const n = Number(strings[i]); if (n >= 1 && n <= 40) { res.targetSdk = n; break; } } }
  } catch (_) {   }
  return res;
}



function parseDex(buf) {
  const res = { valid: false, classCount: 0, methodCount: 0, stringCount: 0, libs: [], hasDroncito: false, hasCapacitor: false, hasAr: false, hasMlkit: false, hasWeb3j: false, hasMqtt: false, hasGvr: false, hasFirebase: false, hasAdmob: false, hasInteeBridge: false };
  try {
    if (!buf || buf.length < 112) return res;
    if (buf.toString('utf8', 0, 4) !== 'dex\n') return res;
    res.valid = true;
    res.stringCount = buf.readUInt32LE(56);
    res.typeCount = buf.readUInt32LE(64);
    res.methodCount = buf.readUInt32LE(88);
    res.classCount = buf.readUInt32LE(96);
    const stringIdsOff = buf.readUInt32LE(60);
    const dataOff = buf.readUInt32LE(108);
    const dataSize = buf.readUInt32LE(104);
    const maxScan = Math.min(res.stringCount, 3000);
    const blobs = [];
    for (let i = 0; i < maxScan; i++) {
      const ptrOff = stringIdsOff + i * 4;
      if (ptrOff + 4 > buf.length) break;
      const strOff = buf.readUInt32LE(ptrOff);
      if (strOff >= buf.length) continue;

      let p = strOff; let len = 0; let shift = 0;
      for (let b = 0; b < 3; b++) { const c = buf[p++]; len |= (c & 0x7f) << shift; if (!(c & 0x80)) break; shift += 7; }
      if (p + len > buf.length || len > 500) continue;
      try { blobs.push(buf.toString('utf8', p, p + len)); } catch (_) {}
      if (p - dataOff > Math.min(dataSize, 400000)) break; 
    }
    const all = blobs.join('\n');
    const has = (s) => all.includes(s);
    res.hasCapacitor = has('Lcom/getcapacitor/') || has('Capacitor');
    res.hasDroncito = has('DroncitoBridge') || has('Ldroncito');
    res.hasInteeBridge = has('InteeBridge') || has('inteebridge');
    res.hasAr = has('Lcom/google/ar/core/') || has('SceneView') || has('filament');
    res.hasMlkit = has('Lcom/google/mlkit/') || has('mlkit');
    res.hasWeb3j = has('Lorg/web3j/') || has('web3j');
    res.hasMqtt = has('Lorg/eclipse/paho/') || has('mqtt');
    res.hasGvr = has('Lcom/google/vr/') || has('Gvr') || has('Cardboard');
    res.hasFirebase = has('Lcom/google/firebase/') || has('google-services');
    res.hasAdmob = has('Lcom/google/android/gms/ads/') || has('AdMob') || has('admob');
    if (res.hasCapacitor) res.libs.push('capacitor');
    if (res.hasDroncito) res.libs.push('droncito');
    if (res.hasInteeBridge) res.libs.push('inteebridge');
    if (res.hasAr) res.libs.push('arcore');
    if (res.hasMlkit) res.libs.push('mlkit');
    if (res.hasWeb3j) res.libs.push('web3j');
    if (res.hasMqtt) res.libs.push('mqtt');
    if (res.hasGvr) res.libs.push('gvr');
    if (res.hasFirebase) res.libs.push('firebase');
    if (res.hasAdmob) res.libs.push('admob');
    res.sampleStrings = blobs.filter((s) => s.length > 2 && s.length < 120).slice(0, 40);
  } catch (_) {}
  return res;
}

function buildImportPermissions(axmlPerms, dex) {
  const keys = mapPermsToKeys(axmlPerms);

  if (dex) {
    if (dex.hasAr) { keys.ar = true; keys.cameraMic = keys.cameraMic || true; }
    if (dex.hasMlkit) { keys.aiSuite = true; }
    if (dex.hasWeb3j) { keys.blockchain = true; }
    if (dex.hasMqtt) { keys.iot = true; }
    if (dex.hasGvr) { keys.vr = true; }
    if (dex.hasAdmob) { keys.ads = true; }
    if (dex.hasFirebase) { keys.firebase = true; }
  }
  return keys;
}

function readableManifestPreview(axml) {
  if (!axml || (!axml.binary && !axml.permissions.length)) return '';
  const L = [];
  L.push('<?xml version="1.0" encoding="utf-8"?>');
  L.push('<!-- Decodificado por InteeBuild Decompiler (string-pool AXML + heurística) -->');
  L.push('<manifest package="' + (axml.package || 'desconocido') + '"' + (axml.versionName ? ' versionName="' + axml.versionName + '"' : '') + (axml.versionCode ? ' versionCode="' + axml.versionCode + '"' : '') + '>');
  axml.permissions.forEach((p) => L.push('    <uses-permission android:name="' + p + '" />'));
  axml.features.forEach((f) => L.push('    <uses-feature android:name="' + f + '" android:required="false" />'));
  if (axml.minSdk || axml.targetSdk) L.push('    <!-- minSdk=' + (axml.minSdk || '?') + ' targetSdk=' + (axml.targetSdk || '?') + ' -->');
  L.push('</manifest>');
  return L.join('\n');
}

module.exports = { PERM_TO_KEYS, mapPermsToKeys, decodeAxml, parseDex, buildImportPermissions, readableManifestPreview };
