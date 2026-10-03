'use strict';

const { PERMISSION_SPEC, runtimeBatchConsts, wantsBackground, specialNeeds, needsSpecialFile } = require('./permissions');
const { VALID_COMPILE_SDKS, VALID_TARGET_SDKS, VALID_MIN_SDKS } = require('./versions');
const { permissionManifestBlocks, hardwareFeatureBlocks, nfcTechFilterXml, generateAndroidManifest } = require('./manifest');
const { nativePermissionsJavaSrc, specialAccessJavaSrc, patchPermissionsSrc, patchSpecialSrc } = require('./runtime');
const { nativeAudioServiceSrc, audioBridgeSrc, mainActivityPatchSrc, patchAudioSrc } = require('./audio');
const { droncitoBridgeJavaSrc, droncitoPatchSrc, droncitoNativePatchSrc, droncitoGradlePatchSrc, droncitoNeedsGradle } = require('./droncito');
const { WORKFLOW_YML, DECOMPILE_WORKFLOW_YML } = require('./workflow');
const { getPermissionAudit, suggestPermissionsFromApis } = require('./audit');

const { normalizeConfig } = require('./config');
const { packageFiles } = require('./package-files');
const { assetFiles } = require('./assets');
const { starterHtml, catalogFiles, finalizeWebAssets } = require('./web-assets');
const { providerFiles, integrationFiles, platformProjects, finalizeFlutterProject } = require('./platforms');
const { buildPlayListing } = require('./listing');



function needsRuntimeBatch(cfg) {
  return Object.entries(cfg.permissions).some(([k, v]) => v && PERMISSION_SPEC[k]?.runtime) || cfg.notifySchedEnabled;
}

function foregroundAudioFiles(cfg) {
  if (!cfg.permissions.foreground) return {};

  const useNativeAudio = cfg.nativeAudio && cfg.streamUrl;
  return {
    'RadioService.java': nativeAudioServiceSrc(cfg.packageName, cfg.streamUrl || '', !!(useNativeAudio && cfg.nativeAutoplay), cfg.appName),
    'AudioBridge.java': audioBridgeSrc(cfg.packageName),
    'patch-main-activity.js': mainActivityPatchSrc(),
    'patch-audio.js': patchAudioSrc()
  };
}

function generateFiles(cfg) {
  const files = packageFiles(cfg);
  files['main-manifest.xml'] = generateAndroidManifest(cfg);
  files['.github/workflows/build-app.yml'] = WORKFLOW_YML;
  files['www/index.html'] = starterHtml(cfg);

  Object.assign(files, assetFiles(cfg));
  Object.assign(files, providerFiles(cfg));

  if (needsRuntimeBatch(cfg)) {
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



  if (droncitoNeedsGradle(cfg)) {
    files['DroncitoBridge.java'] = droncitoBridgeJavaSrc(cfg.packageName);
    files['patch-droncito.js'] = droncitoPatchSrc();
    files['patch-droncito-native.js'] = droncitoNativePatchSrc();
    files['patch-droncito-gradle.js'] = droncitoGradlePatchSrc();
  }

  Object.assign(files, catalogFiles(cfg));
  Object.assign(files, integrationFiles(cfg));
  Object.assign(files, platformProjects(cfg));
  Object.assign(files, foregroundAudioFiles(cfg));


  finalizeWebAssets(files, cfg);
  finalizeFlutterProject(files);
  return files;
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
  DECOMPILE_WORKFLOW_YML,
  VALID_COMPILE_SDKS,
  VALID_TARGET_SDKS,
  VALID_MIN_SDKS
};
