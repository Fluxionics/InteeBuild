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
  screenReader: { 6: '^6.0.0', 7: '^7.0.0' },
  // AdMob Native Android
  googleMobileAds: '^22.0.0',
  flutterAdmob: '^2.0.0'
};


function pv(name, cap) {
  const v = PLUGIN_VERSIONS[name];
  if (!v) return '^1.0.0';
  if (typeof v === 'string') return v;
  return v[cap] || v[7];
}


module.exports = {
  CAPACITOR_VERSIONS,
  VALID_COMPILE_SDKS,
  VALID_TARGET_SDKS,
  VALID_MIN_SDKS,
  PLUGIN_VERSIONS,
  pv
};
