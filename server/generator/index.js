'use strict';

const { PERMISSION_SPEC, runtimeBatchConsts, wantsBackground, specialNeeds, needsSpecialFile } = require('./permissions');
const { CAPACITOR_VERSIONS, VALID_COMPILE_SDKS, VALID_TARGET_SDKS, VALID_MIN_SDKS, PLUGIN_VERSIONS, pv } = require('./versions');
const { permissionManifestBlocks, hardwareFeatureBlocks, nfcTechFilterXml, generateAndroidManifest } = require('./manifest');
const { nativePermissionsJavaSrc, specialAccessJavaSrc, patchPermissionsSrc, patchSpecialSrc } = require('./runtime');
const { radioServiceSrc, nativeAudioServiceSrc, audioBridgeSrc, mainActivityPatchSrc, patchAudioSrc } = require('./audio');
const { catalogUiJsSrc, patchCatalogSrc, nativeMainActivitySrc, geckoMainActivitySrc, cordovaConfigXml } = require('./providers');
const { WORKFLOW_YML } = require('./workflow');
const { getPermissionAudit, suggestPermissionsFromApis } = require('./audit');
const { iosSignScriptSrc } = require('./signing');

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

  // Dinámico desde PERMISSION_SPEC: ninguna key del spec se pierde en silencio.
  const permissions = {};
  Object.keys(PERMISSION_SPEC).forEach(k => { permissions[k] = !!raw?.permissions?.[k]; });
  if (raw?.permissions?.fingerprint) permissions.biometric = true;
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
  if (permissions.gps || permissions.gpsBackground || permissions.accessFineLocation || permissions.accessCoarseLocation || permissions.accessBackgroundLocation) plugins.geolocation = true;
  if (permissions.cameraMic || permissions.cameraFlash || permissions.cameraAutoFocus || permissions.videoCapture) { plugins.camera = true; plugins.haptics = true; }
  if (permissions.microphone || permissions.audioRecord) plugins.haptics = true;
  if (permissions.storage || permissions.manageExternalStorage || permissions.readExternalStorage || permissions.writeExternalStorage) plugins.filesystem = true;
  if (permissions.bluetooth || permissions.bluetoothScan || permissions.bluetoothConnect || permissions.bluetoothAdvertise || permissions.bluetoothPrivileged) plugins.bluetooth = true;
  if (permissions.nfc) plugins.nfc = true;
  if (permissions.vibration) plugins.haptics = true;
  if (permissions.biometric || permissions.fingerprint) plugins.biometrics = true;
  if (permissions.notifications || permissions.foreground || raw?.notifySchedEnabled) { plugins.localNotifications = true; plugins.notifications = true; }
  if (permissions.alarmSchedule || permissions.alarmUse || permissions.alarm || permissions.useExactAlarm || permissions.scheduleExactAlarm) { plugins.localNotifications = true; }
  if (permissions.wakeLock) { plugins.device = true; }
  if (permissions.contacts || permissions.readContacts || permissions.writeContacts) plugins.contacts = true;
  if (permissions.calendar || permissions.readCalendar || permissions.writeCalendar) plugins.calendar = true;
  if (permissions.ads) plugins.admob = true;
  if (permissions.fingerprint) plugins.biometrics = true;
  if (permissions.phone || permissions.callPhone || permissions.answerPhone || permissions.readPhoneState || permissions.readPhoneNumber || permissions.processOutgoingCalls) { /* Native only */ }
  if (permissions.sms || permissions.sendSms || permissions.readSms || permissions.receiveSms || permissions.receiveMms) { /* Native only */ }
  if (permissions.sensors || permissions.bodySensors || permissions.highSamplingRateSensors) { /* Native only */ }
  if (permissions.activityRecognition) { /* Native only */ }
  if (permissions.infrared) { /* Native only */ }
  if (permissions.nearbyWifiDevices || permissions.changeWifiState || permissions.changeNetworkState) { /* Native only */ }
  if (permissions.systemAlertWindow) { /* Native only */ }
  if (permissions.requestInstallPackages) { /* Native only */ }
  if (permissions.getAccounts) { /* Native only */ }
  if (permissions.internet) { /* System native */ }

  const provider = ['capacitor','native','twa','gecko','cordova','flutter','tauri','react-native','ionic'].includes(String(raw.provider||'').toLowerCase()) ? String(raw.provider).toLowerCase() : 'capacitor';
  const providerVersion = String(raw.providerVersion||'').slice(0,20) || (provider==='capacitor' ? (compileSdk>=35?'7':'6') : '1.0');
  const minify = !!raw.minify;
  const pwaEnabled = raw.pwaEnabled !== undefined ? !!raw.pwaEnabled : true;
  const streamUrl = typeof raw.streamUrl === 'string' ? raw.streamUrl.trim().slice(0, 500) : '';
  const nativeAudio = !!raw.nativeAudio;
  const nativeAutoplay = raw.nativeAutoplay !== undefined ? !!raw.nativeAutoplay : true;
  // Audio nativo necesita foreground + wakeLock sí o sí
  if (nativeAudio && streamUrl) { permissions.foreground = true; permissions.wakeLock = true; }
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
    streamUrl, nativeAudio, nativeAutoplay,
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
  if (cfg.plugins.admob) deps['@capacitor-community/admob'] = '^5.0.0';

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
      pwaEnabled: !!cfg.pwaEnabled,
      nativeAudio: !!cfg.nativeAudio,
      nativeAutoplay: !!cfg.nativeAutoplay,
      hasStreamUrl: !!cfg.streamUrl
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
  // Permission Engine: solo genera lo necesario, pero 1:1 con lo seleccionado
  const needsRuntime = Object.entries(cfg.permissions).some(([k,v])=>v && PERMISSION_SPEC[k]?.runtime) || cfg.notifySchedEnabled;
  if (needsRuntime) {
    files['NativePermissions.java'] = nativePermissionsJavaSrc(cfg.packageName, runtimeBatchConsts(cfg), wantsBackground(cfg));
    files['patch-permissions.js'] = patchPermissionsSrc(cfg);
  }
  if (needsSpecialFile(cfg)) {
    files['SpecialAccess.java'] = specialAccessJavaSrc(cfg.packageName, specialNeeds(cfg));
    files['patch-special.js'] = patchSpecialSrc();
  }
  if (cfg.permissions.nfc) {
    files['res/xml/nfc_tech_filter.xml'] = nfcTechFilterXml();
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
  // TWA (Trusted Web Activity)
  if (cfg.provider === 'twa' || (cfg.twaEnabled && twaDomain)) {
    const twaDomain = cfg.twaDomain || (cfg.inputType === 'url' ? new URL(cfg.url).hostname : 'example.com');
    files['twa-manifest.json'] = JSON.stringify({
      packageId: cfg.packageName,
      host: twaDomain,
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
    }, null, 2);
    
    files['assetlinks.json'] = JSON.stringify([{
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: cfg.packageName,
        sha256_cert_fingerprints: ["SHA256_FINGERPRINT_HERE"]
      }
    }], null, 2);
    
    files['twa/README.md'] = `# TWA (Trusted Web Activity)

## Setup Required
1. Upload \`assetlinks.json\` to your domain: \`https://${twaDomain}/.well-known/assetlinks.json\`
2. Replace \`SHA256_FINGERPRINT_HERE\` with your actual signing key fingerprint
3. Test with: \`bubblewrap build --manifest=twa-manifest.json\`

## Features
- Chrome-powered WebView
- Offline support with service worker
- ${cfg.permissions.notifications ? 'Notifications' : ''}
- ${cfg.permissions.gps ? 'Geolocation' : ''}
- PWA capabilities`;
  }
  // Flutter Provider
  if (cfg.provider === 'flutter') {
    files['flutter/pubspec.yaml'] = `name: ${cfg.appName.toLowerCase().replace(/[^a-z0-9]+/g,'_')}
description: ${cfg.appName}
version: ${cfg.versionName}+${cfg.versionCode}
environment:
  sdk: '>=3.0.0 <4.0.0'
dependencies:
  flutter:
    sdk: flutter
  webview_flutter: ^4.0.0
  permission_handler: ^11.0.0
  flutter_admob: ^2.0.0
  cupertino_icons: ^1.0.2

flutter:
  uses-material-design: true`;
    files['flutter/lib/main.dart'] = `import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:permission_handler/permission_handler.dart';

void main() => runApp(MyApp());

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '${cfg.appName}',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
      ),
      home: WebViewScreen(url: '${cfg.inputType === 'url' ? cfg.url : 'about:blank'}'),
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
  late WebViewController _controller;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _requestPermissions();
  }

  Future<void> _requestPermissions() async {
    ${cfg.permissions.cameraMic ? 'await Permission.camera.request();' : ''}
    ${cfg.permissions.microphone ? 'await Permission.microphone.request();' : ''}
    ${cfg.permissions.gps ? 'await Permission.location.request();' : ''}
    ${cfg.permissions.storage ? 'await Permission.storage.request();' : ''}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('${cfg.appName}'),
        backgroundColor: Color(0xff${cfg.accentColor.replace('#', '')}),
      ),
      body: Stack(
        children: [
          WebViewWidget(
            controller: _controller,
          ),
          if (_isLoading)
            const Center(
              child: CircularProgressIndicator(),
            ),
        ],
      ),
    );
  }
}`;
    files['flutter/android/app/src/main/AndroidManifest.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${cfg.packageName}">
    <uses-permission android:name="android.permission.INTERNET" />
    ${cfg.permissions.cameraMic ? '<uses-permission android:name="android.permission.CAMERA" />' : ''}
    ${cfg.permissions.microphone ? '<uses-permission android:name="android.permission.RECORD_AUDIO" />' : ''}
    ${cfg.permissions.gps ? '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />' : ''}
    ${cfg.permissions.storage ? '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />' : ''}
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
    </application>
</manifest>`;
    files['flutter/README.md'] = `# Flutter Project

## Building
\`\`\`bash
cd flutter
flutter pub get
flutter build apk
flutter build appbundle
\`\`\`

## Features
- WebView with ${cfg.inputType === 'url' ? 'URL: ' + cfg.url : 'embedded HTML'}
- Native permissions: ${Object.keys(cfg.permissions).filter(k => cfg.permissions[k]).join(', ')}
- Material Design 3
- AdMob integration`;
  }
  // Tauri Provider
  if (cfg.provider === 'tauri') {
    files['tauri/Cargo.toml'] = `[package]
name = "${cfg.appName.toLowerCase().replace(/[^a-z0-9]+/g,'_')}"
version = "${cfg.versionName}"
edition = "2021"

[dependencies]
tauri = { version = "1.0", features = ["api-all"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
webview2-com = "0.19"

[build-dependencies]
tauri-build = { version = "1.0", features = [] }`;
    files['tauri/src-tauri/tauri.conf.json'] = JSON.stringify({
      build: {
        distDir: "../www",
        devPath: "../www"
      },
      tauri: {
        bundle: {
          identifier: cfg.packageName,
          icon: ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"]
        },
        updater: { active: false },
        allowlist: {
          all: true,
          shell: { all: true, open: true },
          dialog: { all: true, ask: true, confirm: true },
          fs: { all: true, readFile: true, writeFile: true, readDir: true, removeFile: true, copyFile: true },
          http: { all: true, request: true, scope: ["https://*"] },
          notification: { all: true }
        },
        security: {
          csp: "default-src 'self'; script-src 'self'"
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
    }, null, 2);
    files['tauri/src-tauri/src/main.rs'] = `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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
}`;
    files['tauri/README.md'] = `# Tauri Project

## Building
\`\`\`bash
cd tauri
npm install
npm run tauri build
\`\`\`

## Features
- Lightweight desktop app (WebView2 on Windows, WebKit on macOS/Linux)
- Rust backend for performance
- ${Object.keys(cfg.permissions).filter(k => cfg.permissions[k]).join(', ')} permissions
- Native system integration`;
  }
  // Desktop (Electron)
  if (cfg.desktopEnabled) {
    files['desktop/package.json'] = JSON.stringify({name: cfg.appName.toLowerCase().replace(/[^a-z0-9]+/g,'-'), version: cfg.versionName, main:'main.js', scripts:{start:'electron .', build:'electron-builder'}}, null, 2);
    files['desktop/main.js'] = "const {app, BrowserWindow}=require('electron'); function create(){ const w=new BrowserWindow({width:1280,height:800, webPreferences:{nodeIntegration:false}}); w.loadURL('"+(cfg.inputType==='url'?cfg.url:'file://'+__dirname+'/www/index.html')+"'); } app.whenReady().then(create);";
    files['desktop/README.md'] = '# Desktop Export - Electron\n\n`npm install && npm start` para probar. `npm run build` para .EXE/.APP';
  }
  if (cfg.permissions.foreground) {
    const useNativeAudio = cfg.nativeAudio && cfg.streamUrl;
    files['RadioService.java'] = useNativeAudio
      ? nativeAudioServiceSrc(cfg.packageName, cfg.streamUrl, cfg.nativeAutoplay, cfg.appName)
      : radioServiceSrc(cfg.packageName);
    files['patch-main-activity.js'] = mainActivityPatchSrc();
    if (useNativeAudio) {
      files['AudioBridge.java'] = audioBridgeSrc(cfg.packageName);
      files['patch-audio.js'] = patchAudioSrc();
    }
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
  permissionManifestBlocks,
  hardwareFeatureBlocks,
  nfcTechFilterXml,
  runtimeBatchConsts,
  wantsBackground,
  specialNeeds,
  needsSpecialFile,
  PERMISSION_SPEC,
  WORKFLOW_YML,
  VALID_COMPILE_SDKS,
  VALID_TARGET_SDKS,
  VALID_MIN_SDKS
};
