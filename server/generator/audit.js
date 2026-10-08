'use strict';

const { PERMISSION_SPEC, BG_LOCATION, MANAGE_STORAGE, runtimeBatchConsts, needsSpecialFile } = require('./permissions');
const { permissionManifestBlocks } = require('./manifest');

function getPermissionAudit(cfg){
  const selected = Object.entries(cfg.permissions||{}).filter(([,v])=>v).map(([k])=>k);
  const targetSdk = cfg.targetSdk||35;
  const provider = cfg.provider||'capacitor';
  let manifestXml='';
  try{ manifestXml = permissionManifestBlocks(cfg); }catch{ manifestXml=''; }
  let featureXml='';
  try{ featureXml = hardwareFeatureBlocks(cfg); }catch{ featureXml=''; }
  const batch = runtimeBatchConsts(cfg);
  const batchShort = batch.map(c=>c.split('.').pop());
  const specialOn = needsSpecialFile(cfg);
  const READY_ANDROID = ['capacitor', 'native', 'droncito', 'twa', 'gecko'];
  const RUNTIME_OF = { capacitor: 'capacitor', twa: 'capacitor', native: 'native', droncito: 'native', gecko: 'native' };
  const CI_ANDROID = ['flutter', 'tauri', 'react-native', 'ionic', 'cordova'];
  const res = selected.map(key=>{
    const spec = PERMISSION_SPEC[key];
    if(!spec) return {key, title:key, manifest:'MISSING', runtime:'MISSING', native:'MISSING', bridge:'MISSING', version:'UNKNOWN', special:null, status:'fail', verified:false, mechanism:'missing'};
    const manifestGenerated = spec.manifest.length > 0 && spec.manifest.every(m=>manifestXml.includes(m));
    const manifest = manifestGenerated ? 'GENERATED OK' : 'SPEC ONLY, NOT GENERATED';
    const needsRuntime = !!spec.runtime;
    const isBg = spec.manifest.includes(BG_LOCATION);
    const isManage = spec.manifest.includes(MANAGE_STORAGE);
    const impl = spec.impl || {};
    let mechanism, runtime, native;
    if (key === 'ads') {
      mechanism = 'missing';
      runtime = 'N/A';
      native = 'NO GENERADO (requiere AdMob App ID + SDK, no incluido)';
    } else if (isBg) {
      mechanism = 'background';
      runtime = targetSdk >= spec.minSdk ? 'GENERATED (two-step: foreground primero, BACKGROUND después)' : 'REQUIRES ANDROID '+spec.minSdk+'+';
      native = 'GENERATED (NativePermissions.requestBackground)';
    } else if (isManage) {
      mechanism = 'special';
      runtime = 'N/A (va por Settings, no por diálogo)';
      native = specialOn ? 'GENERATED (SpecialAccess.ensure → Settings)' : 'SPEC ONLY, NOT GENERATED';
    } else if (needsRuntime) {
      mechanism = 'runtime';
      const mine = spec.manifest.map(m=>m.split('.').pop()).filter(s=>batchShort.includes(s));
      runtime = targetSdk >= spec.minSdk ? 'GENERATED (NativePermissions.request)' : 'REQUIRES ANDROID '+spec.minSdk+'+';
      native = mine.length ? 'GENERATED (batch: ' + mine.join(', ') + ')' : 'SPEC ONLY, NOT GENERATED';
    } else if (spec.specialAccess && (key==='systemAlert' || key==='systemAlertWindow' || key==='installPackages' || key==='requestInstallPackages' || key==='alarmSchedule' || key==='alarm' || key==='scheduleExactAlarm')) {
      mechanism = 'special';
      runtime = 'N/A (va por Settings, no por diálogo)';
      native = specialOn ? 'GENERATED (SpecialAccess.ensure → Settings)' : 'SPEC ONLY, NOT GENERATED';
    } else {
      mechanism = 'install-time';
      runtime = 'N/A (se concede al instalar)';
      native = 'GENERATED (manifest' + (key === 'nfc' ? ' + uses-feature + tech filter' : '') + ')';
    }
    const bridge = impl.bridge || 'n/a';
    const capability = impl.native || '';
    const rt = RUNTIME_OF[provider] || provider;
    let providerOk;
    if (READY_ANDROID.includes(provider) && (!impl.providerOk || impl.providerOk.includes(rt))) providerOk = 'OK ('+provider+')';
    else if (READY_ANDROID.includes(provider)) providerOk = 'WARN ('+provider+' sin handler declarado para este permiso)';
    else if (CI_ANDROID.includes(provider)) providerOk = 'WARN ('+provider+' compila APK en CI, permisos por runtime de la app)';
    else providerOk = 'WARN ('+provider+' solo genera proyecto, sin APK)';
    const version = (spec.minSdk && targetSdk < spec.minSdk) ? 'WARN' : ((spec.maxSdk && targetSdk > spec.maxSdk) ? 'WARN (solo hasta API '+spec.maxSdk+')' : 'OK');
    const verified = manifestGenerated && !native.startsWith('SPEC ONLY') && !native.startsWith('NO GENERADO') && !native.startsWith('MISSING');
    let status='ok';
    if(!verified) status='fail';
    else if(version!=='OK' || providerOk.startsWith('WARN') || spec.specialAccess) status='warn';
    if(key==='gpsBackground' && !cfg.permissions.gps) status='fail';
    if(key==='accessBackgroundLocation' && !(cfg.permissions.gps || cfg.permissions.accessFineLocation || cfg.permissions.accessCoarseLocation)) status='fail';
    if(key==='advGeo' && !(cfg.permissions.gps || cfg.permissions.accessFineLocation || cfg.permissions.accessCoarseLocation)) status='warn';
    return {key, title:spec.title, manifest, runtime, native, bridge, capability, mechanism, handler:spec.handler, version, special:spec.specialAccess||spec.legacyNote||null, provider:providerOk, status, minSdk:spec.minSdk, api:spec.api, verified};
  });
  const ok=res.filter(r=>r.status==='ok').length;
  const total=res.length;
  const readiness = total? Math.round((ok/total)*100) : 100;
  return {items:res, ok, total, readiness, canBuild: res.every(r=>r.status!=='fail'), verifiedAll: res.every(r=>r.verified)};
}


function suggestPermissionsFromApis(detectedApis){
  const map={ geolocation:'gps', camera:'cameraMic', microphone:'microphone', bluetooth:'bluetooth', nfc:'nfc', notifications:'notifications', vibration:'vibration', share:'share', wakelock:'wakeLock', clipboard:'clipboard', ar:'ar', voice:'voiceRec', sensors:'envSensors', ai:'aiSuite', power:'powerMgmt', adaptive:'adaptiveNotif', security:'advSecurity', social:'socialAnalytics', advgeo:'advGeo', data:'dataAnalytics', vr:'vr', chain:'blockchain', block:'blockchain', rpa:'rpa', vuln:'vulnScan', emo:'emoAI', iot:'iot', mr:'mr' };
  return (detectedApis||[]).map(api=>map[api]).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).map(k=>({key:k, spec:PERMISSION_SPEC[k]}));
}


module.exports = {
  getPermissionAudit,
  suggestPermissionsFromApis
};
