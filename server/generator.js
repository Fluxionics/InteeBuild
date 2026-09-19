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

const PERMISSION_SPEC = {
  notifications: { title:'Notificaciones', manifest:['android.permission.POST_NOTIFICATIONS'], runtime:true, minSdk:33, deps:['@capacitor/push-notifications','@capacitor/local-notifications'], api:'notifications', handler:'LocalNotifications', impl:{native:'LocalNotifications.schedule+requestPermissions', bridge:'Intee.notifications.schedule', webview:'Notification.requestPermission', providerOk:['capacitor','native']}, specialAccess:null },
  foreground: { title:'Foreground Service', manifest:['android.permission.FOREGROUND_SERVICE','android.permission.FOREGROUND_SERVICE_DATA_SYNC','android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK'], runtime:false, minSdk:28, deps:[], api:'foreground', handler:'RadioService', impl:{native:'RadioService.startForeground', bridge:'n/a (sistema)', webview:'n/a', providerOk:['capacitor','native','gecko']}, specialAccess:null },
  cameraMic: { title:'Cámara', manifest:['android.permission.CAMERA'], runtime:true, minSdk:23, deps:['@capacitor/camera'], api:'camera', handler:'Camera', impl:{native:'NativePermissions.request(CAMERA)+Capacitor Camera.getPhoto', bridge:'Intee.camera', webview:'getUserMedia video (WebChromeClient grant)', providerOk:['capacitor','native']}, specialAccess:null },
  microphone: { title:'Micrófono', manifest:['android.permission.RECORD_AUDIO','android.permission.MODIFY_AUDIO_SETTINGS'], runtime:true, minSdk:23, deps:['@capacitor/haptics'], api:'microphone', handler:'Microphone', impl:{native:'NativePermissions.request(RECORD_AUDIO)', bridge:'getUserMedia audio', webview:'getUserMedia audio (grant selectivo)', providerOk:['capacitor','native']}, specialAccess:null },
  storage: { title:'Almacenamiento multimedia', manifest:['android.permission.READ_MEDIA_IMAGES','android.permission.READ_MEDIA_VIDEO','android.permission.READ_MEDIA_AUDIO'], runtime:true, minSdk:33, deps:['@capacitor/filesystem'], api:'filesystem', handler:'Filesystem', impl:{native:'Filesystem.read/write + FileProvider', bridge:'Intee.files', webview:'input file + DownloadManager', providerOk:['capacitor','native']}, specialAccess:null, legacyNote:'READ_EXTERNAL_STORAGE solo para API<33, se omite si targetSdk>=33' },
  gps: { title:'Ubicación precisa', manifest:['android.permission.ACCESS_FINE_LOCATION','android.permission.ACCESS_COARSE_LOCATION'], runtime:true, minSdk:23, deps:['@capacitor/geolocation'], api:'geolocation', handler:'Geolocation', impl:{native:'NativePermissions.request(FINE/COARSE)+Geolocation.getCurrentPosition', bridge:'Intee.location', webview:'geolocation API (grant solo si gps)', providerOk:['capacitor','native']}, specialAccess:null },
  gpsBackground: { title:'Ubicación en segundo plano', manifest:['android.permission.ACCESS_BACKGROUND_LOCATION'], runtime:true, minSdk:29, deps:['@capacitor/geolocation'], api:'geolocation-bg', handler:'GeolocationBg', impl:{native:'request BACKGROUND tras FINE concedido', bridge:'watchLocation', webview:'n/a', providerOk:['capacitor','native']}, specialAccess:'Play Store: requiere justificación + aprobación, solicitar solo si la app lo necesita' },
  bluetoothScan: { title:'Bluetooth · Escanear', manifest:['android.permission.BLUETOOTH_SCAN'], runtime:true, minSdk:31, deps:['@capacitor-community/bluetooth-le'], api:'bluetooth', handler:'BluetoothLe', impl:{native:'request SCAN (neverForLocation si aplica)', bridge:'Intee bluetooth (BLE)', webview:'navigator.bluetooth.requestDevice', providerOk:['capacitor','native']}, specialAccess:null },
  bluetoothConnect: { title:'Bluetooth · Conectar', manifest:['android.permission.BLUETOOTH_CONNECT'], runtime:true, minSdk:31, deps:['@capacitor-community/bluetooth-le'], api:'bluetooth', handler:'BluetoothLe', impl:{native:'request CONNECT', bridge:'BLE connect', webview:'navigator.bluetooth', providerOk:['capacitor','native']}, specialAccess:null },
  bluetoothAdvertise: { title:'Bluetooth · Anunciar', manifest:['android.permission.BLUETOOTH_ADVERTISE'], runtime:true, minSdk:31, deps:['@capacitor-community/bluetooth-le'], api:'bluetooth', handler:'BluetoothLe', impl:{native:'request ADVERTISE', bridge:'BLE advertise', webview:'n/a', providerOk:['capacitor','native']}, specialAccess:null },
  bluetooth: { title:'Bluetooth (compat API<31)', manifest:['android.permission.BLUETOOTH','android.permission.BLUETOOTH_ADMIN'], runtime:true, minSdk:23, maxSdk:30, deps:['@capacitor-community/bluetooth-le'], api:'bluetooth', handler:'BluetoothLe', impl:{native:'legacy BLUETOOTH/ADMIN', bridge:'BLE', webview:'navigator.bluetooth', providerOk:['capacitor','native']}, specialAccess:null, legacyNote:'Solo para minSdk<=30, en API31+ se usan SCAN/CONNECT/ADVERTISE' },
  phone: { title:'Teléfono', manifest:['android.permission.CALL_PHONE','android.permission.READ_PHONE_STATE','android.permission.READ_CALL_LOG'], runtime:true, minSdk:23, deps:[], api:'phone', handler:'Phone', impl:{native:'request CALL_PHONE', bridge:'tel: intent', webview:'tel: → Intent nativo', providerOk:['capacitor','native']}, specialAccess:'Play Store restringido' },
  sms: { title:'SMS', manifest:['android.permission.SEND_SMS','android.permission.READ_SMS'], runtime:true, minSdk:23, deps:[], api:'sms', handler:'Sms', impl:{native:'request SMS', bridge:'sms: intent', webview:'sms: → Intent', providerOk:['capacitor','native']}, specialAccess:'Play Store restringido' },
  calendar: { title:'Calendario', manifest:['android.permission.READ_CALENDAR','android.permission.WRITE_CALENDAR'], runtime:true, minSdk:23, deps:[], api:'calendar', handler:'Calendar', impl:{native:'request CALENDAR', bridge:'n/a', webview:'n/a', providerOk:['capacitor','native']}, specialAccess:null },
  contacts: { title:'Contactos', manifest:['android.permission.READ_CONTACTS','android.permission.WRITE_CONTACTS'], runtime:true, minSdk:23, deps:[], api:'contacts', handler:'Contacts', impl:{native:'request CONTACTS', bridge:'n/a', webview:'n/a', providerOk:['capacitor','native']}, specialAccess:null },
  sensors: { title:'Sensores', manifest:['android.permission.BODY_SENSORS','android.permission.HIGH_SAMPLING_RATE_SENSORS'], runtime:true, minSdk:23, deps:[], api:'sensors', handler:'Sensors', impl:{native:'request BODY_SENSORS', bridge:'n/a', webview:'Generic Sensor API', providerOk:['capacitor','native']}, specialAccess:null },
  nfc: { title:'NFC', manifest:['android.permission.NFC'], runtime:false, minSdk:19, deps:['phonegap-nfc'], api:'nfc', handler:'NFC', impl:{native:'NfcAdapter', bridge:'NDEFReader', webview:'NDEFReader (Chrome)', providerOk:['capacitor','native']}, specialAccess:null },
  systemAlert: { title:'Superposición', manifest:['android.permission.SYSTEM_ALERT_WINDOW'], runtime:false, minSdk:23, deps:[], api:'systemAlert', handler:'SystemAlert', impl:{native:'Settings.canDrawOverlays intent', bridge:'n/a', webview:'n/a', providerOk:['capacitor','native']}, specialAccess:'Acceso especial: Settings.ACTION_MANAGE_OVERLAY_PERMISSION' },
  installPackages: { title:'Instalador', manifest:['android.permission.REQUEST_INSTALL_PACKAGES'], runtime:false, minSdk:26, deps:[], api:'installPackages', handler:'Install', impl:{native:'canRequestPackageInstalls', bridge:'n/a', webview:'n/a', providerOk:['capacitor','native']}, specialAccess:'Play Store restringido' },
  alarmSchedule: { title:'Alarmas exactas (SCHEDULE)', manifest:['android.permission.SCHEDULE_EXACT_ALARM'], runtime:false, minSdk:31, deps:[], api:'alarm', handler:'AlarmSchedule', impl:{native:'AlarmManager.canScheduleExactAlarms', bridge:'LocalNotifications schedule', webview:'n/a', providerOk:['capacitor','native']}, specialAccess:'Acceso especial revocable por usuario (recomendado)' },
  alarmUse: { title:'Alarmas exactas (USE, casos limitados)', manifest:['android.permission.USE_EXACT_ALARM'], runtime:false, minSdk:31, deps:[], api:'alarm', handler:'AlarmUse', impl:{native:'USE_EXACT_ALARM (reloj/calendario)', bridge:'LocalNotifications', webview:'n/a', providerOk:['capacitor','native']}, specialAccess:'Solo reloj/alarma/calendario, Play lo verifica' },
  alarm: { title:'Alarmas (legacy selector)', manifest:['android.permission.SCHEDULE_EXACT_ALARM'], runtime:false, minSdk:31, deps:[], api:'alarm', handler:'AlarmSchedule', impl:{native:'SCHEDULE por defecto', bridge:'LocalNotifications', webview:'n/a', providerOk:['capacitor','native']}, specialAccess:'Usa alarmSchedule, alarmUse solo si aplica' },
  nearby: { title:'WiFi Cercano', manifest:['android.permission.NEARBY_WIFI_DEVICES'], runtime:true, minSdk:33, deps:[], api:'nearby', handler:'Nearby', impl:{native:'request NEARBY_WIFI', bridge:'n/a', webview:'n/a', providerOk:['capacitor','native']}, specialAccess:null },
  vibration: { title:'Vibración', manifest:['android.permission.VIBRATE'], runtime:false, minSdk:1, deps:['@capacitor/haptics'], api:'vibration', handler:'Haptics', impl:{native:'Vibrator', bridge:'Intee.vibrate', webview:'navigator.vibrate', providerOk:['capacitor','native']}, specialAccess:null },
  wakeLock: { title:'Wake Lock', manifest:['android.permission.WAKE_LOCK'], runtime:false, minSdk:1, deps:['@capacitor/device'], api:'wakelock', handler:'WakeLock', impl:{native:'PowerManager WakeLock', bridge:'screen.keepOn', webview:'WakeLock API', providerOk:['capacitor','native']}, specialAccess:null },
  biometric: { title:'Biometría', manifest:['android.permission.USE_BIOMETRIC'], runtime:false, minSdk:28, deps:['@capacitor/biometrics'], api:'biometric', handler:'Biometric', impl:{native:'BiometricPrompt', bridge:'Intee.biometric', webview:'WebAuthn', providerOk:['capacitor','native']}, specialAccess:null },
  activityRecognition: { title:'Actividad', manifest:['android.permission.ACTIVITY_RECOGNITION'], runtime:true, minSdk:29, deps:[], api:'activityRecognition', handler:'Activity', impl:{native:'request ACTIVITY_RECOGNITION', bridge:'n/a', webview:'n/a', providerOk:['capacitor','native']}, specialAccess:null }
};

function pv(name, cap) {
  const v = PLUGIN_VERSIONS[name];
  if (!v) return '^1.0.0';
  if (typeof v === 'string') return v;
  return v[cap] || v[7];
}

function getPermissionAudit(cfg){
  const selected = Object.entries(cfg.permissions||{}).filter(([,v])=>v).map(([k])=>k);
  const targetSdk = cfg.targetSdk||35;
  const provider = cfg.provider||'capacitor';
  let manifestXml='';
  try{ manifestXml = permissionManifestBlocks(cfg); }catch{ manifestXml=''; }
  const needsRuntimeGlobal = Object.entries(cfg.permissions||{}).some(([k,v])=>v && PERMISSION_SPEC[k]?.runtime);
  const res = selected.map(key=>{
    const spec = PERMISSION_SPEC[key];
    if(!spec) return {key, title:key, manifest:'MISSING', runtime:'MISSING', native:'MISSING', bridge:'MISSING', version:'UNKNOWN', special:null, status:'fail', verified:false};
    const manifestInSpec = spec.manifest.length ? 'OK' : 'MISSING';
    const manifestGenerated = spec.manifest.every(m=>manifestXml.includes(m));
    const manifest = manifestGenerated ? 'GENERATED OK' : (manifestInSpec==='OK' ? 'SPEC OK, NOT GENERATED' : 'MISSING');
    const needsRuntime = !!spec.runtime;
    const nativeGenerated = !needsRuntime || needsRuntimeGlobal;
    const runtime = !needsRuntime ? 'N/A (install-time/special)' : (!nativeGenerated ? 'MISSING (sin NativePermissions.java)' : (targetSdk >= spec.minSdk ? 'GENERATED (NativePermissions.request + MainActivity patch)' : 'REQUIRES ANDROID '+spec.minSdk+'+'));
    const impl = spec.impl || {};
    const native = impl.native ? (nativeGenerated || !needsRuntime ? 'GENERATED ('+impl.native.slice(0,70)+')' : 'SPEC ONLY, NOT GENERATED') : (spec.handler ? 'DECLARED ('+spec.handler+')' : 'MISSING');
    const bridge = impl.bridge || 'n/a';
    const providerOk = !impl.providerOk || impl.providerOk.includes(provider) ? 'OK ('+provider+')' : 'WARN (provider '+provider+' no soporta)';
    const version = (spec.minSdk && targetSdk < spec.minSdk) ? 'WARN' : ((spec.maxSdk && targetSdk > spec.maxSdk) ? 'WARN (solo hasta API '+spec.maxSdk+')' : 'OK');
    const verified = manifestGenerated && (!needsRuntime || nativeGenerated);
    let status='ok';
    if(!verified || native.includes('MISSING') || native.includes('SPEC ONLY')) status='fail';
    else if(version!=='OK' || providerOk.startsWith('WARN') || spec.specialAccess) status='warn';
    if(key==='gpsBackground' && !cfg.permissions.gps) status='fail';
    return {key, title:spec.title, manifest, runtime, native, bridge, handler:spec.handler, version, special:spec.specialAccess||spec.legacyNote||null, provider:providerOk, status, minSdk:spec.minSdk, api:spec.api, verified};
  });
  const ok=res.filter(r=>r.status==='ok').length;
  const total=res.length;
  const readiness = total? Math.round((ok/total)*100) : 100;
  return {items:res, ok, total, readiness, canBuild: res.every(r=>r.status!=='fail'), verifiedAll: res.every(r=>r.verified)};
}

function suggestPermissionsFromApis(detectedApis){
  const map={ geolocation:'gps', camera:'cameraMic', microphone:'microphone', bluetooth:'bluetooth', nfc:'nfc', notifications:'notifications', vibration:'vibration', share:'share', wakelock:'wakeLock', clipboard:'clipboard' };
  return (detectedApis||[]).map(api=>map[api]).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).map(k=>({key:k, spec:PERMISSION_SPEC[k]}));
}

function normalizeConfig(raw) {
  const appNameRaw = String(raw.appName || '').trim();
  if (appNameRaw && !/^[\p{L}\p{N} _\-.]{2,40}$/u.test(appNameRaw)) {
    throw Object.assign(new Error('Nombre de app no válido. Solo letras, números, espacios, guiones y puntos (2-40 caracteres). Ejemplo: Mi Tienda'), { status: 400 });
  }
  const appName = appNameRaw.slice(0, 40) || 'My Web App';
  const inputType = raw.inputType === 'html' ? 'html' : 'url';
  const htmlCode = inputType === 'html' ? String(raw.htmlCode || '').trim() : '';
  const url = inputType === 'url' ? String(raw.url || '').trim() : 'https://localhost';

  if (inputType === 'url') {
    let parsed;
    try {
      parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error();
    } catch (_) {
      throw Object.assign(new Error('URL no válida. Debe empezar con http:// o https://. Ejemplo: https://mi-tienda.com'), { status: 400 });
    }
  }

  if (inputType === 'html' && !htmlCode) {
    throw Object.assign(new Error('Debes proporcionar código HTML. Pega tu página o usa "Descargar ejemplo HTML" para inspirarte.'), { status: 400 });
  }

  let packageName = String(raw.packageName || '').trim().toLowerCase();
  if (!packageName) {
    const slug = appName.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'app';
    packageName = `com.inteebuild.${slug}`;
  }
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName)) {
    throw Object.assign(new Error('Package ID no válido. Solo minúsculas, números y puntos, con al menos un punto. Ejemplo: com.miempresa.miapp'), { status: 400 });
  }
  const versionName = String(raw.versionName || '1.0.0').slice(0, 20) || '1.0.0';
  if (!/^\d+(\.\d+){0,3}$/.test(versionName)) {
    throw Object.assign(new Error('Versión no válida. Usa números separados por puntos. Ejemplo: 1.0.0'), { status: 400 });
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
    gpsBackground: !!raw?.permissions?.gpsBackground,
    bluetooth: !!raw?.permissions?.bluetooth,
    bluetoothScan: !!raw?.permissions?.bluetoothScan,
    bluetoothConnect: !!raw?.permissions?.bluetoothConnect,
    bluetoothAdvertise: !!raw?.permissions?.bluetoothAdvertise,
    phone: !!raw?.permissions?.phone,
    sms: !!raw?.permissions?.sms,
    calendar: !!raw?.permissions?.calendar,
    contacts: !!raw?.permissions?.contacts,
    sensors: !!raw?.permissions?.sensors,
    nfc: !!raw?.permissions?.nfc,
    systemAlert: !!raw?.permissions?.systemAlert,
    installPackages: !!raw?.permissions?.installPackages,
    alarm: !!raw?.permissions?.alarm,
    alarmSchedule: !!raw?.permissions?.alarmSchedule,
    alarmUse: !!raw?.permissions?.alarmUse,
    nearby: !!raw?.permissions?.nearby,
    vibration: !!raw?.permissions?.vibration,
    wakeLock: !!raw?.permissions?.wakeLock,
    biometric: !!raw?.permissions?.biometric,
    microphone: !!raw?.permissions?.microphone,
    activityRecognition: !!raw?.permissions?.activityRecognition
  };
  // Compat: legacy single bluetooth -> granular; legacy alarm -> schedule
  if (permissions.bluetooth && !permissions.bluetoothScan && !permissions.bluetoothConnect && !permissions.bluetoothAdvertise) {
    if ((Number(raw.minSdk)||23) >= 31 || (Number(raw.targetSdk)||35) >= 31) {
      permissions.bluetoothScan = true; permissions.bluetoothConnect = true;
    }
  }
  if (permissions.alarm && !permissions.alarmSchedule && !permissions.alarmUse) permissions.alarmSchedule = true;

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

  // Auto-enable native plugins when permission is checked -> permissions now truly native
  if (permissions.gps || permissions.gpsBackground) plugins.geolocation = true;
  if (permissions.cameraMic) { plugins.camera = true; plugins.haptics = true; }
  if (permissions.microphone) plugins.haptics = true;
  if (permissions.storage) plugins.filesystem = true;
  if (permissions.bluetooth || permissions.bluetoothScan || permissions.bluetoothConnect || permissions.bluetoothAdvertise) plugins.bluetooth = true;
  if (permissions.nfc) plugins.nfc = true;
  if (permissions.vibration) plugins.haptics = true;
  if (permissions.biometric) plugins.biometrics = true;
  if (permissions.notifications || permissions.foreground || raw?.notifySchedEnabled) { plugins.localNotifications = true; plugins.notifications = true; }
  if (permissions.alarmSchedule || permissions.alarmUse || permissions.alarm) { plugins.localNotifications = true; }
  if (permissions.wakeLock) { plugins.device = true; }
  if (permissions.contacts) plugins.contacts = true;
  if (permissions.calendar) plugins.calendar = true;

  const provider = ['capacitor','native','twa','gecko','cordova','flutter','tauri'].includes(String(raw.provider||'').toLowerCase()) ? String(raw.provider).toLowerCase() : 'capacitor';
  const providerVersion = String(raw.providerVersion||'').slice(0,20) || (provider==='capacitor' ? (compileSdk>=35?'7':'6') : '1.0');
  const minify = !!raw.minify;
  const pwaEnabled = raw.pwaEnabled !== undefined ? !!raw.pwaEnabled : true;
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
  const notifyOnOpen = !!raw.notifyOnOpen;
  const notifyOnClose = !!raw.notifyOnClose;
  const notifyDelayMinutes = Math.max(0, Math.min(1440, Number(raw.notifyDelayMinutes) || 0));
  const notifySchedEnabled = notifyOnOpen || notifyOnClose || notifyDelayMinutes > 0;
  const appTheme = ['light','dark','system'].includes(raw.appTheme) ? raw.appTheme : 'system';
  const entryAnimation = ['none','fade','slide'].includes(raw.entryAnimation) ? raw.entryAnimation : 'none';
  const userAgent = String(raw.userAgent||'').slice(0,256);
  const jsInjection = String(raw.jsInjection||'').slice(0,20000);
  const cssInjection = String(raw.cssInjection||'').slice(0,20000);
  const cacheMode = ['normal','no-cache','force-cache'].includes(raw.cacheMode) ? raw.cacheMode : 'normal';
  const backButtonBehavior = ['back','exit','confirm','none'].includes(raw.backButtonBehavior) ? raw.backButtonBehavior : 'back';
  const customHeaders = typeof raw.customHeaders === 'string' ? raw.customHeaders.slice(0,2000) : '';
  const webhookUrl = typeof raw.webhookUrl === 'string' && /^https?:\/\//.test(raw.webhookUrl.trim()) ? raw.webhookUrl.trim().slice(0,500) : '';
  // === Catalogo Consolidado: nuevas capacidades ===
  const pullRefresh = !!raw.pullRefresh;
  const offlineScreen = raw.offlineScreen !== undefined ? !!raw.offlineScreen : true;
  const offlineMessage = String(raw.offlineMessage || 'Sin conexión. Revisa tu internet.').slice(0,120);
  const flagSecure = !!raw.flagSecure;
  const blockSelection = !!raw.blockSelection;
  const downloadManager = raw.downloadManager !== undefined ? !!raw.downloadManager : true;
  const drawerEnabled = !!raw.drawerEnabled;
  const drawerItems = Array.isArray(raw.drawerItems) ? raw.drawerItems.slice(0,8).map(i=>({label:String(i.label||'').slice(0,30), url:String(i.url||'').slice(0,500), icon:String(i.icon||'').slice(0,20)})) : [];
  const bottomNavEnabled = !!raw.bottomNavEnabled;
  const bottomNavItems = Array.isArray(raw.bottomNavItems) ? raw.bottomNavItems.slice(0,5).map(i=>({label:String(i.label||'').slice(0,20), url:String(i.url||'').slice(0,500), icon:String(i.icon||'').slice(0,20)})) : [];
  const loadingIndicator = ['none','spinner','bar'].includes(raw.loadingIndicator) ? raw.loadingIndicator : 'spinner';
  const admobAppId = String(raw.admobAppId||'').slice(0,100);
  const admobInterstitial = !!raw.admobInterstitial;
  const admobRewarded = !!raw.admobRewarded;
  const iapEnabled = !!raw.iapEnabled;
  const iapProducts = Array.isArray(raw.iapProducts) ? raw.iapProducts.slice(0,10).map(s=>String(s).slice(0,80)) : [];
  const encryptedStorage = !!raw.encryptedStorage;
  const rootDetection = !!raw.rootDetection;
  const firebaseEnabled = !!raw.firebaseEnabled;
  const firebaseConfig = typeof raw.firebaseConfig === 'string' ? raw.firebaseConfig.slice(0,5000) : '';
  const twaEnabled = !!raw.twaEnabled;
  const twaDomain = String(raw.twaDomain||'').slice(0,120).replace(/^https?:\/\//,'');
  const desktopEnabled = !!raw.desktopEnabled;
  const desktopPlatform = ['win','mac','both'].includes(raw.desktopPlatform) ? raw.desktopPlatform : 'both';

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

  let iosP12Base64 = null;
  let iosP12Password = '';
  let iosProfileBase64 = null;
  let useIosSigning = false;
  const rawP12 = typeof raw.iosP12Base64 === 'string' ? raw.iosP12Base64.trim() : '';
  if (rawP12) {
    const m12 = /^data:.*?;base64,(.+)$/.exec(rawP12);
    const b12 = m12 ? m12[1] : rawP12;
    if (b12.length > 100 && b12.length < 200000) {
      try { Buffer.from(b12, 'base64'); iosP12Base64 = b12; } catch (_) {}
    }
  }
  const rawProf = typeof raw.iosProfileBase64 === 'string' ? raw.iosProfileBase64.trim() : '';
  if (rawProf) {
    const mp = /^data:.*?;base64,(.+)$/.exec(rawProf);
    const bp = mp ? mp[1] : rawProf;
    if (bp.length > 100 && bp.length < 200000) {
      try { Buffer.from(bp, 'base64'); iosProfileBase64 = bp; } catch (_) {}
    }
  }
  if (iosP12Base64 && iosProfileBase64) {
    iosP12Password = String(raw.iosP12Password || '').slice(0, 128);
    useIosSigning = !!iosP12Password;
    if (!useIosSigning) { iosP12Base64 = null; iosProfileBase64 = null; }
  }
  const iosExportMethod = ['development', 'ad-hoc', 'app-store'].includes(raw.iosExportMethod) ? raw.iosExportMethod : 'development';

  return {
    appName, inputType, htmlCode, url,
    parsed: inputType === 'url' ? new URL(url) : { protocol: 'https:', href: 'https://localhost' },
    packageName,
    versionCode: Math.max(1, Number(raw.versionCode) || 1),
    versionName,
    compileSdk, targetSdk, minSdk, capMajor,
    npmVersion: CAPACITOR_VERSIONS[capMajor].npm,
    javaVersion: CAPACITOR_VERSIONS[capMajor].java,
    permissions, plugins, orientation, fullscreen, hideNavBar, keepScreenOn,
    splashEnabled, splashColor, splashDuration, outputType, useCleartext,
    author, description, accentColor, statusBarColor, navigationBarColor,
    edgeToEdge, adaptiveIconEnabled, adaptiveIconBg, adaptiveFgBase64,
    deepLinksEnabled, deepLinkDomain, deepLinkPaths,
    notifChannel, notifImportance, notifSound, notifVibration,
    notifyOnOpen, notifyOnClose, notifyDelayMinutes, notifySchedEnabled,
    notifyTitle: String(raw.notifyTitle || '').slice(0, 60) || appName,
    notifyText: String(raw.notifyText || '').slice(0, 200),
    appTheme, entryAnimation, userAgent, jsInjection, cssInjection,
    cacheMode, backButtonBehavior, customHeaders, webhookUrl,
    provider, providerVersion,
    minify, pwaEnabled,
    pullRefresh, offlineScreen, offlineMessage, flagSecure, blockSelection, downloadManager,
    drawerEnabled, drawerItems, bottomNavEnabled, bottomNavItems, loadingIndicator,
    admobAppId, admobInterstitial, admobRewarded, iapEnabled, iapProducts,
    encryptedStorage, rootDetection, firebaseEnabled, firebaseConfig,
    twaEnabled, twaDomain, desktopEnabled, desktopPlatform,
    useCustomSigning, keystoreBase64, keystorePassword, keyAlias, keyPassword,
    useIosSigning, iosP12Base64, iosP12Password, iosProfileBase64, iosExportMethod,
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
${cfg.admobAppId ? `        <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="${cfg.admobAppId}" />` : ''}
${cfg.permissions.foreground ? `        <service android:name=".RadioService" android:exported="false" android:foregroundServiceType="dataSync|mediaPlayback" />` : ''}
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
        run: |
          echo "ANDROID_HOME=$ANDROID_HOME"
          echo "SDK check"
          ls -la "$ANDROID_HOME/cmdline-tools" || true
          yes | sdkmanager --licenses || true
          sdkmanager --install "platform-tools" "platforms;android-35" "build-tools;35.0.0" 2>&1 | tail -20 || true
          echo "SDK ready"

      - name: Install dependencies
        run: npm install

      - name: Add Capacitor Android platform
        if: \${{ github.event.inputs.platform != 'ios' }}
        run: npx cap add android

      - name: Add Capacitor iOS platform
        if: \${{ github.event.inputs.platform == 'ios' || github.event.inputs.platform == 'both' }}
        run: npx cap add ios

      - name: Sync Capacitor
        run: npx cap sync

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
        run: |
          cp main-manifest.xml android/app/src/main/AndroidManifest.xml
          echo "--- permisos aplicados ---"
          grep -o 'android:name="[^"]*"' android/app/src/main/AndroidManifest.xml

      - name: Validate manifest XML
        run: python3 -c "import xml.dom.minidom,sys;xml.dom.minidom.parse('android/app/src/main/AndroidManifest.xml');print('manifest XML OK')"

      - name: Install native permissions runtime
        if: "hashFiles('NativePermissions.java') != ''"
        run: |
          PKG=$(node -p 'require("./build-config.json").packageName')
          DST="android/app/src/main/java/$(echo $PKG | tr . /)"
          mkdir -p "$DST"
          cp NativePermissions.java "$DST/NativePermissions.java"
          node patch-permissions.js
          echo "--- permisos nativos instalados ---"
          grep -c NativePermissions "$DST/MainActivity.java" || true

      - name: Install catalog native patches
        if: "hashFiles('patch-catalog.js') != ''"
        run: |
          node patch-catalog.js
          echo "--- catalog patches aplicados ---"
          PKG=$(node -p 'require("./build-config.json").packageName')
          grep -c "FLAG_SECURE\|DownloadListener" "android/app/src/main/java/$(echo $PKG | tr . /)/MainActivity.java" || true

      - name: Apply provider WebView (pro)
        run: |
          PROVIDER=$(node -p 'require("./build-config.json").provider')
          PKG=$(node -p 'require("./build-config.json").packageName')
          DST="android/app/src/main/java/$(echo $PKG | tr . /)"
          echo "Provider: $PROVIDER"
          if [ "$PROVIDER" = "native" ] && [ -f "native-MainActivity.java" ]; then cp native-MainActivity.java "$DST/MainActivity.java"; echo "native webview applied"; fi
          if [ "$PROVIDER" = "gecko" ] && [ -f "gecko-MainActivity.java" ]; then cp gecko-MainActivity.java "$DST/MainActivity.java"; echo "geckoview applied"; fi
          if [ "$PROVIDER" = "cordova" ] && [ -f "config.xml" ]; then cp config.xml ./config.xml; echo "cordova config applied"; fi
          cat provider.json || true

      - name: Install background audio service
        if: "hashFiles('RadioService.java') != ''"
        run: |
          PKG=$(node -p 'require("./build-config.json").packageName')
          DST="android/app/src/main/java/$(echo $PKG | tr . /)"
          mkdir -p "$DST"
          cp RadioService.java "$DST/RadioService.java"
          node patch-main-activity.js
          echo "--- servicio instalado ---"
          grep -c RadioService "$DST/MainActivity.java"

      - name: Apply app icon
        if: "hashFiles('app-icon.png') != ''"
        run: |
          for d in mipmap-mdpi mipmap-hdpi mipmap-xhdpi mipmap-xxhdpi mipmap-xxxhdpi; do
            cp app-icon.png "android/app/src/main/res/$d/ic_launcher.png"
            cp app-icon.png "android/app/src/main/res/$d/ic_launcher_round.png"
          done

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

      - name: Apply catalog assets
        run: |
          if [ -f "assetlinks.json" ]; then mkdir -p android/app/src/main/assets/.well-known; cp assetlinks.json android/app/src/main/assets/.well-known/assetlinks.json; echo "assetlinks ok"; fi
          if [ -f "google-services.json" ]; then cp google-services.json android/app/google-services.json; echo "firebase ok"; fi
          if [ -f "www/catalog.js" ]; then mkdir -p android/app/src/main/assets/public; cp www/catalog.js android/app/src/main/assets/public/catalog.js; echo "catalog js ok"; fi

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
          -keep class * extends android.app.Service { *; }
          -keep class android.webkit.** { *; }
          -keepattributes *Annotation*
          -dontwarn javax.annotation.**
          -dontwarn sun.misc.Unsafe
          PRO

      - name: Compile APK
        if: \${{ github.event.inputs.outputType == 'apk' || github.event.inputs.outputType == 'both' }}
        working-directory: android
        run: ./gradlew assembleDebug --no-daemon

      - name: Compile Release APK
        if: \${{ hashFiles('user-keystore.jks') != '' && (github.event.inputs.outputType == 'apk' || github.event.inputs.outputType == 'both') }}
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
        if: \${{ github.event.inputs.outputType == 'apk' || github.event.inputs.outputType == 'both' }}
        uses: actions/upload-artifact@v4
        with:
          name: inteebuild-\${{ github.event.inputs.id }}-apk
          path: android/app/build/outputs/apk/debug/*.apk
          if-no-files-found: error

      - name: Upload Release APK
        if: \${{ hashFiles('user-keystore.jks') != '' && (github.event.inputs.outputType == 'apk' || github.event.inputs.outputType == 'both') }}
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

  ios-check:
    if: \${{ github.event.inputs.platform == 'ios' || github.event.inputs.platform == 'both' }}
    runs-on: macos-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: npm install

      - name: Add iOS platform
        run: npx cap add ios

      - name: Sync iOS
        run: npx cap sync ios

      - name: Validate iOS build (simulador)
        if: \${{ hashFiles('ios-cert.p12') == '' }}
        run: |
          cd ios/App
          xcodebuild -project App.xcodeproj -scheme App -sdk iphonesimulator -configuration Debug build CODE_SIGNING_ALLOWED=NO

      - name: Note App Store
        if: \${{ hashFiles('ios-cert.p12') == '' }}
        run: echo 'Proyecto iOS validado. Para IPA instalable sube tu certificado .p12 + perfil .mobileprovision en el paso Firma.'

      - name: Sign and export IPA
        if: \${{ hashFiles('ios-cert.p12') != '' }}
        run: node ios-sign.js

      - name: Upload IPA
        if: \${{ hashFiles('ios-cert.p12') != '' }}
        uses: actions/upload-artifact@v4
        with:
          name: inteebuild-\${{ github.event.inputs.id }}-ipa
          path: /tmp/ib-export/*.ipa
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

function radioServiceSrc(pkg) {
  return 'package ' + pkg + ';\n'
    + '\n'
    + 'import android.app.Notification;\n'
    + 'import android.app.NotificationChannel;\n'
    + 'import android.app.NotificationManager;\n'
    + 'import android.app.Service;\n'
    + 'import android.content.Intent;\n'
    + 'import android.os.Build;\n'
    + 'import android.os.IBinder;\n'
    + 'import androidx.core.app.NotificationCompat;\n'
    + '\n'
    + 'public class RadioService extends Service {\n'
    + '    private static final String CHANNEL_ID = "inteebuild_radio";\n'
    + '\n'
    + '    @Override\n'
    + '    public void onCreate() {\n'
    + '        super.onCreate();\n'
    + '        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);\n'
    + '        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {\n'
    + '            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Reproduccion en segundo plano", NotificationManager.IMPORTANCE_LOW);\n'
    + '            nm.createNotificationChannel(ch);\n'
    + '        }\n'
    + '        Notification n = new NotificationCompat.Builder(this, CHANNEL_ID)\n'
    + '                .setContentTitle(getString(getApplicationInfo().labelRes))\n'
    + '                .setContentText("Reproduciendo en segundo plano")\n'
    + '                .setSmallIcon(android.R.drawable.ic_media_play)\n'
    + '                .setOngoing(true)\n'
    + '                .build();\n'
    + '        startForeground(1, n);\n'
    + '    }\n'
    + '\n'
    + '    @Override\n'
    + '    public int onStartCommand(Intent intent, int flags, int startId) {\n'
    + '        return START_STICKY;\n'
    + '    }\n'
    + '\n'
    + '    @Override\n'
    + '    public IBinder onBind(Intent intent) {\n'
    + '        return null;\n'
    + '    }\n'
    + '}\n';
}

function nativePermissionsJavaSrc(pkg) {
  return 'package ' + pkg + ';\n'
    + '\n'
    + 'import android.Manifest;\n'
    + 'import android.content.pm.PackageManager;\n'
    + 'import android.os.Build;\n'
    + 'import androidx.core.app.ActivityCompat;\n'
    + 'import androidx.core.content.ContextCompat;\n'
    + 'import java.util.ArrayList;\n'
    + 'import java.util.List;\n'
    + '\n'
    + 'public class NativePermissions {\n'
    + '    public static String[] getRequiredPermissions(android.content.Context ctx) {\n'
    + '        List<String> perms = new ArrayList<>();\n'
    + '        try {\n'
    + '            String[] declared = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), android.content.pm.PackageManager.GET_PERMISSIONS).requestedPermissions;\n'
    + '            if (declared == null) return new String[0];\n'
    + '            for (String p : declared) {\n'
    + '                if (p.equals(Manifest.permission.INTERNET) || p.equals(Manifest.permission.ACCESS_NETWORK_STATE) || p.equals(Manifest.permission.ACCESS_WIFI_STATE) || p.equals(Manifest.permission.VIBRATE) || p.equals(Manifest.permission.WAKE_LOCK) || p.equals(Manifest.permission.FOREGROUND_SERVICE) || p.equals(Manifest.permission.FOREGROUND_SERVICE_DATA_SYNC) || p.equals(Manifest.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK) || p.equals(Manifest.permission.USE_BIOMETRIC) || p.equals(Manifest.permission.NFC) || p.equals(Manifest.permission.REQUEST_INSTALL_PACKAGES) || p.equals(Manifest.permission.SYSTEM_ALERT_WINDOW)) {\n'
    + '                    // not runtime or handled separately, but still need check for some\n'
    + '                    if (p.equals(Manifest.permission.NFC) || p.equals(Manifest.permission.USE_BIOMETRIC)) perms.add(p);\n'
    + '                    continue;\n'
    + '                }\n'
    + '                if (p.startsWith("android.permission.")) {\n'
    + '                    if (ContextCompat.checkSelfPermission(ctx, p) != PackageManager.PERMISSION_GRANTED) perms.add(p);\n'
    + '                    else if (p.equals(Manifest.permission.POST_NOTIFICATIONS) || p.equals(Manifest.permission.ACCESS_FINE_LOCATION) || p.equals(Manifest.permission.CAMERA) || p.equals(Manifest.permission.RECORD_AUDIO)) perms.add(p);\n'
    + '                }\n'
    + '            }\n'
    + '        } catch (Exception ignored) {}\n'
    + '        // dedup\n'
    + '        java.util.LinkedHashSet<String> set=new java.util.LinkedHashSet<>(perms);\n'
    + '        return set.toArray(new String[0]);\n'
    + '    }\n'
    + '    public static void requestAll(android.app.Activity act, int code) {\n'
    + '        String[] req = getRequiredPermissions(act);\n'
    + '        List<String> need = new ArrayList<>();\n'
    + '        for (String p : req) if (ContextCompat.checkSelfPermission(act, p) != PackageManager.PERMISSION_GRANTED) need.add(p);\n'
    + '        if (!need.isEmpty()) ActivityCompat.requestPermissions(act, need.toArray(new String[0]), code);\n'
    + '    }\n'
    + '}\n';
}

function patchPermissionsSrc() {
  const NL = String.fromCharCode(10);
  return [
    "const fs=require('fs');",
    "const NL=String.fromCharCode(10);",
    "const pkg=JSON.parse(fs.readFileSync('build-config.json','utf8')).packageName;",
    "const mp='android/app/src/main/java/'+pkg.split('.').join('/')+'/MainActivity.java';",
    "let src=fs.readFileSync(mp,'utf8');",
    "let changed=false;",
    "if(src.indexOf('NativePermissions')===-1){",
    "  src=src.replace(/import\\s+com\\.getcapacitor\\.BridgeActivity\\s*;/,'import android.Manifest; import android.content.pm.PackageManager; import android.webkit.PermissionRequest; import android.webkit.WebChromeClient; import androidx.core.content.ContextCompat; import com.getcapacitor.BridgeActivity;');",
    "  src=src.replace(/public class MainActivity extends BridgeActivity\\s*\\{/,m=>m+NL+'  private static final int REQ_PERMS=9001;'+NL+'  private boolean hasPerm(String p){ try{ return ContextCompat.checkSelfPermission(this,p)==PackageManager.PERMISSION_GRANTED; }catch(Exception e){ return false; }}'+NL+'  private boolean wants(String res){ try{ String[] declared=getPackageManager().getPackageInfo(getPackageName(),PackageManager.GET_PERMISSIONS).requestedPermissions; if(declared==null) return false; for(String d:declared){ if(res.contains(\"VIDEO\")&&(d.equals(Manifest.permission.CAMERA))) return true; if(res.contains(\"AUDIO\")&&(d.equals(Manifest.permission.RECORD_AUDIO)||d.equals(Manifest.permission.MODIFY_AUDIO_SETTINGS))) return true; if(res.contains(\"GEOLOCATION\")&&(d.equals(Manifest.permission.ACCESS_FINE_LOCATION)||d.equals(Manifest.permission.ACCESS_COARSE_LOCATION))) return true; } return false; }catch(Exception e){ return false; }}'+NL+'  @Override public void onStart(){ super.onStart(); try{ NativePermissions.requestAll(this, REQ_PERMS);}catch(Exception ignored){}}'+NL+'  @Override public void onRequestPermissionsResult(int c,String[] p,int[] r){ super.onRequestPermissionsResult(c,p,r); }');",
    "  if(src.indexOf('onPermissionRequest')===-1){",
    "    src=src.replace(/super\\.onCreate\\(savedInstanceState\\);/,s=>s+NL+'    try{ getBridge().getWebView().setWebChromeClient(new WebChromeClient(){ @Override public void onPermissionRequest(final PermissionRequest request){ runOnUiThread(new Runnable(){ public void run(){ try{ String[] res=request.getResources(); java.util.List<String> ok=new java.util.ArrayList<>(); for(String r:res){ if(r.contains(\"VIDEO\")&&wants(r)&&hasPerm(Manifest.permission.CAMERA)) ok.add(r); else if(r.contains(\"AUDIO\")&&wants(r)&&hasPerm(Manifest.permission.RECORD_AUDIO)) ok.add(r); else if(r.contains(\"GEOLOCATION\")&&wants(r)&&(hasPerm(Manifest.permission.ACCESS_FINE_LOCATION)||hasPerm(Manifest.permission.ACCESS_COARSE_LOCATION))) ok.add(r); } if(!ok.isEmpty()) request.grant(ok.toArray(new String[0])); else request.deny(); }catch(Exception e){ try{request.deny();}catch(Exception ignored){}} }}); } }); }catch(Exception ignored){}');",
    "  }",
    "  fs.writeFileSync(mp,src); changed=true;",
    "}",
    "console.log('Permissions patch applied:'+changed+' hasNative:'+(src.indexOf('NativePermissions')!==-1));"
  ].join(NL)+NL;
}

function catalogUiJsSrc(cfg){
  const drawerItems = JSON.stringify(cfg.drawerItems||[]);
  const bottomItems = JSON.stringify(cfg.bottomNavItems||[]);
  return '(function(){var CFG='+JSON.stringify({pullRefresh:cfg.pullRefresh, offlineScreen:cfg.offlineScreen, offlineMessage:cfg.offlineMessage, flagSecure:cfg.flagSecure, blockSelection:cfg.blockSelection, drawerEnabled:cfg.drawerEnabled, bottomNavEnabled:cfg.bottomNavEnabled, loadingIndicator:cfg.loadingIndicator, rootDetection:cfg.rootDetection})+';var DRAWER='+drawerItems+';var BOTTOM='+bottomItems+';'
   + 'if(CFG.blockSelection){var s=document.createElement("style");s.textContent="*{ -webkit-user-select:none; user-select:none; -webkit-touch-callout:none;} input,textarea{ -webkit-user-select:text; user-select:text;}";document.head.appendChild(s);document.addEventListener("contextmenu",e=>e.preventDefault());}'
   + 'if(CFG.loadingIndicator!=="none"){window.addEventListener("beforeunload",()=>{var el=document.createElement("div");el.id="ib-loading";el.style.cssText="position:fixed;top:0;left:0;right:0;height:3px;background:var(--accent,#6366f1);z-index:9999;animation:ibLoad 1s infinite";if(CFG.loadingIndicator==="spinner")el.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.5);display:grid;place-items:center;z-index:9999";el.innerHTML=CFG.loadingIndicator==="spinner"?"<div style=\'width:40px;height:40px;border:4px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite\'></div>":"";document.body.appendChild(el);});}'
   + 'if(CFG.pullRefresh&&window.Capacitor){document.addEventListener("DOMContentLoaded",()=>{let startY=0;document.addEventListener("touchstart",e=>startY=e.touches[0].clientY,{passive:true});document.addEventListener("touchend",e=>{let dy=e.changedTouches[0].clientY-startY;if(dy>80&&window.scrollY===0) location.reload();},{passive:true});});}'
   + 'if(CFG.offlineScreen){function check(){var off=!navigator.onLine;var el=document.getElementById("ib-offline");if(off){if(!el){el=document.createElement("div");el.id="ib-offline";el.style.cssText="position:fixed;inset:0;background:#111827;color:#fff;display:grid;place-items:center;z-index:9998;text-align:center;padding:20px";el.innerHTML="<div><div style=\'font-size:48px;margin-bottom:12px\'>📡</div><b>Sin conexión</b><p style=\'color:#9ca3af\'>"+CFG.offlineMessage.replace(/"/g,"&quot;")+"</p><button onclick=\'location.reload()\' style=\'margin-top:12px;padding:8px 16px;background:#6366f1;color:#fff;border:none;border-radius:8px\'>Reintentar</button></div>";document.body.appendChild(el);} } else if(el) el.remove();}window.addEventListener("online",check);window.addEventListener("offline",check);document.addEventListener("DOMContentLoaded",check);}'
   + 'if(CFG.drawerEnabled&&DRAWER.length){var btn=document.createElement("button");btn.textContent="☰";btn.style.cssText="position:fixed;top:12px;left:12px;z-index:9997;background:#111827;color:#fff;border:none;width:36px;height:36px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.3)";var drawer=document.createElement("div");drawer.id="ib-drawer";drawer.style.cssText="position:fixed;top:0;left:-280px;width:260px;height:100%;background:#111827;color:#fff;z-index:9998;transition:left .3s;overflow:auto;padding:16px";drawer.innerHTML="<b style=\'display:block;margin-bottom:12px\'>Menú</b>"+DRAWER.map(i=>"<a href=\'"+i.url+"\' style=\'display:block;padding:10px 8px;color:#fff;text-decoration:none;border-radius:6px;margin-bottom:4px;background:#1f2937\'>"+(i.icon?i.icon+" ":"")+i.label+"</a>").join("")+"<button id=\'ib-drawer-close\' style=\'margin-top:12px;width:100%;padding:8px;background:#374151;color:#fff;border:none;border-radius:6px\'>Cerrar</button>";document.addEventListener("DOMContentLoaded",()=>{document.body.appendChild(btn);document.body.appendChild(drawer);btn.onclick=()=>drawer.style.left="0";drawer.querySelector("#ib-drawer-close").onclick=()=>drawer.style.left="-280px";});}'
   + 'if(CFG.bottomNavEnabled&&BOTTOM.length){var bar=document.createElement("div");bar.id="ib-bottom";bar.style.cssText="position:fixed;bottom:0;left:0;right:0;background:#111827;color:#fff;display:flex;justify-content:space-around;padding:6px 0 8px;z-index:9997;border-top:1px solid #1f2937";bar.innerHTML=BOTTOM.map(i=>"<a href=\'"+i.url+"\' style=\'flex:1;text-align:center;color:#9ca3af;text-decoration:none;font-size:11px\'><div style=\'font-size:18px\'>"+(i.icon||"•")+"</div>"+i.label+"</a>").join("");document.addEventListener("DOMContentLoaded",()=>{document.body.appendChild(bar);document.body.style.paddingBottom="60px";});}'
   + 'if(window.Intee){var origLog=console.log;window.addEventListener("error",e=>{try{Intee.track&&Intee.track("js_error",{message:e.message,source:e.filename});}catch{}});} })();';
}

function patchCatalogSrc(cfg){
  const NL=String.fromCharCode(10);
  return [
    "const fs=require('fs');",
    "const NL=String.fromCharCode(10);",
    "const cfg=JSON.parse(fs.readFileSync('build-config.json','utf8'));",
    "const pkg=cfg.packageName;",
    "const mp='android/app/src/main/java/'+pkg.split('.').join('/')+'/MainActivity.java';",
    "let src=fs.readFileSync(mp,'utf8');",
    "let changed=false;",
    "// FLAG_SECURE",
    "if(cfg.flagSecure && src.indexOf('FLAG_SECURE')===-1){",
    "  src=src.replace(/super\\.onCreate\\(savedInstanceState\\);/,m=>m+NL+'    if(true) getWindow().setFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE, android.view.WindowManager.LayoutParams.FLAG_SECURE);');",
    "  changed=true;",
    "}",
    "// DownloadManager + tel/mailto intents + catalog JS injection",
    "if(src.indexOf('DownloadListener')===-1){",
    "  src=src.replace(/import\\s+com\\.getcapacitor\\.BridgeActivity\\s*;/,'import android.app.DownloadManager; import android.content.Intent; import android.net.Uri; import android.webkit.DownloadListener; import android.webkit.WebView; import android.webkit.WebViewClient; import com.getcapacitor.BridgeActivity;');",
    "  src=src.replace(/super\\.onCreate\\(savedInstanceState\\);/,m=>m+NL+'    try{ getBridge().getWebView().setDownloadListener(new DownloadListener(){ public void onDownloadStart(String url, String ua, String cd, String mime, long len){ try{ Intent i=new Intent(Intent.ACTION_VIEW); i.setData(Uri.parse(url)); startActivity(i);}catch(Exception e){ try{ DownloadManager dm=(DownloadManager)getSystemService(DOWNLOAD_SERVICE); DownloadManager.Request r=new DownloadManager.Request(Uri.parse(url)); r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED); dm.enqueue(r);}catch(Exception ignored){}} } }); }catch(Exception ignored){}'+NL+'    try{ getBridge().getWebView().setWebViewClient(new WebViewClient(){ public boolean shouldOverrideUrlLoading(WebView v, String url){ if(url.startsWith(\"tel:\")||url.startsWith(\"mailto:\")||url.startsWith(\"sms:\")||url.startsWith(\"whatsapp://\")||url.startsWith(\"intent:\")){ try{ startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); return true;}catch(Exception e){ return false;}} return false; } public void onPageFinished(WebView v, String url){ super.onPageFinished(v,url); try{ java.io.InputStream is=getAssets().open(\"public/catalog.js\"); java.io.BufferedReader br=new java.io.BufferedReader(new java.io.InputStreamReader(is)); StringBuilder sb=new StringBuilder(); String line; while((line=br.readLine())!=null) sb.append(line).append(\"\\\\n\"); br.close(); v.evaluateJavascript(sb.toString(),null);}catch(Exception ignored){} } }); }catch(Exception ignored){}');",
    "  changed=true;",
    "}",
    "// Back button behavior",
    "if(cfg.backButtonBehavior && src.indexOf('onBackPressed')===-1){",
    "  const behavior=cfg.backButtonBehavior;",
    "  let code='  @Override public void onBackPressed(){ try{ if(getBridge().getWebView().canGoBack()) getBridge().getWebView().goBack(); else super.onBackPressed(); }catch(Exception e){ super.onBackPressed(); }}';",
    "  if(behavior==='exit') code='  @Override public void onBackPressed(){ finishAffinity(); }';",
    "  if(behavior==='confirm') code='  @Override public void onBackPressed(){ new androidx.appcompat.app.AlertDialog.Builder(this).setTitle(\"Salir?\").setMessage(\"¿Deseas salir de la app?\").setPositiveButton(\"Salir\", (d,w)->finishAffinity()).setNegativeButton(\"Cancelar\", null).show(); }';",
    "  if(behavior==='none') code='  @Override public void onBackPressed(){ }';",
    "  src=src.replace(/public class MainActivity extends BridgeActivity\\s*\\{/,m=>m+NL+code);",
    "  changed=true;",
    "}",
    "// Root detection",
    "if(cfg.rootDetection && src.indexOf('RootCheck')===-1){",
    "  src=src.replace(/super\\.onCreate\\(savedInstanceState\\);/,m=>m+NL+'    try{ boolean rooted=new java.io.File(\"/system/bin/su\").exists()||new java.io.File(\"/system/xbin/su\").exists()||new java.io.File(\"/system/bin/magisk\").exists(); if(rooted) android.util.Log.w(\"InteeBuild\",\"Root detected\"); }catch(Exception ignored){}');",
    "  changed=true;",
    "}",
    "if(changed) fs.writeFileSync(mp,src);",
    "console.log('Catalog patch applied:'+changed);"
  ].join(NL)+NL;
}

function mainActivityPatchSrc() {
  const NL = String.fromCharCode(10);
  return [
    "const fs = require('fs');",
    "const NL = String.fromCharCode(10);",
    "const pkg = JSON.parse(fs.readFileSync('build-config.json', 'utf8')).packageName;",
    "const mp = 'android/app/src/main/java/' + pkg.split('.').join('/') + '/MainActivity.java';",
    "let src = fs.readFileSync(mp, 'utf8');",
    "if (src.indexOf('RadioService') === -1) {",
    "  src = src.split('import com.getcapacitor.BridgeActivity;').join(['import android.content.Intent;', 'import android.os.Bundle;', 'import com.getcapacitor.BridgeActivity;'].join(NL));",
    "  src = src.replace(/public class MainActivity extends BridgeActivity\\s*\\{/, function (m) {",
    "    return m + NL + '  @Override' + NL + '  public void onCreate(Bundle savedInstanceState) {' + NL + '    super.onCreate(savedInstanceState);' + NL + '    try { startForegroundService(new Intent(this, RadioService.class)); } catch (Exception ignored) {}' + NL + '  }' + NL;",
    "  });",
    "  fs.writeFileSync(mp, src);",
    "}",
    "console.log('RadioService hook present: ' + (src.indexOf('RadioService') !== -1));"
  ].join(NL) + NL;
}

function notifyScriptSrc(cfg) {
  return '(function(){'
    + 'var TITLE=' + JSON.stringify(cfg.notifyTitle) + ';'
    + 'var TEXT=' + JSON.stringify(cfg.notifyText || cfg.appName) + ';'
    + 'var ON_OPEN=' + (cfg.notifyOnOpen ? 'true' : 'false') + ';'
    + 'var ON_CLOSE=' + (cfg.notifyOnClose ? 'true' : 'false') + ';'
    + 'var DELAY_MIN=' + cfg.notifyDelayMinutes + ';'
    + 'function cap(){return (window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.LocalNotifications)||null;}'
    + 'async function ensure(){var LN=cap();if(!LN)return null;try{var st=await LN.checkPermissions();if(st.display!=="granted"){await LN.requestPermissions();}}catch(e){}return LN;}'
    + 'async function fire(id){var LN=await ensure();if(!LN)return;try{await LN.schedule({notifications:[{id:id,title:TITLE,body:TEXT,schedule:{at:new Date(Date.now()+2000)}}]});}catch(e){}}'
    + 'if(ON_OPEN){window.addEventListener("load",function(){fire(101);});}'
    + 'if(ON_CLOSE){document.addEventListener("visibilitychange",function(){if(document.hidden){fire(102);}});window.addEventListener("pagehide",function(){fire(102);});}'
    + 'if(DELAY_MIN>0){setTimeout(function(){fire(103);},DELAY_MIN*60000);}'
    + '})();';
}

function nativeMainActivitySrc(pkg, cfg){
  const url = cfg.inputType==='url' ? cfg.url : 'file:///android_asset/public/index.html';
  return 'package '+pkg+';\nimport android.os.Bundle; import android.webkit.WebView; import android.webkit.WebViewClient; import android.webkit.WebChromeClient; import android.webkit.PermissionRequest; import androidx.appcompat.app.AppCompatActivity;\npublic class MainActivity extends AppCompatActivity {\n  WebView wv;\n  @Override protected void onCreate(Bundle b){ super.onCreate(b); wv=new WebView(this); setContentView(wv); wv.getSettings().setJavaScriptEnabled(true); wv.getSettings().setDomStorageEnabled(true); wv.getSettings().setAllowFileAccess(true); wv.getSettings().setMixedContentMode(0); wv.setWebViewClient(new WebViewClient(){ public boolean shouldOverrideUrlLoading(WebView v,String u){ if(u.startsWith("tel:")||u.startsWith("mailto:")||u.startsWith("whatsapp:")){ try{ startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(u))); return true;}catch(Exception e){} } return false; } public void onPageFinished(WebView v,String u){ try{ java.io.InputStream is=getAssets().open("public/catalog.js"); java.io.BufferedReader br=new java.io.BufferedReader(new java.io.InputStreamReader(is)); StringBuilder sb=new StringBuilder(); String l; while((l=br.readLine())!=null) sb.append(l).append("\\n"); br.close(); v.evaluateJavascript(sb.toString(),null);}catch(Exception e){} } }); wv.setWebChromeClient(new WebChromeClient(){ public void onPermissionRequest(PermissionRequest r){ runOnUiThread(()->r.grant(r.getResources())); } }); wv.loadUrl("'+url+'"); }\n  @Override public void onBackPressed(){ if(wv.canGoBack()) wv.goBack(); else super.onBackPressed(); }\n}\n';
}
function geckoMainActivitySrc(pkg, cfg){
  const url = cfg.inputType==='url' ? cfg.url : 'file:///android_asset/public/index.html';
  return 'package '+pkg+';\nimport android.os.Bundle; import org.mozilla.geckoview.GeckoView; import org.mozilla.geckoview.GeckoSession; import org.mozilla.geckoview.GeckoRuntime; import androidx.appcompat.app.AppCompatActivity;\npublic class MainActivity extends AppCompatActivity {\n  GeckoView gv; GeckoSession session;\n  @Override protected void onCreate(Bundle b){ super.onCreate(b); gv=new GeckoView(this); setContentView(gv); GeckoRuntime rt=GeckoRuntime.create(this); session=new GeckoSession(); session.open(rt); gv.setSession(session); session.loadUri("'+url+'"); }\n  @Override public void onBackPressed(){ if(session!=null) session.goBack(); else super.onBackPressed(); }\n}\n';
}
function cordovaConfigXml(cfg){
  return '<?xml version="1.0" encoding="utf-8"?><widget id="'+cfg.packageName+'" version="'+cfg.versionName+'" xmlns="http://www.w3.org/ns/widgets"><name>'+cfg.appName+'</name><description>'+cfg.description+'</description><author>'+cfg.author+'</author><content src="'+(cfg.inputType==='url'?cfg.url:'index.html')+'" /><access origin="*" /><allow-intent href="tel:*" /><allow-intent href="mailto:*" /></widget>';
}

function iosSignScriptSrc() {
  return "const fs = require('fs');\n"
    + "const os = require('os');\n"
    + "const path = require('path');\n"
    + "const cp = require('child_process');\n"
    + "function run(cmd) { console.log('> ' + cmd); cp.execSync(cmd, { stdio: 'inherit' }); }\n"
    + "function escXml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }\n"
    + "const cfg = JSON.parse(fs.readFileSync('build-config.json', 'utf8'));\n"
    + "const sign = JSON.parse(fs.readFileSync('ios-sign.json', 'utf8'));\n"
    + "const bundleId = cfg.packageName;\n"
    + "const method = cfg.iosExportMethod || 'development';\n"
    + "run('security cms -D -i ios-profile.mobileprovision -o /tmp/ib-profile.plist');\n"
    + "const uuid = cp.execSync('/usr/libexec/PlistBuddy -c \"Print :UUID\" /tmp/ib-profile.plist').toString().trim();\n"
    + "const profName = cp.execSync('/usr/libexec/PlistBuddy -c \"Print :Name\" /tmp/ib-profile.plist').toString().trim();\n"
    + "console.log('Perfil: ' + profName + ' (' + uuid + ')');\n"
    + "run('security create-keychain -p actions ib-build.keychain');\n"
    + "run('security set-keychain-settings -lut 21600 ib-build.keychain');\n"
    + "run('security unlock-keychain -p actions ib-build.keychain');\n"
    + "run('security import ios-cert.p12 -k ib-build.keychain -P ' + JSON.stringify(sign.p12Password) + ' -T /usr/bin/codesign');\n"
    + "run('security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k actions ib-build.keychain');\n"
    + "run('security list-keychains -d user -s ib-build.keychain login.keychain');\n"
    + "const identLine = cp.execSync('security find-identity -v -p codesigning ib-build.keychain | head -1').toString().trim();\n"
    + "console.log('Identidad: ' + identLine);\n"
    + "const mm = identLine.match(/\"([^\"]+)\"/);\n"
    + "const identity = mm ? mm[1] : '';\n"
    + "if (!identity) { throw new Error('No se encontro identidad de firma en el .p12 (revisa la contrasena)'); }\n"
    + "const provDir = path.join(os.homedir(), 'Library', 'MobileDevice', 'Provisioning Profiles');\n"
    + "fs.mkdirSync(provDir, { recursive: true });\n"
    + "fs.copyFileSync('ios-profile.mobileprovision', path.join(provDir, uuid + '.mobileprovision'));\n"
    + "const plist = '<?xml version=\"1.0\" encoding=\"UTF-8\"?>' + '\\n'\n"
    + "  + '<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">' + '\\n'\n"
    + "  + '<plist version=\"1.0\"><dict>' + '\\n'\n"
    + "  + '<key>method</key><string>' + escXml(method) + '</string>' + '\\n'\n"
    + "  + '<key>signingStyle</key><string>manual</string>' + '\\n'\n"
    + "  + '<key>stripSwiftSymbols</key><true/>' + '\\n'\n"
    + "  + '<key>provisioningProfiles</key><dict><key>' + escXml(bundleId) + '</key><string>' + escXml(profName) + '</string></dict>' + '\\n'\n"
    + "  + '</dict></plist>';\n"
    + "fs.writeFileSync('/tmp/ib-export.plist', plist);\n"
    + "run('xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -archivePath /tmp/ib-app.xcarchive archive CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY=' + JSON.stringify(identity) + ' PROVISIONING_PROFILE=' + uuid);\n"
    + "run('xcodebuild -exportArchive -archivePath /tmp/ib-app.xcarchive -exportPath /tmp/ib-export -exportOptionsPlist /tmp/ib-export.plist');\n"
    + "console.log('Exportado: ' + fs.readdirSync('/tmp/ib-export').join(', '));\n";
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
  if (cfg.plugins.localNotifications || cfg.notifySchedEnabled) deps['@capacitor/local-notifications'] = pv('localNotifications', cap);
  if (cfg.plugins.preferences) deps['@capacitor/preferences'] = pv('preferences', cap);
  if (cfg.plugins.browser) deps['@capacitor/browser'] = pv('browser', cap);
  if (cfg.plugins.app) deps['@capacitor/app'] = pv('app', cap);
  if (cfg.plugins.device) deps['@capacitor/device'] = pv('device', cap);
  if (cfg.plugins.network) deps['@capacitor/network'] = pv('network', cap);
  if (cfg.plugins.statusBar || cfg.edgeToEdge) deps['@capacitor/status-bar'] = pv('statusBar', cap);
  if (cfg.splashEnabled) deps['@capacitor/splash-screen'] = pv('splashScreen', cap);
  if (cfg.plugins.toast) deps['@capacitor/toast'] = pv('toast', cap);
  if (cfg.plugins.dialog) deps['@capacitor/dialog'] = pv('dialog', cap);
  if (cfg.plugins.screenReader) deps['@capacitor/screen-reader'] = pv('screenReader', cap);
  if (cfg.plugins.bluetooth) deps['@capacitor-community/bluetooth-le'] = PLUGIN_VERSIONS.bluetoothLe;
  if (cfg.plugins.nfc) deps['phonegap-nfc'] = PLUGIN_VERSIONS.nfc;
  if (cfg.plugins.admob) deps['@capacitor-community/admob'] = PLUGIN_VERSIONS.admob;
  // Catalogo: nuevos deps
  if (cfg.iapEnabled) deps['@capgo/capacitor-purchases'] = '^5.4.0';
  if (cfg.encryptedStorage) deps['capacitor-secure-storage-plugin'] = '^0.10.0';
  if (cfg.firebaseEnabled) { deps['@capacitor-firebase/analytics'] = '^6.0.0'; deps['@capacitor-firebase/crashlytics'] = '^6.0.0'; }

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
      hasIosSigning: !!cfg.useIosSigning,
      iosExportMethod: cfg.iosExportMethod,
      notifyOnOpen: !!cfg.notifyOnOpen,
      notifyOnClose: !!cfg.notifyOnClose,
      notifyDelayMinutes: cfg.notifyDelayMinutes,
      backgroundAudio: !!cfg.permissions.foreground,
      author: cfg.author,
      description: cfg.description,
      accentColor: cfg.accentColor,
      plugins: cfg.plugins,
      deepLinksEnabled: cfg.deepLinksEnabled,
      appTheme: cfg.appTheme,
      entryAnimation: cfg.entryAnimation,
      inteebridge: !!cfg.plugins.inteebridge,
      pullRefresh: !!cfg.pullRefresh,
      offlineScreen: !!cfg.offlineScreen,
      flagSecure: !!cfg.flagSecure,
      blockSelection: !!cfg.blockSelection,
      drawerEnabled: !!cfg.drawerEnabled,
      bottomNavEnabled: !!cfg.bottomNavEnabled,
      rootDetection: !!cfg.rootDetection,
      backButtonBehavior: cfg.backButtonBehavior,
      downloadManager: !!cfg.downloadManager,
      encryptedStorage: !!cfg.encryptedStorage,
      iapEnabled: !!cfg.iapEnabled,
      firebaseEnabled: !!cfg.firebaseEnabled,
      twaEnabled: !!cfg.twaEnabled,
      desktopEnabled: !!cfg.desktopEnabled,
      minify: !!cfg.minify,
      pwaEnabled: !!cfg.pwaEnabled
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

  if (cfg.useIosSigning) {
    files['ios-cert.p12'] = Buffer.from(cfg.iosP12Base64, 'base64');
    files['ios-profile.mobileprovision'] = Buffer.from(cfg.iosProfileBase64, 'base64');
    files['ios-sign.json'] = JSON.stringify({ p12Password: cfg.iosP12Password }, null, 2);
    files['ios-sign.js'] = iosSignScriptSrc();
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

  // Provider pro
  files['provider.json'] = JSON.stringify({provider: cfg.provider, version: cfg.providerVersion, webview: cfg.provider==='gecko'?'GeckoView':(cfg.provider==='native'?'Native WebView':(cfg.provider==='twa'?'TWA Chrome':cfg.provider))}, null, 2);
  if(cfg.provider==='native') files['native-MainActivity.java'] = nativeMainActivitySrc(cfg.packageName, cfg);
  if(cfg.provider==='gecko') files['gecko-MainActivity.java'] = geckoMainActivitySrc(cfg.packageName, cfg);
  if(cfg.provider==='cordova') files['config.xml'] = cordovaConfigXml(cfg);
  if(cfg.provider==='flutter') files['flutter/README.md'] = '# Flutter WebView Provider\n\n flutter create --platforms=android . && flutter build apk';
  if(cfg.provider==='tauri') files['tauri/README.md'] = '# Tauri Provider\n\n cargo tauri build';
  // Permission Engine: solo genera lo necesario
  const needsRuntime = Object.entries(cfg.permissions).some(([k,v])=>v && PERMISSION_SPEC[k]?.runtime) || cfg.notifySchedEnabled;
  if (needsRuntime) {
    files['NativePermissions.java'] = nativePermissionsJavaSrc(cfg.packageName);
    files['patch-permissions.js'] = patchPermissionsSrc();
  }
  // Catalogo consolidado: patch unificado para FLAG_SECURE, DownloadManager, intents, root, back button
  files['patch-catalog.js'] = patchCatalogSrc(cfg);
  files['www/catalog.js'] = catalogUiJsSrc(cfg);
  // AdMob config
  if (cfg.admobAppId) files['admob-config.json'] = JSON.stringify({appId: cfg.admobAppId, interstitial: cfg.admobInterstitial, rewarded: cfg.admobRewarded}, null, 2);
  // Asset Links
  const twaDomain = cfg.twaDomain || cfg.deepLinkDomain || (cfg.inputType==='url' ? (()=>{try{return new URL(cfg.url).hostname}catch{return ''}})() : '');
  if (twaDomain) {
    const sha256 = '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00';
    files['assetlinks.json'] = JSON.stringify([{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app', package_name:cfg.packageName, sha256_cert_fingerprints:[sha256]}}], null, 2);
    files['.well-known/assetlinks.json'] = files['assetlinks.json'];
  }
  // Firebase
  if (cfg.firebaseEnabled) {
    files['google-services.json'] = cfg.firebaseConfig || JSON.stringify({project_info:{project_id:'inteebuild-demo'},client:[{client_info:{mobilesdk_app_id:'1:000:android:000', package_name:cfg.packageName}}]}, null, 2);
    files['firebase-config.json'] = JSON.stringify({enabled:true, package:cfg.packageName}, null, 2);
  }
  // TWA
  if (cfg.twaEnabled && twaDomain) {
    files['twa-manifest.json'] = JSON.stringify({packageId:cfg.packageName, host:twaDomain, name:cfg.appName, themeColor:cfg.accentColor, backgroundColor:cfg.splashColor, display:'standalone', orientation:cfg.orientation}, null, 2);
  }
  // Desktop (Electron)
  if (cfg.desktopEnabled) {
    files['desktop/package.json'] = JSON.stringify({name: cfg.appName.toLowerCase().replace(/[^a-z0-9]+/g,'-'), version: cfg.versionName, main:'main.js', scripts:{start:'electron .', build:'electron-builder'}}, null, 2);
    files['desktop/main.js'] = "const {app, BrowserWindow}=require('electron'); function create(){ const w=new BrowserWindow({width:1280,height:800, webPreferences:{nodeIntegration:false}}); w.loadURL('"+(cfg.inputType==='url'?cfg.url:'file://'+__dirname+'/www/index.html')+"'); } app.whenReady().then(create);";
    files['desktop/README.md'] = '# Desktop Export - Electron\n\n`npm install && npm start` para probar. `npm run build` para .EXE/.APP';
  }
  if (cfg.permissions.foreground) {
    files['RadioService.java'] = radioServiceSrc(cfg.packageName);
    files['patch-main-activity.js'] = mainActivityPatchSrc();
  }

  if (cfg.notifySchedEnabled && cfg.inputType === 'html') {
    const tag = '<script>' + notifyScriptSrc(cfg) + '</scr' + 'ipt>';
    const html = files['www/index.html'];
    files['www/index.html'] = /<\/body\s*>/i.test(html)
      ? html.replace(/<\/body\s*>/i, tag + '</body>')
      : html + tag;
  }

  if (cfg.inputType === 'html') {
    let html = files['www/index.html'];
    if (!/<meta\s+charset/i.test(html)) {
      const cs = '<meta charset="UTF-8" />';
      const before = html;
      html = html.replace(/<head([^>]*)>/i, '<head$1>' + cs);
      if (html === before) {
        html = /<!doctype[^>]*>/i.test(html)
          ? html.replace(/<!doctype[^>]*>/i, (m) => m + cs)
          : cs + html;
      }
    }
    if (!/<meta\s+[^>]*viewport/i.test(html)) {
      const vp = '<meta name="viewport" content="width=device-width, initial-scale=1.0" />';
      html = /<head([^>]*)>/i.test(html)
        ? html.replace(/<head([^>]*)>/i, '<head$1>' + vp)
        : vp + html;
    }
    files['www/index.html'] = html;
  }
  // Inject catalog UI into www/index.html (local or remote wrapper both get it)
  {
    const catalogJs = catalogUiJsSrc(cfg);
    let html = files['www/index.html'];
    const tag = '<script>'+catalogJs+'</scr'+'ipt>';
    if (/<\/body\s*>/i.test(html)) html = html.replace(/<\/body\s*>/i, tag + '</body>');
    else html = html + tag;
    files['www/index.html'] = html;
    // also inject blockSelection CSS if enabled
    if (cfg.blockSelection) {
      let html2 = files['www/index.html'];
      const style = '<style>*{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none} input,textarea{-webkit-user-select:text;user-select:text}</style>';
      if (/<\/head\s*>/i.test(html2)) html2 = html2.replace(/<\/head\s*>/i, style + '</head>');
      else html2 = style + html2;
      files['www/index.html'] = html2;
    }
  }
  // PWA gratis: manifest + service worker + registro (sin hosting, los archivos van en el ZIP)
  if (cfg.pwaEnabled) {
    files['www/manifest.webmanifest'] = JSON.stringify({
      name: cfg.appName,
      short_name: cfg.appName.slice(0, 12),
      start_url: '.',
      display: 'standalone',
      background_color: cfg.splashColor || '#ffffff',
      theme_color: cfg.accentColor || '#4f46e5',
      icons: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }]
    }, null, 2);
    files['www/sw.js'] = "const CACHE='ib-v1';self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','./index.html','./manifest.webmanifest']).catch(()=>{})));self.skipWaiting();});self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).catch(()=>caches.match('./index.html'))));});";
    let html = files['www/index.html'];
    if (!/<link[^>]*rel=["']manifest["']/i.test(html)) {
      const link = '<link rel="manifest" href="manifest.webmanifest" />';
      html = /<\/head\s*>/i.test(html) ? html.replace(/<\/head\s*>/i, link + '</head>') : link + html;
    }
    if (!/serviceWorker/i.test(html)) {
      const reg = '<script>if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){});});}</scr' + 'ipt>';
      html = /<\/body\s*>/i.test(html) ? html.replace(/<\/body\s*>/i, reg + '</body>') : html + reg;
    }
    files['www/index.html'] = html;
  }
  // Minify gratis y seguro (solo si se activa): quita comentarios y colapsa espacios
  if (cfg.minify) {
    let html = files['www/index.html'];
    html = html.replace(/<!--(?!\[if)[\s\S]*?-->/g, '');
    html = html.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    files['www/index.html'] = html;
    if (files['www/catalog.js']) {
      files['www/catalog.js'] = String(files['www/catalog.js']).replace(/\/\*[\s\S]*?\*\//g, '');
    }
  }

  return files;
}

function buildPlayListing(cfg) {
  const perms = Object.entries(cfg.permissions || {}).filter(([, v]) => v).map(([k]) => k);
  const feat = [];
  if (cfg.permissions.foreground) feat.push('audio en segundo plano');
  if (cfg.permissions.gps) feat.push('ubicación GPS');
  if (cfg.permissions.cameraMic) feat.push('cámara y micrófono');
  if (cfg.drawerEnabled) feat.push('menú lateral nativo');
  if (cfg.bottomNavEnabled) feat.push('navegación inferior');
  if (cfg.offlineScreen) feat.push('pantalla sin conexión');
  const shortDesc = (cfg.description || ((cfg.appName || 'Mi app') + ' — app Android nativa generada con InteeBuild.')).slice(0, 80);
  const fullDesc = [
    (cfg.description || (cfg.appName || 'Mi app') + ' para Android.'),
    '',
    'Características:',
    ...(feat.length ? feat.map(f => '• ' + f) : ['• Acceso rápido desde tu teléfono']),
    '• Funciona con tu web favorita dentro de la app',
    '',
    'Privacidad: esta app solicita únicamente los permisos necesarios (' + (perms.length ? perms.join(', ') : 'ninguno adicional') + ').'
  ].join('\n').slice(0, 4000);
  return {
    title: String(cfg.appName || 'Mi app').slice(0, 30),
    shortDescription: shortDesc,
    fullDescription: fullDesc,
    keywords: ['android', 'app', cfg.packageName || ''].filter(Boolean).join(', ').slice(0, 100),
    category: 'Herramientas',
    packageName: cfg.packageName || '',
    version: (cfg.versionName || '1.0.0') + ' (' + (cfg.versionCode || 1) + ')'
  };
}

module.exports = {
  normalizeConfig,
  generateFiles,
  generateAndroidManifest,
  getPermissionAudit,
  suggestPermissionsFromApis,
  buildPlayListing,
  PERMISSION_SPEC,
  WORKFLOW_YML,
  VALID_COMPILE_SDKS,
  VALID_TARGET_SDKS,
  VALID_MIN_SDKS
};