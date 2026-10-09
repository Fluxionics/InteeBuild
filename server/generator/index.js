'use strict';

const { PERMISSION_SPEC, runtimeBatchConsts, wantsBackground, specialNeeds, needsSpecialFile } = require('./permissions');
const { VALID_COMPILE_SDKS, VALID_TARGET_SDKS, VALID_MIN_SDKS } = require('./versions');
const { permissionManifestBlocks, hardwareFeatureBlocks, nfcTechFilterXml, patchNfcSrc, generateAndroidManifest } = require('./manifest');
const { nativePermissionsJavaSrc, specialAccessJavaSrc, patchPermissionsSrc, patchSpecialSrc } = require('./runtime');
const { nativeAudioServiceSrc, audioBridgeSrc, mainActivityPatchSrc, patchAudioSrc } = require('./audio');
const { droncitoBridgeJavaSrc, droncitoPatchSrc, droncitoNativePatchSrc, droncitoGradlePatchSrc, droncitoNeedsGradle } = require('./droncito');
const { WORKFLOW_YML, DECOMPILE_WORKFLOW_YML } = require('./workflow');
const { getPermissionAudit, suggestPermissionsFromApis } = require('./audit');

const { normalizeConfig, getSupportedOutputs } = require('./config');
const { packageFiles } = require('./package-files');
const { assetFiles } = require('./assets');
const { starterHtml, catalogFiles, finalizeWebAssets } = require('./web-assets');
const { providerFiles, integrationFiles, platformProjects, finalizeFlutterProject } = require('./platforms');
const { generateTwaScriptSrc } = require('./twa-script');
const { generateIconScriptSrc } = require('./icon-script');
const { buildPlayListing } = require('./listing');

const { Buffer } = require('buffer');


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


function networkSecurityConfig(cfg) {
  return `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="${cfg.useCleartext ? 'true' : 'false'}">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="${cfg.useCleartext ? 'true' : 'false'}">
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">127.0.0.1</domain>
    </domain-config>
</network-security-config>`;
}

function decodeBase64Image(base64Data) {
  const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) return null;
  const ext = matches[1];
  const b64 = matches[2];
  try {
    return { buffer: Buffer.from(b64, 'base64'), ext };
  } catch {
    return null;
  }
}

function splashScreenFiles(cfg) {
  if (!cfg.splashEnabled || !cfg.splashImageBase64) return {};

  const decoded = decodeBase64Image(cfg.splashImageBase64);
  if (!decoded) return {};

  const pkgPath = cfg.packageName.replace(/\./g, '/');
  const files = {};

  files[`android/app/src/main/res/drawable/splash_image.${decoded.ext}`] = decoded.buffer;

  files['android/app/src/main/res/drawable/splash_background.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="${cfg.splashBgColor || '#ffffff'}" />
    <item>
        <bitmap
            android:gravity="center"
            android:src="@drawable/splash_image" />
    </item>
</layer-list>`;

  const animationType = cfg.splashAnimation === 'slide' ? 'slide_up' : 'fade_in';
  const duration = cfg.splashDuration || 2000;

  files['android/app/src/main/res/anim/splash_fade_in.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<alpha xmlns:android="http://schemas.android.com/apk/res/android"
    android:duration="${duration}"
    android:fromAlpha="0.0"
    android:toAlpha="1.0" />`;

  files['android/app/src/main/res/anim/splash_slide_up.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<translate xmlns:android="http://schemas.android.com/apk/res/android"
    android:duration="${duration}"
    android:fromYDelta="100%"
    android:toYDelta="0%" />`;

  files['android/app/src/main/res/layout/splash_screen.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/splash_background">

    <ImageView
        android:id="@+id/splashImage"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:scaleType="centerCrop"
        android:src="@drawable/splash_image" />

</FrameLayout>`;

  files[`android/app/src/main/java/${pkgPath}/SplashActivity.java`] = `package ${cfg.packageName};

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.view.animation.Animation;
import android.view.animation.AnimationUtils;
import android.widget.ImageView;
import androidx.appcompat.app.AppCompatActivity;

public class SplashActivity extends AppCompatActivity {
    private static final int SPLASH_DURATION = ${duration};

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.splash_screen);

        ImageView splashImage = findViewById(R.id.splashImage);
        Animation anim = AnimationUtils.loadAnimation(this, R.anim.splash_${animationType});
        splashImage.startAnimation(anim);

        new Handler().postDelayed(() => {
            Intent intent = new Intent(SplashActivity.this, MainActivity.class);
            startActivity(intent);
            finish();
        }, SPLASH_DURATION);
    }
}`;

  return files;
}

function themeColorFiles(cfg) {
  if (!cfg.themeColor) return {};

  const files = {};
  const launchBg = cfg.splashEnabled && cfg.splashImageBase64
    ? `
        <item name="android:windowBackground">@drawable/splash_background</item>`
    : '';

  files['android/app/src/main/res/values/colors.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="theme_color">${cfg.themeColor}</color>
    <color name="colorPrimary">${cfg.themeColor}</color>
    <color name="colorPrimaryDark">${cfg.themeColor}</color>
    <color name="colorAccent">${cfg.accentColor || '#4f46e5'}</color>
</resources>`;

  files['android/app/src/main/res/values/styles.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.DayNight.DarkActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
        <item name="android:statusBarColor">@color/theme_color</item>
        <item name="android:navigationBarColor">${cfg.navBarTransparent ? '@android:color/transparent' : '@color/theme_color'}</item>
        <item name="android:windowTranslucentNavigation">${cfg.navBarTransparent ? 'true' : 'false'}</item>
        <item name="android:windowLightStatusBar">false</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="AppTheme">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>${launchBg}
    </style>
</resources>`;

  return files;
}

function privacyModeFiles(cfg) {
  if (!cfg.privacyMode) return {};

  const pkgPath = cfg.packageName.replace(/\./g, '/');
  const files = {};

  const blocklist = {
    ads: cfg.privacyBlockAds !== false ? [
      "googleads.g.doubleclick.net",
      "pagead2.googlesyndication.com",
      "adservice.google.com",
      "ad.doubleclick.net",
      "ads.youtube.com",
      "adnxs.com",
      "adroll.com",
      "adsystem.amazon.com",
      "amazon-adsystem.com",
      "analytics.twitter.com",
      "bat.bing.com",
      "bidswitch.net",
      "casalemedia.com",
      "criteo.com",
      "facebook.net",
      "googletagservices.com",
      "mathtag.com",
      "moatads.com",
      "openx.net",
      "pubmatic.com",
      "quantserve.com",
      "rubiconproject.com",
      "scorecardresearch.com",
      "taboola.com",
      "tapad.com",
      "triplelift.com",
      "turn.com",
      "yieldmo.com"
    ] : [],
    tracking: cfg.privacyBlockTracking !== false ? [
      "google-analytics.com",
      "analytics.google.com",
      "stats.g.doubleclick.net",
      "connect.facebook.net",
      "pixel.facebook.com",
      "www.google-analytics.com",
      "www.googletagmanager.com",
      "googletagmanager.com",
      "mc.yandex.ru",
      "matomo.org",
      "piwik.org",
      "segment.com",
      "segment.io",
      "mixpanel.com",
      "amplitude.com",
      "heap.io",
      "fullstory.com",
      "hotjar.com",
      "mouseflow.com",
      "inspectlet.com",
      "luckyorange.com",
      "smartlook.com"
    ] : [],
    custom: cfg.privacyCustomBlocklist || []
  };

  files['android/app/src/main/assets/privacy_rules.json'] = JSON.stringify(blocklist, null, 2);

  files[`android/app/src/main/java/${pkgPath}/PrivacyWebViewClient.java`] = `package ${cfg.packageName};

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.HashSet;
import java.util.Set;

public class PrivacyWebViewClient extends WebViewClient {
    private static final String TAG = "PrivacyWebViewClient";
    private final Context context;
    private final Set<String> blockedDomains = new HashSet<>();
    private final boolean blockCookies;
    private final boolean blockGeolocation;
    private final boolean blockRedirects;
    private boolean privacyInjected = false;

    public PrivacyWebViewClient(Context context, boolean blockCookies, boolean blockGeolocation, boolean blockRedirects) {
        this.context = context;
        this.blockCookies = blockCookies;
        this.blockGeolocation = blockGeolocation;
        this.blockRedirects = blockRedirects;
        loadBlocklist();
    }

    private void loadBlocklist() {
        try {
            InputStream is = context.getAssets().open("privacy_rules.json");
            BufferedReader reader = new BufferedReader(new InputStreamReader(is));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) sb.append(line);
            reader.close();

            JSONObject json = new JSONObject(sb.toString());
            addDomainsFromJson(json, "ads");
            addDomainsFromJson(json, "tracking");
            addDomainsFromJson(json, "custom");
            Log.d(TAG, "Loaded " + blockedDomains.size() + " blocked domains");
        } catch (IOException | JSONException e) {
            Log.w(TAG, "Failed to load privacy blocklist", e);
        }
    }

    private void addDomainsFromJson(JSONObject json, String key) {
        try {
            if (json.has(key)) {
                JSONArray arr = json.getJSONArray(key);
                for (int i = 0; i < arr.length(); i++) {
                    blockedDomains.add(arr.getString(i).toLowerCase());
                }
            }
        } catch (JSONException ignored) {}
    }

    private boolean isBlocked(String url) {
        if (url == null) return false;
        try {
            Uri uri = Uri.parse(url);
            String host = uri.getHost();
            if (host == null) return false;
            host = host.toLowerCase();
            for (String blocked : blockedDomains) {
                if (host.equals(blocked) || host.endsWith("." + blocked)) {
                    return true;
                }
            }
        } catch (Exception ignored) {}
        return false;
    }

    @Override
    public boolean shouldOverrideUrlLoading(@NonNull WebView view, @NonNull WebResourceRequest request) {
        String url = request.getUrl().toString();
        if (blockRedirects && (url.startsWith("intent://") || url.startsWith("market://") || url.startsWith("whatsapp://"))) {
            Log.d(TAG, "Blocking redirect: " + url);
            return true;
        }
        if (isBlocked(url)) {
            Log.d(TAG, "Blocking request to: " + url);
            return true;
        }
        return super.shouldOverrideUrlLoading(view, request);
    }

    @Override
    public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        if (!privacyInjected) {
            injectPrivacyScript(view);
            privacyInjected = true;
        }
    }

    private void injectPrivacyScript(WebView view) {
        StringBuilder js = new StringBuilder();
        js.append("(function(){");
        js.append("try{");
        
        if (blockCookies) {
            js.append("document.cookie='';");
            js.append("Object.defineProperty(document,'cookie',{get:function(){return '';},set:function(){}});");
        }

        if (blockGeolocation) {
            js.append("if(navigator.geolocation){");
            js.append("navigator.geolocation.getCurrentPosition=function(){};");
            js.append("navigator.geolocation.watchPosition=function(){};");
            js.append("}");
        }

        js.append("if(navigator.mediaDevices){");
        js.append("navigator.mediaDevices.getUserMedia=function(){return Promise.reject(new DOMException('Blocked by privacy mode','NotAllowedError'));};");
        js.append("}");

        js.append("if(window.Notification){");
        js.append("window.Notification.requestPermission=function(){return Promise.resolve('denied');};");
        js.append("Object.defineProperty(window.Notification,'permission',{value:'denied',writable:false});");
        js.append("}");

        js.append("Object.defineProperty(navigator,'hardwareConcurrency',{value:4});");
        js.append("Object.defineProperty(navigator,'deviceMemory',{value:4});");
        js.append("if(window.screen){");
        js.append("Object.defineProperty(screen,'colorDepth',{value:24});");
        js.append("Object.defineProperty(screen,'pixelDepth',{value:24});");
        js.append("}");

        if (blockedDomains.size() > 0) {
            js.append("var blocked=" + new JSONArray(blockedDomains).toString() + ";");
            js.append("var originalFetch=window.fetch;");
            js.append("window.fetch=function(url,opts){");
            js.append("try{var u=new URL(url);if(blocked.some(b=>u.hostname===b||u.hostname.endsWith('.'+b))){return Promise.reject(new Error('Blocked'));}}catch(e){}");
            js.append("return originalFetch.apply(this,arguments);};");
            js.append("var originalXHR=XMLHttpRequest.prototype.open;");
            js.append("XMLHttpRequest.prototype.open=function(method,url){");
            js.append("try{var u=new URL(url,location.href);if(blocked.some(b=>u.hostname===b||u.hostname.endsWith('.'+b))){throw new Error('Blocked');}}catch(e){}");
            js.append("return originalXHR.apply(this,arguments);};");
        }

        js.append("}catch(e){}");
        js.append("})();");

        view.evaluateJavascript(js.toString(), null);
    }
}`;

  return files;
}

function webViewSettingsPatch(cfg) {
  if (!cfg.provider || (cfg.provider !== 'native' && cfg.provider !== 'capacitor' && cfg.provider !== 'droncito')) return '';

  const NL = String.fromCharCode(10);
  const pkg = cfg.packageName;
  const mp = `android/app/src/main/java/${pkg.replace(/\./g, '/')}/MainActivity.java`;

  let patch = `const fs=require('fs');
const NL=String.fromCharCode(10);
const pkg='${pkg}';
const mp='${mp}';
let src=fs.readFileSync(mp,'utf8');
let changed=false;

`;

  if (cfg.pinchZoom !== undefined || cfg.disableCopy || cfg.disableLongPress || cfg.pullToRefresh) {
    patch += `if(src.indexOf('WebView')!==-1 && src.indexOf('setBuiltInZoomControls')===-1){`;
    patch += NL;

    const settings = [];
    if (cfg.pinchZoom) {
      settings.push('wv.getSettings().setBuiltInZoomControls(true); wv.getSettings().setDisplayZoomControls(false);');
    } else {
      settings.push('wv.getSettings().setBuiltInZoomControls(false); wv.getSettings().setDisplayZoomControls(false);');
    }
    if (cfg.disableCopy) {
      settings.push('wv.getSettings().setAllowFileAccess(false);');
    }
    if (cfg.disableLongPress) {
      settings.push('wv.setOnLongClickListener(v -> true);');
    }

    patch += `  src=src.replace(/wv\\.getSettings\\(\\)\\.setJavaScriptEnabled\\(true\\);/,'wv.getSettings().setJavaScriptEnabled(true);${NL}        ${settings.join(NL + '        ')}');`;
    patch += NL + `  changed=true;`;
    patch += NL + `}`;
    patch += NL;
  }

  if (cfg.pullToRefresh) {
    patch += `if(src.indexOf('SwipeRefreshLayout')===-1){`;
    patch += NL;
    patch += `  src=src.replace(/import android\\.webkit\\.WebView;/,'import android.webkit.WebView;${NL}import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;${NL}import android.widget.FrameLayout;');`;
    patch += NL;
    patch += `  src=src.replace(/wv=new WebView\\(this\\);\\s*setContentView\\(wv\\);/,m=>m+NL+'        SwipeRefreshLayout swipe=new SwipeRefreshLayout(this);'+NL+'        swipe.setOnRefreshListener(()->{ try{ wv.reload(); }catch(Exception ignored){} swipe.setRefreshing(false); });'+NL+'        FrameLayout container=new FrameLayout(this);'+NL+'        container.addView(wv,new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,FrameLayout.LayoutParams.MATCH_PARENT));'+NL+'        swipe.addView(container,new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,FrameLayout.LayoutParams.MATCH_PARENT));'+NL+'        setContentView(swipe);');`;
    patch += NL;
    patch += `  changed=true;`;
    patch += NL + `}`;
    patch += NL;
  }

  patch += `if(changed) fs.writeFileSync(mp,src);`;
  patch += NL + `console.log('WebView settings patch applied:'+changed);`;

  return patch;
}

function autoDetectPermissions(htmlCode) {
  const detected = {
    camera: false,
    microphone: false,
    notifications: false
  };

  if (!htmlCode) return detected;

  const patterns = {
    camera: [
      /navigator\.mediaDevices\.getUserMedia\s*\(/,
      /navigator\.getUserMedia\s*\(/,
      /getUserMedia\s*\(/
    ],
    microphone: [
      /navigator\.mediaDevices\.getUserMedia\s*\([^)]*audio\s*:\s*true/,
      /getUserMedia\s*\([^)]*audio\s*:\s*true/
    ],
    notifications: [
      /Notification\.requestPermission\s*\(/,
      /Notification\.permission\s*(===|==)\s*['"]granted['"]/,
      /Notification\.permission\s*(===|==)\s*['"]default['"]/
    ]
  };

  for (const [perm, regexes] of Object.entries(patterns)) {
    for (const regex of regexes) {
      if (regex.test(htmlCode)) {
        detected[perm] = true;
        break;
      }
    }
  }

  return detected;
}

function generateFiles(cfg) {
  const supportedOutputs = getSupportedOutputs(cfg.provider, cfg.platform);
  const invalidOutputs = cfg.outputs.filter(o => !supportedOutputs.includes(o));
  if (invalidOutputs.length) {
    console.warn(`[generateFiles] Provider ${cfg.provider} on ${cfg.platform} does not support outputs: ${invalidOutputs.join(', ')}. Supported: ${supportedOutputs.join(', ')}`);
    cfg.outputs = cfg.outputs.filter(o => supportedOutputs.includes(o));
    if (!cfg.outputs.length) {
      cfg.outputs = supportedOutputs.slice(0, 1);
    }
    cfg.outputType = cfg.outputs.includes('aab')
      ? (cfg.outputs.includes('apk') ? 'both' : 'aab')
      : 'apk';
  }

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

  if (cfg.permissions.nfc || cfg.plugins.nfc) {
    files['res/xml/nfc_tech_filter.xml'] = nfcTechFilterXml();
    files['patch-nfc.js'] = patchNfcSrc();
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

  if (cfg.provider === 'twa') {
    const host = cfg.twaDomain || (cfg.inputType === 'url' ? new URL(cfg.url).hostname : 'example.com');    const shortName = cfg.twaShortName || cfg.appName.slice(0, 30);
    const display = cfg.twaDisplay || 'standalone';
    const orientation = cfg.twaOrientation || cfg.orientation || 'portrait';
    const themeColor = cfg.themeColor || cfg.accentColor || '#4f46e5';
    const backgroundColor = cfg.splashBgColor || '#ffffff';
    const startUrl = cfg.inputType === 'url' ? cfg.url : '/';
    const icons = (cfg.twaIcons && cfg.twaIcons.length) ? cfg.twaIcons : [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }];

    files['twa-manifest.json'] = JSON.stringify({
      packageId: cfg.packageName,
      name: cfg.appName,
      shortName,
      startUrl,
      display,
      orientation,
      themeColor,
      backgroundColor,
      icons,
      host,
      screenOrientation: orientation === 'landscape' ? 'landscape' : 'portrait-primary',
      enableNotifications: !!cfg.permissions.notifications,
      enableLocation: !!cfg.permissions.gps,
      splashScreenFadeOutDuration: 300
    }, null, 2);

    files['generate-twa.js'] = generateTwaScriptSrc();

    const sha256 = '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00';
    files['assetlinks.json'] = JSON.stringify([{
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: cfg.packageName, sha256_cert_fingerprints: [sha256] }
    }], null, 2);
  }

  if (cfg.provider === 'gecko') {
    files['make-icons.js'] = generateIconScriptSrc();
  }

  Object.assign(files, splashScreenFiles(cfg));
  Object.assign(files, themeColorFiles(cfg));
  Object.assign(files, privacyModeFiles(cfg));

  files['android/app/src/main/res/xml/network_security_config.xml'] = networkSecurityConfig(cfg);

  const webviewPatch = webViewSettingsPatch(cfg);
  if (webviewPatch) {
    files['patch-webview-settings.js'] = webviewPatch;
  }

  if (cfg.autoDetectPermissions && cfg.inputType === 'html' && cfg.htmlCode) {
    const detected = autoDetectPermissions(cfg.htmlCode);
    if (detected.camera) cfg.permissions.cameraMic = true;
    if (detected.microphone) cfg.permissions.microphone = true;
    if (detected.notifications) cfg.permissions.notifications = true;
  }

  finalizeWebAssets(files, cfg);
  finalizeFlutterProject(files);

  if (cfg.signingEnabled && cfg.keystoreBase64) {
    const { Buffer } = require('buffer');
    files['android/app/release.jks'] = Buffer.from(cfg.keystoreBase64, 'base64');

    const keyProps = `storePassword=${cfg.keystorePassword}
keyAlias=${cfg.keyAlias}
keyPassword=${cfg.keyPassword}
`;
    files['android/key.properties'] = keyProps;

    const gradlePatch = `
android {
    signingConfigs {
        release {
            storeFile file("release.jks")
            storePassword "${cfg.keystorePassword}"
            keyAlias "${cfg.keyAlias}"
            keyPassword "${cfg.keyPassword}"
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
`;
    files['patch-signing.gradle.js'] = `const fs = require('fs');
const path = 'android/app/build.gradle';
let src = fs.readFileSync(path, 'utf8');
if (!src.includes('signingConfigs')) {
  src = src.replace(/android\\s*\\{/, 'android {' + '${gradlePatch}');
  fs.writeFileSync(path, src);
  console.log('Signing config patched into build.gradle');
} else {
  console.log('Signing config already present');
}
`;
  }

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
  patchNfcSrc,
  runtimeBatchConsts,
  wantsBackground,
  specialNeeds,
  needsSpecialFile,
  PERMISSION_SPEC,
  WORKFLOW_YML,
  DECOMPILE_WORKFLOW_YML,
  VALID_COMPILE_SDKS,
  VALID_TARGET_SDKS,
  VALID_MIN_SDKS,
  decodeBase64Image,
  splashScreenFiles,
  themeColorFiles,
  privacyModeFiles,
  webViewSettingsPatch,
  autoDetectPermissions,
  networkSecurityConfig
};