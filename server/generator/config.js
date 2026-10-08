'use strict';

const { PERMISSION_SPEC } = require('./permissions');
const { CAPACITOR_VERSIONS, VALID_COMPILE_SDKS, VALID_TARGET_SDKS, VALID_MIN_SDKS } = require('./versions');
const { isBlockedUrl } = require('../url-guard');

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function readAppName(raw) {
  const name = String(raw.appName || '').trim();
  if (name && !/^[\p{L}\p{N} _\-.]{2,40}$/u.test(name)) {
    throw badRequest('Nombre de app no válido. Solo letras, números, espacios, guiones y puntos (2-40 caracteres). Ejemplo: Mi Tienda');
  }
  return name.slice(0, 40) || 'My Web App';
}

function readSource(raw) {
  const inputType = raw.inputType === 'html' ? 'html' : 'url';
  const htmlCode = inputType === 'html' ? String(raw.htmlCode || '').trim() : '';
  const url = inputType === 'url' ? String(raw.url || '').trim() : 'https://localhost';

  if (inputType === 'html') {
    if (!htmlCode) {
      throw badRequest('Debes proporcionar código HTML. Pega tu página o usa "Descargar ejemplo HTML" para inspirarte.');
    }
    return { inputType, htmlCode, url };
  }

  try {
    const candidate = new URL(url);
    if (candidate.protocol !== 'http:' && candidate.protocol !== 'https:') throw new Error();
  } catch (_) {
    throw badRequest('URL no válida. Debe empezar con http:// o https://. Ejemplo: https://mi-tienda.com');
  }
  return { inputType, htmlCode, url };
}

function readIdentity(raw, appName) {
  let packageName = String(raw.packageName || '').trim().toLowerCase();
  if (!packageName) {
    const slug = appName.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'app';
    packageName = `com.inteebuild.${slug}`;
  }
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName)) {
    throw badRequest('Package ID no válido. Solo minúsculas, números y puntos, con al menos un punto. Ejemplo: com.miempresa.miapp');
  }

  const versionName = String(raw.versionName || '1.0.0').slice(0, 20) || '1.0.0';
  if (!/^\d+(\.\d+){0,3}$/.test(versionName)) {
    throw badRequest('Versión no válida. Usa números separados por puntos. Ejemplo: 1.0.0');
  }

  return { packageName, versionName, versionCode: Math.max(1, Number(raw.versionCode) || 1) };
}

function readSdkTargets(raw) {
  let compileSdk = Number(raw.compileSdk) || 35;
  if (!VALID_COMPILE_SDKS.includes(compileSdk)) compileSdk = 35;

  let targetSdk = Number(raw.targetSdk) || compileSdk;
  if (!VALID_TARGET_SDKS.includes(targetSdk)) targetSdk = compileSdk;

  let minSdk = Number(raw.minSdk) || 23;
  if (!VALID_MIN_SDKS.includes(minSdk)) minSdk = 23;
  if (targetSdk < minSdk) targetSdk = minSdk;

  return { compileSdk, targetSdk, minSdk, capMajor: compileSdk >= 35 ? 7 : 6 };
}

function readPermissions(raw) {

  const permissions = {};
  Object.keys(PERMISSION_SPEC).forEach(k => { permissions[k] = !!raw?.permissions?.[k]; });
  applyLegacyPermissionNames(permissions, raw);
  return permissions;
}



function applyLegacyPermissionNames(permissions, raw) {
  if (raw?.permissions?.fingerprint) permissions.biometric = true;

  if (permissions.bluetooth && !permissions.bluetoothScan && !permissions.bluetoothConnect && !permissions.bluetoothAdvertise) {
    const asksAndroid12 = (Number(raw.minSdk) || 23) >= 31 || (Number(raw.targetSdk) || 35) >= 31;
    if (asksAndroid12) {
      permissions.bluetoothScan = true;
      permissions.bluetoothConnect = true;
    }
  }

  if (permissions.alarm && !permissions.alarmSchedule && !permissions.alarmUse) permissions.alarmSchedule = true;
}


const PLUGIN_KEYS = [
  'camera', 'geolocation', 'bluetooth', 'nfc', 'vibration', 'share', 'filesystem',
  'contacts', 'calendar', 'notifications', 'localNotifications', 'biometrics',
  'clipboard', 'haptics', 'preferences', 'browser', 'app', 'device', 'network',
  'statusBar', 'toast', 'dialog', 'admob', 'screenReader', 'inteebridge',

  'ar', 'voice', 'envSensors', 'ai', 'power', 'adaptiveNotif', 'advSecurity',
  'dynamicUI', 'social', 'advGeo', 'dataAnalytics', 'vr', 'blockchain', 'rpa',
  'vulnScan', 'emoAI', 'iot', 'mr'
];





const PERMISSION_POWERS_PLUGINS = [
  [['gps', 'gpsBackground', 'accessFineLocation', 'accessCoarseLocation', 'accessBackgroundLocation'], ['geolocation']],
  [['cameraMic', 'cameraFlash', 'cameraAutoFocus', 'videoCapture'], ['camera', 'haptics']],
  [['microphone', 'audioRecord'], ['haptics']],
  [['storage', 'manageExternalStorage', 'readExternalStorage', 'writeExternalStorage'], ['filesystem']],
  [['bluetooth', 'bluetoothScan', 'bluetoothConnect', 'bluetoothAdvertise', 'bluetoothPrivileged'], ['bluetooth']],
  [['nfc'], ['nfc']],
  [['vibration'], ['haptics']],
  [['biometric', 'fingerprint'], ['biometrics']],
  [['notifications', 'foreground'], ['localNotifications', 'notifications']],
  [['alarmSchedule', 'alarmUse', 'alarm', 'useExactAlarm', 'scheduleExactAlarm'], ['localNotifications']],
  [['wakeLock'], ['device']],
  [['contacts', 'readContacts', 'writeContacts'], ['contacts']],
  [['calendar', 'readCalendar', 'writeCalendar'], ['calendar']],
  [['ads'], ['admob']],

  [['ar'], ['ar']],
  [['voiceRec'], ['voice']],
  [['envSensors'], ['envSensors']],
  [['aiSuite'], ['ai']],
  [['powerMgmt'], ['power']],
  [['adaptiveNotif'], ['adaptiveNotif']],
  [['advSecurity'], ['advSecurity']],
  [['dynamicUI'], ['dynamicUI']],
  [['socialAnalytics'], ['social']],
  [['advGeo'], ['advGeo', 'geolocation']],

  [['dataAnalytics'], ['dataAnalytics']],
  [['vr'], ['vr']],
  [['blockchain'], ['blockchain']],
  [['rpa'], ['rpa']],
  [['vulnScan'], ['vulnScan']],
  [['emoAI'], ['emoAI']],
  [['iot'], ['iot', 'bluetooth']],
  [['mr'], ['mr']]
];

function readPlugins(raw, permissions) {
  const plugins = {};
  PLUGIN_KEYS.forEach(key => { plugins[key] = !!raw?.plugins?.[key]; });

  for (const [permissionKeys, pluginKeys] of PERMISSION_POWERS_PLUGINS) {
    if (!permissionKeys.some(k => permissions[k])) continue;
    pluginKeys.forEach(k => { plugins[k] = true; });
  }


  if (raw?.notifySchedEnabled) {
    plugins.localNotifications = true;
    plugins.notifications = true;
  }
  return plugins;
}

function readBuildOptions(raw, sdk) {
  const providers = ['droncito', 'capacitor', 'native', 'twa', 'gecko', 'cordova', 'flutter', 'tauri', 'ios', 'desktop', 'react-native', 'ionic'];
  const provider = providers.includes(String(raw.provider || '').toLowerCase()) ? String(raw.provider).toLowerCase() : 'capacitor';

  return {
    provider,
    providerVersion: String(raw.providerVersion || '').slice(0, 20) || (provider === 'capacitor' ? (sdk.compileSdk >= 35 ? '7' : '6') : '1.0'),
    minify: !!raw.minify,
    pwaEnabled: raw.pwaEnabled !== undefined ? !!raw.pwaEnabled : true,
    streamUrl: typeof raw.streamUrl === 'string' ? raw.streamUrl.trim().slice(0, 500) : '',
    nativeAudio: !!raw.nativeAudio,
    nativeAutoplay: raw.nativeAutoplay !== undefined ? !!raw.nativeAutoplay : true
  };
}

function readChrome(raw) {
  return {
    orientation: ['portrait', 'landscape', 'any', 'sensor'].includes(raw.orientation) ? raw.orientation : 'any',
    fullscreen: !!raw.fullscreen,
    hideNavBar: !!raw.hideNavBar,
    keepScreenOn: !!raw.keepScreenOn,
    splashEnabled: !!raw.splashEnabled,
    splashImageBase64: typeof raw.splashImageBase64 === 'string' && raw.splashImageBase64.startsWith('data:image/') ? raw.splashImageBase64 : null,
    splashAnimation: ['fade', 'slide'].includes(raw.splashAnimation) ? raw.splashAnimation : 'fade',
    splashDuration: Math.max(500, Math.min(10000, Number(raw.splashDuration) || 2000)),
    splashBgColor: /^#[0-9a-fA-F]{6}$/.test(String(raw.splashBgColor || '')) ? String(raw.splashBgColor) : '#ffffff',
    useCleartext: raw.useCleartext === undefined ? true : !!raw.useCleartext,
    author: String(raw.author || '').slice(0, 60),
    description: String(raw.description || '').slice(0, 200),
    accentColor: /^#[0-9a-fA-F]{6}$/.test(String(raw.accentColor || '')) ? String(raw.accentColor) : '#4f46e5',
    statusBarColor: /^#[0-9a-fA-F]{6}$/.test(String(raw.statusBarColor || '')) ? String(raw.statusBarColor) : '#ffffff',
    navigationBarColor: /^#[0-9a-fA-F]{6}$/.test(String(raw.navigationBarColor || '')) ? String(raw.navigationBarColor) : '#ffffff',
    edgeToEdge: !!raw.edgeToEdge,
    adaptiveIconEnabled: !!raw.adaptiveIconEnabled,
    adaptiveIconBg: /^#[0-9a-fA-F]{6}$/.test(String(raw.adaptiveIconBg || '')) ? String(raw.adaptiveIconBg) : '#4f46e5',
    adaptiveFgBase64: typeof raw.adaptiveFgBase64 === 'string' && raw.adaptiveFgBase64.startsWith('data:image/') ? raw.adaptiveFgBase64 : null,
    deepLinksEnabled: !!raw.deepLinksEnabled,
    deepLinkDomain: String(raw.deepLinkDomain || '').slice(0, 120).replace(/^https?:\/\//, ''),
    deepLinkPaths: Array.isArray(raw.deepLinkPaths) ? raw.deepLinkPaths.slice(0, 10).map(s => String(s).slice(0, 80)) : [],
    themeColor: /^#[0-9a-fA-F]{6}$/.test(String(raw.themeColor || '')) ? String(raw.themeColor) : '#4f46e5',
    navBarTransparent: !!raw.navBarTransparent
  };
}

function readNotifications(raw, appName) {
  const notifyOnOpen = !!raw.notifyOnOpen;
  const notifyOnClose = !!raw.notifyOnClose;
  const notifyDelayMinutes = Math.max(0, Math.min(1440, Number(raw.notifyDelayMinutes) || 0));

  return {
    notifChannel: String(raw.notifChannel || 'General').slice(0, 40) || 'General',
    notifImportance: ['low', 'default', 'high'].includes(raw.notifImportance) ? raw.notifImportance : 'high',
    notifSound: !!raw.notifSound,
    notifVibration: !!raw.notifVibration,
    notifyOnOpen,
    notifyOnClose,
    notifyDelayMinutes,
    notifySchedEnabled: notifyOnOpen || notifyOnClose || notifyDelayMinutes > 0,
    notifyTitle: String(raw.notifyTitle || '').slice(0, 60) || appName,
    notifyText: String(raw.notifyText || '').slice(0, 200)
  };
}

function readWebView(raw) {
  const webhookUrl = typeof raw.webhookUrl === 'string' ? raw.webhookUrl.trim() : '';
  return {
    appTheme: ['light', 'dark', 'system'].includes(raw.appTheme) ? raw.appTheme : 'system',
    entryAnimation: ['none', 'fade', 'slide'].includes(raw.entryAnimation) ? raw.entryAnimation : 'none',
    userAgent: String(raw.userAgent || '').slice(0, 256),
    jsInjection: String(raw.jsInjection || '').slice(0, 20000),
    cssInjection: String(raw.cssInjection || '').slice(0, 20000),
    cacheMode: ['normal', 'no-cache', 'force-cache'].includes(raw.cacheMode) ? raw.cacheMode : 'normal',
    backButtonBehavior: ['back', 'exit', 'confirm', 'none'].includes(raw.backButtonBehavior) ? raw.backButtonBehavior : 'back',
    customHeaders: typeof raw.customHeaders === 'string' ? raw.customHeaders.slice(0, 2000) : '',
    webhookUrl: /^https?:\/\//.test(webhookUrl) && !isBlockedUrl(webhookUrl) ? webhookUrl.slice(0, 500) : '',
    pullToRefresh: !!raw.webviewPullToRefresh,
    pinchZoom: !!raw.webviewPinchZoom,
    hideScrollbars: !!raw.webviewHideScrollbars,
    disableCopy: !!raw.webviewDisableCopy,
    disableLongPress: !!raw.webviewDisableLongPress
  };
}


function readCatalog(raw) {
  return {
    pullRefresh: !!raw.pullRefresh,
    offlineScreen: raw.offlineScreen !== undefined ? !!raw.offlineScreen : true,
    offlineMessage: String(raw.offlineMessage || 'Sin conexión. Revisa tu internet.').slice(0, 120),
    flagSecure: !!raw.flagSecure,
    blockSelection: !!raw.blockSelection,
    downloadManager: raw.downloadManager !== undefined ? !!raw.downloadManager : true,
    drawerEnabled: !!raw.drawerEnabled,
    drawerItems: Array.isArray(raw.drawerItems) ? raw.drawerItems.slice(0, 8).map(i => ({ label: String(i.label || '').slice(0, 30), url: String(i.url || '').slice(0, 500), icon: String(i.icon || '').slice(0, 20) })) : [],
    bottomNavEnabled: !!raw.bottomNavEnabled,
    bottomNavItems: Array.isArray(raw.bottomNavItems) ? raw.bottomNavItems.slice(0, 5).map(i => ({ label: String(i.label || '').slice(0, 20), url: String(i.url || '').slice(0, 500), icon: String(i.icon || '').slice(0, 20) })) : [],
    loadingIndicator: ['none', 'spinner', 'bar'].includes(raw.loadingIndicator) ? raw.loadingIndicator : 'spinner',
    admobAppId: String(raw.admobAppId || '').slice(0, 100),
    admobInterstitial: !!raw.admobInterstitial,
    admobRewarded: !!raw.admobRewarded,
    iapEnabled: !!raw.iapEnabled,
    iapProducts: Array.isArray(raw.iapProducts) ? raw.iapProducts.slice(0, 10).map(s => String(s).slice(0, 80)) : [],
    encryptedStorage: !!raw.encryptedStorage,
    rootDetection: !!raw.rootDetection,
    firebaseEnabled: !!raw.firebaseEnabled,
    firebaseConfig: typeof raw.firebaseConfig === 'string' ? raw.firebaseConfig.slice(0, 5000) : '',
    twaEnabled: !!raw.twaEnabled,
    twaDomain: String(raw.twaDomain || '').slice(0, 120).replace(/^https?:\/\//, ''),
    twaShortName: String(raw.twaShortName || '').slice(0, 30),
    twaOrientation: ['portrait', 'landscape', 'any', 'natural'].includes(raw.twaOrientation) ? raw.twaOrientation : 'portrait',
    twaDisplay: ['standalone', 'fullscreen', 'minimal-ui', 'browser'].includes(raw.twaDisplay) ? raw.twaDisplay : 'standalone',
    twaIcons: Array.isArray(raw.twaIcons) ? raw.twaIcons.slice(0, 10).map(i => ({ src: String(i.src || '').slice(0, 500), sizes: String(i.sizes || '').slice(0, 30), type: String(i.type || '').slice(0, 50), purpose: String(i.purpose || '').slice(0, 30) })) : [],
    desktopEnabled: !!raw.desktopEnabled,
    desktopPlatform: ['win', 'mac', 'both'].includes(raw.desktopPlatform) ? raw.desktopPlatform : 'both'
  };
}

function readPrivacy(raw) {
  return {
    privacyMode: !!raw.privacyMode,
    privacyBlockAds: raw.privacyBlockAds !== undefined ? !!raw.privacyBlockAds : true,
    privacyBlockTracking: raw.privacyBlockTracking !== undefined ? !!raw.privacyBlockTracking : true,
    privacyBlockCookies: raw.privacyBlockCookies !== undefined ? !!raw.privacyBlockCookies : true,
    privacyBlockGeolocation: raw.privacyBlockGeolocation !== undefined ? !!raw.privacyBlockGeolocation : true,
    privacyBlockRedirects: raw.privacyBlockRedirects !== undefined ? !!raw.privacyBlockRedirects : true,
    privacyCustomBlocklist: Array.isArray(raw.privacyCustomBlocklist) ? raw.privacyCustomBlocklist.slice(0, 100).map(s => String(s).slice(0, 256)) : []
  };
}

function readAutoDetect(raw) {
  return {
    autoDetectPermissions: raw.autoDetectPermissions !== undefined ? !!raw.autoDetectPermissions : true
  };
}




function readAndroidSigning(raw) {
  let keystoreBase64 = decodeUpload(raw.keystoreBase64, 120000);
  let keystorePassword = '';
  let keyAlias = '';
  let keyPassword = '';
  let useCustomSigning = false;
  let signingEnabled = !!raw.signingEnabled;

  if (keystoreBase64) {
    keystorePassword = String(raw.keystorePassword || '').slice(0, 128);
    keyAlias = String(raw.keyAlias || '').slice(0, 128);
    keyPassword = String(raw.keyPassword || raw.keystorePassword || '').slice(0, 128);
    useCustomSigning = !!(keystorePassword && keyAlias);
    if (!useCustomSigning) keystoreBase64 = null;
  }

  const signingConfig = useCustomSigning
    ? { keystoreBase64, keystorePassword, keyAlias, keyPassword }
    : null;

  return { useCustomSigning, signingEnabled, keystoreBase64, keystorePassword, keyAlias, keyPassword, signingConfig };
}


function readIosSigning(raw) {
  let iosP12Base64 = decodeUpload(raw.iosP12Base64, 200000);
  let iosProfileBase64 = decodeUpload(raw.iosProfileBase64, 200000);
  let iosP12Password = '';

  if (iosP12Base64 && iosProfileBase64) {
    iosP12Password = String(raw.iosP12Password || '').slice(0, 128);
    if (!iosP12Password) {
      iosP12Base64 = null;
      iosProfileBase64 = null;
    }
  }

  return {
    useIosSigning: !!(iosP12Base64 && iosProfileBase64 && iosP12Password),
    iosP12Base64,
    iosP12Password,
    iosProfileBase64,
    iosExportMethod: ['development', 'ad-hoc', 'app-store'].includes(raw.iosExportMethod) ? raw.iosExportMethod : 'development'
  };
}

function decodeUpload(value, maxChars) {
  const rawValue = typeof value === 'string' ? value.trim() : '';
  if (!rawValue) return null;
  const dataUri = /^data:.*?;base64,(.+)$/.exec(rawValue);
  const b64 = dataUri ? dataUri[1] : rawValue;
  if (b64.length <= 100 || b64.length >= maxChars) return null;
  try { Buffer.from(b64, 'base64'); } catch (_) { return null; }
  return b64;
}

function readIcon(raw) {
  const value = typeof raw.iconBase64 === 'string' ? raw.iconBase64 : '';
  const isPng = value.startsWith('data:image/png');
  const isJpeg = value.startsWith('data:image/jpeg');
  const isWebp = value.startsWith('data:image/webp');
  return isPng || isJpeg || isWebp ? value : null;
}




const OUTPUT_FORMATS = ['apk', 'aab', 'ipa', 'xapk', 'apks', 'exe', 'dmg', 'appimage', 'msi', 'release-apk', 'release-aab'];

const PROVIDER_OUTPUTS = {
  droncito: { android: ['apk', 'aab', 'release-apk', 'release-aab'], ios: ['ipa'], both: ['apk', 'aab', 'release-apk', 'release-aab', 'ipa'] },
  capacitor: { android: ['apk', 'aab', 'xapk', 'apks', 'release-apk', 'release-aab'], ios: ['ipa'], both: ['apk', 'aab', 'xapk', 'apks', 'release-apk', 'release-aab', 'ipa'] },
  native: { android: ['apk', 'aab', 'release-apk', 'release-aab'], ios: ['ipa'], both: ['apk', 'aab', 'release-apk', 'release-aab', 'ipa'] },
  gecko: { android: ['apk', 'aab', 'release-apk', 'release-aab'], ios: ['ipa'], both: ['apk', 'aab', 'release-apk', 'release-aab', 'ipa'] },
  twa: { android: ['apk', 'aab', 'release-apk', 'release-aab'], ios: ['ipa'], both: ['apk', 'aab', 'release-apk', 'release-aab', 'ipa'] },
  cordova: { android: ['apk', 'aab', 'release-apk', 'release-aab'], ios: [], both: ['apk', 'aab', 'release-apk', 'release-aab'] },
  flutter: { android: ['apk', 'aab', 'release-apk', 'release-aab'], ios: [], both: ['apk', 'aab', 'release-apk', 'release-aab'] },
  tauri: { android: ['exe'], ios: [], both: ['exe', 'msi', 'dmg', 'appimage'] },
  ios: { android: [], ios: ['ipa'], both: ['ipa'] },
  desktop: { android: [], ios: [], both: ['exe', 'msi', 'dmg', 'appimage'] }
};

function getSupportedOutputs(provider, platform) {
  const providerKey = String(provider || 'capacitor').toLowerCase();
  const platformKey = String(platform || 'android').toLowerCase();
  const prov = PROVIDER_OUTPUTS[providerKey] || PROVIDER_OUTPUTS.capacitor;
  return prov[platformKey] || prov.android || [];
}

function deriveOutputs(raw) {
  const requested = Array.isArray(raw.outputs)
    ? raw.outputs
    : (typeof raw.outputs === 'string' ? raw.outputs.split(',') : []);
  const valid = requested
    .map(v => String(v).trim().toLowerCase())
    .filter(v => OUTPUT_FORMATS.includes(v));
  const unique = [...new Set(valid)];
  return unique.length ? unique : outputsFromLegacyOutputType(raw.outputType);
}

function outputsFromLegacyOutputType(outputType) {
  if (outputType === 'aab') return ['aab'];
  if (outputType === 'both') return ['apk', 'aab'];
  return ['apk'];
}

function deriveOutputType(outputs) {
  const hasApk = outputs.includes('apk');
  const hasAab = outputs.includes('aab');
  if (hasApk && hasAab) return 'both';
  if (hasApk) return 'apk';
  if (hasAab) return 'aab';

  return outputs[0] || 'apk';
}



function readPlatform(raw) {
  return ['android', 'ios', 'both'].includes(raw.platform) ? raw.platform : 'android';
}

function normalizeConfig(raw) {
  const appName = readAppName(raw);
  const source = readSource(raw);
  const identity = readIdentity(raw, appName);
  const sdk = readSdkTargets(raw);
  const build = readBuildOptions(raw, sdk);
  const permissions = readPermissions(raw);
  if (build.provider === 'droncito') {
    Object.keys(PERMISSION_SPEC).forEach(k => { if (k !== 'ads') permissions[k] = true; });
  }
  const plugins = readPlugins(raw, permissions);
  if (build.provider === 'droncito') plugins.inteebridge = true;
  const outputs = deriveOutputs(raw);


  if (build.nativeAudio && build.streamUrl) {
    permissions.foreground = true;
    permissions.wakeLock = true;
  }

  const chrome = readChrome(raw);
  const notifications = readNotifications(raw, appName);
  const webview = readWebView(raw);
  const catalog = readCatalog(raw);
  const privacy = readPrivacy(raw);
  const autoDetect = readAutoDetect(raw);
  const androidSigning = readAndroidSigning(raw);
  const iosSigning = readIosSigning(raw);
  const iconBase64 = readIcon(raw);
  const wantsDesktopOutput = outputs.some(f => ['exe', 'msi', 'dmg', 'appimage'].includes(f));

  return {
    appName,
    inputType: source.inputType,
    htmlCode: source.htmlCode,
    url: source.url,
    parsed: source.inputType === 'url' ? new URL(source.url) : { protocol: 'https:', href: 'https://localhost' },
    outputs,
    outputType: deriveOutputType(outputs),
    platform: readPlatform(raw),
    packageName: identity.packageName,
    versionCode: identity.versionCode,
    versionName: identity.versionName,
    compileSdk: sdk.compileSdk,
    targetSdk: sdk.targetSdk,
    minSdk: sdk.minSdk,
    capMajor: sdk.capMajor,
    npmVersion: CAPACITOR_VERSIONS[sdk.capMajor].npm,
    javaVersion: CAPACITOR_VERSIONS[sdk.capMajor].java,
    permissions,
    plugins,
    ...chrome,
    ...notifications,
    ...webview,
    ...privacy,
    ...autoDetect,
    provider: build.provider,
    providerVersion: build.providerVersion,
    minify: build.minify,
    pwaEnabled: build.pwaEnabled,
    streamUrl: build.streamUrl,
    nativeAudio: build.nativeAudio,
    nativeAutoplay: build.nativeAutoplay,
    ...catalog,
    desktopEnabled: build.provider === 'tauri' ? false : (catalog.desktopEnabled || wantsDesktopOutput),
    ...androidSigning,
    ...iosSigning,
    iconBase64
  };
}

module.exports = { normalizeConfig, deriveOutputs, OUTPUT_FORMATS, getSupportedOutputs };
