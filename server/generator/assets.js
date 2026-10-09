'use strict';

const fs = require('fs');
const path = require('path');
const { iosSignScriptSrc } = require('./signing');

function iconPng(base64) {
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/.exec(base64);
  if (!match) return null;
  try {
    const buf = Buffer.from(match[2], 'base64');
    if (buf.length > 5 * 1024 * 1024) return null;
    return buf;
  } catch (_) {
    return null;
  }
}

function iconFiles(cfg, icon) {
  const files = {};
  if (icon) files['app-icon.png'] = icon;
  if (!cfg.adaptiveIconEnabled) return files;

  const foreground = cfg.adaptiveFgBase64 ? iconPng(cfg.adaptiveFgBase64) : icon;
  if (foreground) files['adaptive-foreground.png'] = foreground;
  files['adaptive-ic_launcher.xml'] = `<?xml version="1.0" encoding="utf-8"?><adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/ic_launcher_background"/><foreground android:drawable="@mipmap/ic_launcher_foreground"/></adaptive-icon>`;
  files['adaptive-ic_launcher_round.xml'] = `<?xml version="1.0" encoding="utf-8"?><adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/ic_launcher_background"/><foreground android:drawable="@mipmap/ic_launcher_foreground"/></adaptive-icon>`;
  files['adaptive-bg.xml'] = `<?xml version="1.0" encoding="utf-8"?><resources><color name="ic_launcher_background">${cfg.adaptiveIconBg}</color></resources>`;
  return files;
}

function colorFiles(cfg) {
  const usesCustomColors = cfg.accentColor !== '#4f46e5'
    || cfg.statusBarColor !== '#ffffff'
    || cfg.navigationBarColor !== '#ffffff';
  if (!usesCustomColors) return {};

  return {
    'custom-colors.xml': `<?xml version="1.0" encoding="utf-8"?><resources><color name="theme_color">${cfg.themeColor || cfg.accentColor}</color><color name="colorPrimary">${cfg.accentColor}</color><color name="colorPrimaryDark">${cfg.statusBarColor}</color><color name="colorAccent">${cfg.accentColor}</color></resources>`
  };
}

function androidSigningFiles(cfg) {
  if (!cfg.useCustomSigning) return {};

  return {
    'user-keystore.jks': Buffer.from(cfg.keystoreBase64, 'base64'),
    'signing.properties': `storePassword=${cfg.keystorePassword}\nkeyAlias=${cfg.keyAlias}\nkeyPassword=${cfg.keyPassword}\nstoreFile=release.jks\n`
  };
}

function iosSigningFiles(cfg) {
  if (!cfg.useIosSigning) return {};

  return {
    'ios-cert.p12': Buffer.from(cfg.iosP12Base64, 'base64'),
    'ios-profile.mobileprovision': Buffer.from(cfg.iosProfileBase64, 'base64'),
    'ios-sign.json': JSON.stringify({ p12Password: cfg.iosP12Password }, null, 2),
    'ios-sign.js': iosSignScriptSrc()
  };
}

function bridgeFile(cfg) {
  if (!cfg.plugins.inteebridge) return {};
  try {
    const bridgeSrc = path.join(__dirname, '..', '..', 'js', 'inteebridge.js');
    return { 'inteebridge-inject.js': fs.readFileSync(bridgeSrc, 'utf-8') };
  } catch (_) {
    return { 'inteebridge-inject.js': '// InteeBridge not found' };
  }
}

function assetFiles(cfg) {
  const files = iconFiles(cfg, iconPng(cfg.iconBase64));
  Object.assign(files, colorFiles(cfg), androidSigningFiles(cfg), iosSigningFiles(cfg), bridgeFile(cfg));

  if (cfg.jsInjection) files['www/inject.js'] = cfg.jsInjection;
  if (cfg.cssInjection) files['www/inject.css'] = cfg.cssInjection;
  return files;
}

module.exports = { assetFiles };
