'use strict';

const { PERMISSION_SPEC, BG_LOCATION } = require('./permissions');






function nativePermissionsJavaSrc(pkg, batchConsts, hasBackground) {
  const batch = batchConsts.length
    ? batchConsts.map(c => '            ' + c).join(',\n')
    : '            // sin permisos runtime en esta config';

  return `package ${pkg};

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class NativePermissions {
    private static final String TAG = "NativePermissions";
    public static final int REQ_BATCH = 9001;
    public static final int REQ_BACKGROUND = 9002;
    private static final String BG = "${BG_LOCATION}";

    // Generado desde la config: 1:1 con lo seleccionado en el Studio.
    private static final String[] BATCH = {
${batch}
    };
    private static final boolean WANTS_BG = ${hasBackground ? 'true' : 'false'};

    public static boolean hasPermission(Context context, String permission) {
        if (context == null || permission == null) return false;
        try {
            return context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
        } catch (Exception e) {
            Log.e(TAG, "Error checking permission: " + permission, e);
            return false;
        }
    }

    private static boolean declared(Context ctx, String perm) {
        try {
            String[] req = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), PackageManager.GET_PERMISSIONS).requestedPermissions;
            return req != null && Arrays.asList(req).contains(perm);
        } catch (Exception e) { return false; }
    }

    // Lote principal: todo lo runtime EXCEPTO background (Android 11+ lo exige separado).
    public static void requestAll(Activity activity) {
        requestAll(activity, REQ_BATCH);
    }

    public static void requestAll(Activity activity, int code) {
        if (activity == null || Build.VERSION.SDK_INT < 23) return;
        List<String> missing = new ArrayList<>();
        for (String p : BATCH) {
            if (declared(activity, p) && !hasPermission(activity, p)) missing.add(p);
        }
        if (missing.isEmpty()) { Log.d(TAG, "Batch already granted"); return; }
        try { activity.requestPermissions(missing.toArray(new String[0]), code); }
        catch (Exception e) { Log.e(TAG, "Error requesting batch", e); }
    }

    // Two-step: background SOLO después de conceder foreground (Android 11+ lo ignora en lote).
    public static void requestBackground(Activity activity) {
        requestBackground(activity, REQ_BACKGROUND);
    }

    public static void requestBackground(Activity activity, int code) {
        if (activity == null || !WANTS_BG || Build.VERSION.SDK_INT < 29) return;
        if (!declared(activity, BG) || hasPermission(activity, BG)) return;
        boolean fg = hasPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION)
                || hasPermission(activity, Manifest.permission.ACCESS_COARSE_LOCATION);
        if (!fg) { Log.d(TAG, "Background deferred until foreground granted"); return; }
        try { activity.requestPermissions(new String[]{BG}, code); }
        catch (Exception e) { Log.e(TAG, "Error requesting background", e); }
    }

    public static boolean wantsBackground(Context ctx) {
        return WANTS_BG && declared(ctx, BG) && !hasPermission(ctx, BG);
    }

    public static String[] getManifestPermissions(Context context) {
        try {
            android.content.pm.PackageInfo packageInfo = context.getPackageManager()
                .getPackageInfo(context.getPackageName(), android.content.pm.PackageManager.GET_PERMISSIONS);
            return packageInfo.requestedPermissions;
        } catch (Exception e) {
            Log.e(TAG, "Error getting manifest permissions", e);
            return new String[0];
        }
    }

    public static Set<String> getRuntimePermissions(Context context) {
        Set<String> runtimePermissions = new HashSet<>();
        String[] manifestPermissions = getManifestPermissions(context);
        if (manifestPermissions == null) return runtimePermissions;
        for (String permission : manifestPermissions) {
            int r = context.checkPermission(permission, android.os.Process.myPid(), android.os.Process.myUid());
            if (r == PackageManager.PERMISSION_GRANTED) runtimePermissions.add(permission);
        }
        return runtimePermissions;
    }

    public static boolean isPermissionInManifest(Context context, String permission) {
        String[] manifestPermissions = getManifestPermissions(context);
        return manifestPermissions != null && Arrays.asList(manifestPermissions).contains(permission);
    }
}
`;
}







function specialAccessJavaSrc(pkg, need) {
  const b = (v) => (v ? 'true' : 'false');
  return `package ${pkg};

import android.app.Activity;
import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.util.Log;

public class SpecialAccess {
    private static final String TAG = "SpecialAccess";
    private static final boolean NEED_OVERLAY = ${b(need.overlay)};
    private static final boolean NEED_INSTALL = ${b(need.install)};
    private static final boolean NEED_ALARM = ${b(need.alarm)};
    private static final boolean NEED_MANAGE = ${b(need.manage)};

    // Abre Settings solo para lo declarado y no concedido. Devuelve true si todo OK.
    public static boolean ensure(Activity act) {
        boolean ok = true;
        try {
            if (NEED_OVERLAY && Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(act)) {
                ok = false;
                act.startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + act.getPackageName())));
            }
        } catch (Exception e) { Log.e(TAG, "overlay", e); ok = false; }
        try {
            if (NEED_INSTALL && Build.VERSION.SDK_INT >= 26 && !act.getPackageManager().canRequestPackageInstalls()) {
                ok = false;
                act.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + act.getPackageName())));
            }
        } catch (Exception e) { Log.e(TAG, "install", e); ok = false; }
        try {
            if (NEED_ALARM && Build.VERSION.SDK_INT >= 31) {
                AlarmManager am = (AlarmManager) act.getSystemService(Context.ALARM_SERVICE);
                if (am != null && !am.canScheduleExactAlarms()) {
                    ok = false;
                    act.startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + act.getPackageName())));
                }
            }
        } catch (Exception e) { Log.e(TAG, "alarm", e); ok = false; }
        try {
            if (NEED_MANAGE && Build.VERSION.SDK_INT >= 30 && !Environment.isExternalStorageManager()) {
                ok = false;
                act.startActivity(new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:" + act.getPackageName())));
            }
        } catch (Exception e) { Log.e(TAG, "manage", e); ok = false; }
        return ok;
    }
}
`;
}






function webGrantConsts(cfg, kind) {
  const want = (pred) => {
    const out = [];
    Object.entries(cfg.permissions || {}).forEach(([k, v]) => {
      if (!v) return;
      (PERMISSION_SPEC[k]?.manifest || []).forEach(m => { if (pred(m)) out.push('Manifest.permission.' + m.split('.').pop()); });
    });
    return [...new Set(out)];
  };
  if (kind === 'VIDEO') return want(m => m.endsWith('.CAMERA'));
  if (kind === 'AUDIO') return want(m => m === 'android.permission.RECORD_AUDIO' || m === 'android.permission.MODIFY_AUDIO_SETTINGS');
  if (kind === 'GEO') return want(m => m === 'android.permission.ACCESS_FINE_LOCATION' || m === 'android.permission.ACCESS_COARSE_LOCATION');
  return [];
}






function patchPermissionsSrc(cfg) {
  const NL = String.fromCharCode(10);
  const vid = webGrantConsts(cfg, 'VIDEO').join(' || ');
  const aud = webGrantConsts(cfg, 'AUDIO').join(' || ');
  const geo = webGrantConsts(cfg, 'GEOLOCATION').join(' || ');

  return [
    "const fs=require('fs');",
    "const NL=String.fromCharCode(10);",
    "const pkg=JSON.parse(fs.readFileSync('build-config.json','utf8')).packageName;",
    "const mp='android/app/src/main/java/'+pkg.split('.').join('/')+'/MainActivity.java';",
    "let src=fs.readFileSync(mp,'utf8');",
    "let changed=false;",

    "if(src.indexOf('NativePermissions')===-1){",
    "  src=src.replace(/import\\s+com\\.getcapacitor\\.BridgeActivity\\s*;/,'import android.Manifest; import android.content.pm.PackageManager; import android.webkit.PermissionRequest; import android.webkit.WebChromeClient; import com.getcapacitor.BridgeActivity;');",
    "  src=src.replace(/public class MainActivity extends BridgeActivity\\s*\\{/,m=>m+NL+'"
    + "  private static final int REQ_PERMS=9001;'+NL+'"
    + "  private boolean hasPerm(String p){ try{ return checkSelfPermission(p)==PackageManager.PERMISSION_GRANTED; }catch(Exception e){ return false; }}'+NL+'"
    + "  private boolean declared(String p){ try{ String[] d=getPackageManager().getPackageInfo(getPackageName(),PackageManager.GET_PERMISSIONS).requestedPermissions; return d!=null && java.util.Arrays.asList(d).contains(p); }catch(Exception e){ return false; }}'+NL+'"
    + "  private boolean wantsVideo(){ return " + (vid ? vid.split(' || ').map(c => 'declared(' + c + ')').join(' || ') : 'false') + "; }'+NL+'"
    + "  private boolean hasVideo(){ return " + (vid ? vid.split(' || ').map(c => 'hasPerm(' + c + ')').join(' || ') : 'false') + "; }'+NL+'"
    + "  private boolean wantsAudio(){ return " + (aud ? aud.split(' || ').map(c => 'declared(' + c + ')').join(' || ') : 'false') + "; }'+NL+'"
    + "  private boolean hasAudio(){ return " + (aud ? aud.split(' || ').map(c => 'hasPerm(' + c + ')').join(' || ') : 'false') + "; }'+NL+'"
    + "  private boolean wantsGeo(){ return " + (geo ? geo.split(' || ').map(c => 'declared(' + c + ')').join(' || ') : 'false') + "; }'+NL+'"
    + "  private boolean hasGeo(){ return " + (geo ? geo.split(' || ').map(c => 'hasPerm(' + c + ')').join(' || ') : 'false') + "; }'+NL+'"
    + "  @Override public void onStart(){ super.onStart(); try{ NativePermissions.requestAll(this, REQ_PERMS);}catch(Exception ignored){}}'+NL+'"
    + "  @Override public void onRequestPermissionsResult(int c,String[] p,int[] r){ super.onRequestPermissionsResult(c,p,r); try{ if(c==NativePermissions.REQ_BATCH) NativePermissions.requestBackground(this); }catch(Exception ignored){} }');",


    "  fs.writeFileSync(mp,src); changed=true;",
    "}",
    "console.log('Permissions patch applied:'+changed+' hasNative:'+(src.indexOf('NativePermissions')!==-1));"
  ].join(NL) + NL;
}

function patchSpecialSrc() {
  const NL = String.fromCharCode(10);
  return [
    "const fs=require('fs');",
    "const NL=String.fromCharCode(10);",
    "const pkg=JSON.parse(fs.readFileSync('build-config.json','utf8')).packageName;",
    "const mp='android/app/src/main/java/'+pkg.split('.').join('/')+'/MainActivity.java';",
    "let src=fs.readFileSync(mp,'utf8');",
    "let changed=false;",


    "if(src.indexOf('SpecialAccess.ensure')===-1){",
    "  if(/void\\s+onStart\\s*\\(\\s*\\)/.test(src)){ src=src.replace(/void\\s+onStart\\s*\\(\\s*\\)\\s*\\{/,m=>m+NL+'    try{ SpecialAccess.ensure(this); }catch(Exception ignored){}'); }",
    "  else { src=src.replace(/public class MainActivity extends BridgeActivity\\s*\\{/,m=>m+NL+'  @Override public void onStart(){ super.onStart(); try{ SpecialAccess.ensure(this); }catch(Exception ignored){} }'); }",
    "  fs.writeFileSync(mp,src); changed=true;",
    "}",
    "console.log('SpecialAccess patch applied:'+changed);"
  ].join(NL) + NL;
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

function privacyWebViewClientJavaSrc(cfg) {
  if (!cfg.privacyMode) return '';

  const pkgPath = cfg.packageName.replace(/\./g, '/');
  const blockCookies = cfg.privacyBlockCookies !== false;
  const blockGeolocation = cfg.privacyBlockGeolocation !== false;
  const blockRedirects = cfg.privacyBlockRedirects !== false;

  return `package ${cfg.packageName};

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
        if (blockRedirects && (url.startsWith("intent://") || url.startsWith("market://") || url.startsWith("whatsapp://") || url.startsWith("tg://"))) {
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

        js.append("Object.defineProperty(navigator,'plugins',{value:[],writable:false});");
        js.append("Object.defineProperty(navigator,'mimeTypes',{value:[],writable:false});");
        js.append("Object.defineProperty(navigator,'hardwareConcurrency',{value:4});");
        js.append("Object.defineProperty(navigator,'deviceMemory',{value:4});");
        js.append("if(window.screen){");
        js.append("Object.defineProperty(screen,'colorDepth',{value:24});");
        js.append("Object.defineProperty(screen,'pixelDepth',{value:24});");
        js.append("Object.defineProperty(screen,'width',{value:1920});");
        js.append("Object.defineProperty(screen,'height',{value:1080});");
        js.append("}");

        js.append("if(typeof HTMLCanvasElement!=='undefined'){");
        js.append("const originalToDataURL=HTMLCanvasElement.prototype.toDataURL;");
        js.append("HTMLCanvasElement.prototype.toDataURL=function(){return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';};");
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
}

function cookieManagerPatch(cfg) {
  if (!cfg.provider || (cfg.provider !== 'native' && cfg.provider !== 'capacitor' && cfg.provider !== 'droncito')) return '';
  if (!cfg.privacyBlockCookies && !cfg.disableCopy) return '';

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

  patch += `if(src.indexOf('CookieManager')===-1 && src.indexOf('WebView')!==-1){`;
  patch += NL;
  patch += `  src=src.replace(/import android\\.webkit\\.WebView;/,'import android.webkit.WebView;${NL}import android.webkit.CookieManager;');`;
  patch += NL;
  patch += `  src=src.replace(/wv=new WebView\\(this\\);/,m=>m+NL+'        CookieManager.getInstance().setAcceptCookie(false);'+NL+'        CookieManager.getInstance().setAcceptThirdPartyCookies(wv, false);');`;
  patch += NL;
  patch += `  changed=true;`;
  patch += NL + `}`;
  patch += NL;

  patch += `if(changed) fs.writeFileSync(mp,src);`;
  patch += NL + `console.log('CookieManager patch applied:'+changed);`;

  return patch;
}

function patchMainActivityLauncher(cfg) {
  if (!cfg.splashEnabled) return '';

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

  patch += `if(src.indexOf('LAUNCHER')!==-1){`;
  patch += NL;
  patch += `  src=src.replace(/<intent-filter>\\s*<action android:name="android.intent.action.MAIN"\\/>\\s*<category android:name="android.intent.category.LAUNCHER"\\/>\\s*<\\/intent-filter>/, '');`;
  patch += NL;
  patch += `  src=src.replace(/android:name="android.intent.category.LAUNCHER"/g, '');`;
  patch += NL;
  patch += `  changed=true;`;
  patch += NL + `}`;
  patch += NL;

  patch += `if(changed) fs.writeFileSync(mp,src);`;
  patch += NL + `console.log('MainActivity LAUNCHER patch applied:'+changed);`;

  return patch;
}

module.exports = {
  nativePermissionsJavaSrc,
  specialAccessJavaSrc,
  webGrantConsts,
  patchPermissionsSrc,
  patchSpecialSrc,
  webViewSettingsPatch,
  privacyWebViewClientJavaSrc,
  cookieManagerPatch,
  patchMainActivityLauncher
};
