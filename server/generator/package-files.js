'use strict';

const { PLUGIN_VERSIONS, pv } = require('./versions');

function capacitorConfig(cfg) {
  const config = {
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
    config.android.webContentsDebuggingEnabled = false;
  }

  if (cfg.splashEnabled) {
    config.plugins = {
      SplashScreen: {
        launchAutoHide: true,
        launchShowDuration: cfg.splashDuration,
        backgroundColor: cfg.splashColor,
        showSpinner: false,
        androidScaleType: 'CENTER_CROP',
        splashFullScreen: cfg.fullscreen,
        splashImmersive: true
      }
    };
  }

  if (cfg.plugins.statusBar || cfg.edgeToEdge) {
    config.plugins = config.plugins || {};
    config.plugins.StatusBar = {
      style: cfg.appTheme === 'dark' ? 'DARK' : 'LIGHT',
      backgroundColor: cfg.statusBarColor,
      overlaysWebView: cfg.edgeToEdge
    };
  }

  if (cfg.plugins.notifications) {
    config.plugins = config.plugins || {};
    config.plugins.PushNotifications = { presentationOptions: ['badge', 'sound', 'alert'] };
  }

  return config;
}



function appDependencies(cfg) {
  const cap = cfg.capMajor;
  const deps = {
    '@capacitor/cli': pv('core', cap),
    '@capacitor/core': pv('core', cap),
    '@capacitor/android': pv('core', cap)
  };
  if (cfg.platform === 'ios' || cfg.platform === 'both') deps['@capacitor/ios'] = pv('core', cap);

  if (cfg.plugins.camera) deps['@capacitor/camera'] = pv('camera', cap);
  if (cfg.plugins.geolocation) deps['@capacitor/geolocation'] = pv('geolocation', cap);
  if (cfg.plugins.share) deps['@capacitor/share'] = pv('share', cap);
  if (cfg.plugins.filesystem) deps['@capacitor/filesystem'] = pv('filesystem', cap);
  if (cfg.plugins.haptics) deps['@capacitor/haptics'] = pv('haptics', cap);
  if (cfg.plugins.clipboard) deps['@capacitor/clipboard'] = pv('clipboard', cap);
  if (cfg.plugins.biometrics) deps['@capgo/capacitor-native-biometric'] = pv('biometrics', cap);
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
  if (cfg.plugins.bluetooth) deps['@capacitor-community/bluetooth-le'] = pv('bluetoothLe', cap);
  if (cfg.plugins.nfc) deps['phonegap-nfc'] = PLUGIN_VERSIONS.nfc;
  if (cfg.plugins.admob) deps['@capacitor-community/admob'] = pv('admob', cap);



  if (cfg.plugins.voice) deps['@capacitor-community/speech-recognition'] = pv('speechRecognition', cap);
  if (cfg.plugins.adaptiveNotif) deps['@capacitor/local-notifications'] = pv('localNotifications', cap);
  if (cfg.plugins.advGeo) deps['@capacitor/geolocation'] = pv('geolocation', cap);
  if (cfg.plugins.dynamicUI) deps['@capacitor/preferences'] = pv('preferences', cap);

  if (cfg.encryptedStorage) deps['capacitor-secure-storage-plugin'] = pv('secureStorage', cap);
  if (cfg.firebaseEnabled) {
    deps['@capacitor-firebase/analytics'] = pv('firebaseAnalytics', cap);
    deps['@capacitor-firebase/crashlytics'] = pv('firebaseCrashlytics', cap);
  }

  return deps;
}



function buildConfig(cfg) {
  return {
    buildId: cfg._buildId,
    appName: cfg.appName,
    url: cfg.url,
    inputType: cfg.inputType,
    packageName: cfg.packageName,
    provider: cfg.provider,
    providerVersion: cfg.providerVersion,
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
  };
}

function appReadme(cfg) {
  const enabledPlugins = Object.entries(cfg.plugins).filter(([, v]) => v).map(([k]) => k).join(', ') || 'ninguno';
  return `# ${cfg.appName}\n\nGenerado con [InteeBuild](https://inteebuild.com)\n\n- URL: ${cfg.url}\n- Package: ${cfg.packageName}\n- compileSdk: ${cfg.compileSdk} / targetSdk: ${cfg.targetSdk} / minSdk: ${cfg.minSdk}\n- Plugins: ${enabledPlugins}\n\n## InteeBridge\n\nSi activaste InteeBridge, usa \`Intee.location()\`, \`Intee.camera()\`, etc. desde tu web.\n`;
}

function packageFiles(cfg) {
  return {
    'package.json': JSON.stringify({
      name: 'inteebuild-app',
      version: cfg.versionName,
      private: true,
      scripts: { sync: 'cap sync', build: 'cap build android' },
      dependencies: appDependencies(cfg)
    }, null, 2),

    'capacitor.config.json': JSON.stringify(capacitorConfig(cfg), null, 2),

    'build-config.json': JSON.stringify(buildConfig(cfg), null, 2),

    'README.md': appReadme(cfg)
  };
}

module.exports = { packageFiles };
