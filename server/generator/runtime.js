'use strict';

const { PERMISSION_SPEC, BG_LOCATION } = require('./permissions');

function nativePermissionsJavaSrc(pkg, batchConsts, hasBackground) {
  const batch = batchConsts.length
    ? batchConsts.map(c => '            ' + c).join(',\n')
    : '            // sin permisos runtime en esta config';
  return 'package ' + pkg + ';\n'
    + '\n'
    + 'import android.Manifest;\n'
    + 'import android.app.Activity;\n'
    + 'import android.content.Context;\n'
    + 'import android.content.pm.PackageManager;\n'
    + 'import android.os.Build;\n'
    + 'import android.util.Log;\n'
    + 'import java.util.ArrayList;\n'
    + 'import java.util.Arrays;\n'
    + 'import java.util.HashSet;\n'
    + 'import java.util.List;\n'
    + 'import java.util.Set;\n'
    + '\n'
    + 'public class NativePermissions {\n'
    + '    private static final String TAG = "NativePermissions";\n'
    + '    public static final int REQ_BATCH = 9001;\n'
    + '    public static final int REQ_BACKGROUND = 9002;\n'
    + '    private static final String BG = "' + BG_LOCATION + '";\n'
    + '\n'
    + '    // Generado desde la config: 1:1 con lo seleccionado en el Studio.\n'
    + '    private static final String[] BATCH = {\n'
    + batch + '\n'
    + '    };\n'
    + '    private static final boolean WANTS_BG = ' + (hasBackground ? 'true' : 'false') + ';\n'
    + '\n'
    + '    public static boolean hasPermission(Context context, String permission) {\n'
    + '        if (context == null || permission == null) return false;\n'
    + '        try {\n'
    + '            return context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;\n'
    + '        } catch (Exception e) {\n'
    + '            Log.e(TAG, "Error checking permission: " + permission, e);\n'
    + '            return false;\n'
    + '        }\n'
    + '    }\n'
    + '\n'
    + '    private static boolean declared(Context ctx, String perm) {\n'
    + '        try {\n'
    + '            String[] req = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), PackageManager.GET_PERMISSIONS).requestedPermissions;\n'
    + '            return req != null && Arrays.asList(req).contains(perm);\n'
    + '        } catch (Exception e) { return false; }\n'
    + '    }\n'
    + '\n'
    + '    // Lote principal: todo lo runtime EXCEPTO background (Android 11+ lo exige separado).\n'
    + '    public static void requestAll(Activity activity) {\n'
    + '        requestAll(activity, REQ_BATCH);\n'
    + '    }\n'
    + '\n'
    + '    public static void requestAll(Activity activity, int code) {\n'
    + '        if (activity == null || Build.VERSION.SDK_INT < 23) return;\n'
    + '        List<String> missing = new ArrayList<>();\n'
    + '        for (String p : BATCH) {\n'
    + '            if (declared(activity, p) && !hasPermission(activity, p)) missing.add(p);\n'
    + '        }\n'
    + '        if (missing.isEmpty()) { Log.d(TAG, "Batch already granted"); return; }\n'
    + '        try { activity.requestPermissions(missing.toArray(new String[0]), code); }\n'
    + '        catch (Exception e) { Log.e(TAG, "Error requesting batch", e); }\n'
    + '    }\n'
    + '\n'
    + '    // Two-step: background SOLO después de conceder foreground (Android 11+ lo ignora en lote).\n'
    + '    public static void requestBackground(Activity activity) {\n'
    + '        requestBackground(activity, REQ_BACKGROUND);\n'
    + '    }\n'
    + '\n'
    + '    public static void requestBackground(Activity activity, int code) {\n'
    + '        if (activity == null || !WANTS_BG || Build.VERSION.SDK_INT < 29) return;\n'
    + '        if (!declared(activity, BG) || hasPermission(activity, BG)) return;\n'
    + '        boolean fg = hasPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION)\n'
    + '                || hasPermission(activity, Manifest.permission.ACCESS_COARSE_LOCATION);\n'
    + '        if (!fg) { Log.d(TAG, "Background deferred until foreground granted"); return; }\n'
    + '        try { activity.requestPermissions(new String[]{BG}, code); }\n'
    + '        catch (Exception e) { Log.e(TAG, "Error requesting background", e); }\n'
    + '    }\n'
    + '\n'
    + '    public static boolean wantsBackground(Context ctx) {\n'
    + '        return WANTS_BG && declared(ctx, BG) && !hasPermission(ctx, BG);\n'
    + '    }\n'
    + '\n'
    + '    public static String[] getManifestPermissions(Context context) {\n'
    + '        try {\n'
    + '            android.content.pm.PackageInfo packageInfo = context.getPackageManager()\n'
    + '                .getPackageInfo(context.getPackageName(), android.content.pm.PackageManager.GET_PERMISSIONS);\n'
    + '            return packageInfo.requestedPermissions;\n'
    + '        } catch (Exception e) {\n'
    + '            Log.e(TAG, "Error getting manifest permissions", e);\n'
    + '            return new String[0];\n'
    + '        }\n'
    + '    }\n'
    + '\n'
    + '    public static Set<String> getRuntimePermissions(Context context) {\n'
    + '        Set<String> runtimePermissions = new HashSet<>();\n'
    + '        String[] manifestPermissions = getManifestPermissions(context);\n'
    + '        if (manifestPermissions == null) return runtimePermissions;\n'
    + '        for (String permission : manifestPermissions) {\n'
    + '            int r = context.checkPermission(permission, android.os.Process.myPid(), android.os.Process.myUid());\n'
    + '            if (r == PackageManager.PERMISSION_GRANTED) runtimePermissions.add(permission);\n'
    + '        }\n'
    + '        return runtimePermissions;\n'
    + '    }\n'
    + '\n'
    + '    public static boolean isPermissionInManifest(Context context, String permission) {\n'
    + '        String[] manifestPermissions = getManifestPermissions(context);\n'
    + '        return manifestPermissions != null && Arrays.asList(manifestPermissions).contains(permission);\n'
    + '    }\n'
    + '}\n';
}

// Accesos especiales: no son diálogos runtime, van a Settings. Generado
// solo con los flags que la config pide (bakeado, nada genérico).

function specialAccessJavaSrc(pkg, need) {
  const b = (v) => (v ? 'true' : 'false');
  return 'package ' + pkg + ';\n'
    + '\n'
    + 'import android.app.Activity;\n'
    + 'import android.app.AlarmManager;\n'
    + 'import android.content.Context;\n'
    + 'import android.content.Intent;\n'
    + 'import android.net.Uri;\n'
    + 'import android.os.Build;\n'
    + 'import android.os.Environment;\n'
    + 'import android.provider.Settings;\n'
    + 'import android.util.Log;\n'
    + '\n'
    + 'public class SpecialAccess {\n'
    + '    private static final String TAG = "SpecialAccess";\n'
    + '    private static final boolean NEED_OVERLAY = ' + b(need.overlay) + ';\n'
    + '    private static final boolean NEED_INSTALL = ' + b(need.install) + ';\n'
    + '    private static final boolean NEED_ALARM = ' + b(need.alarm) + ';\n'
    + '    private static final boolean NEED_MANAGE = ' + b(need.manage) + ';\n'
    + '\n'
    + '    // Abre Settings solo para lo declarado y no concedido. Devuelve true si todo OK.\n'
    + '    public static boolean ensure(Activity act) {\n'
    + '        boolean ok = true;\n'
    + '        try {\n'
    + '            if (NEED_OVERLAY && Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(act)) {\n'
    + '                ok = false;\n'
    + '                act.startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + act.getPackageName())));\n'
    + '            }\n'
    + '        } catch (Exception e) { Log.e(TAG, "overlay", e); ok = false; }\n'
    + '        try {\n'
    + '            if (NEED_INSTALL && Build.VERSION.SDK_INT >= 26 && !act.getPackageManager().canRequestPackageInstalls()) {\n'
    + '                ok = false;\n'
    + '                act.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + act.getPackageName())));\n'
    + '            }\n'
    + '        } catch (Exception e) { Log.e(TAG, "install", e); ok = false; }\n'
    + '        try {\n'
    + '            if (NEED_ALARM && Build.VERSION.SDK_INT >= 31) {\n'
    + '                AlarmManager am = (AlarmManager) act.getSystemService(Context.ALARM_SERVICE);\n'
    + '                if (am != null && !am.canScheduleExactAlarms()) {\n'
    + '                    ok = false;\n'
    + '                    act.startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + act.getPackageName())));\n'
    + '                }\n'
    + '            }\n'
    + '        } catch (Exception e) { Log.e(TAG, "alarm", e); ok = false; }\n'
    + '        try {\n'
    + '            if (NEED_MANAGE && Build.VERSION.SDK_INT >= 30 && !Environment.isExternalStorageManager()) {\n'
    + '                ok = false;\n'
    + '                act.startActivity(new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:" + act.getPackageName())));\n'
    + '            }\n'
    + '        } catch (Exception e) { Log.e(TAG, "manage", e); ok = false; }\n'
    + '        return ok;\n'
    + '    }\n'
    + '}\n';
}


function webGrantConsts(cfg, kind) {
  // Constantes Manifest reales seleccionadas por tipo de recurso web.
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
  const geo = webGrantConsts(cfg, 'GEO').join(' || ');
  const grantChecks = [
    vid ? 'if(r.contains("VIDEO")&&wantsVideo()&&hasVideo()) ok.add(r);' : '',
    aud ? 'if(r.contains("AUDIO")&&wantsAudio()&&hasAudio()) ok.add(r);' : '',
    geo ? 'if(r.contains("GEOLOCATION")&&wantsGeo()&&hasGeo()) ok.add(r);' : ''
  ].filter(Boolean).join(' else ');
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
    "  if(src.indexOf('onPermissionRequest')===-1){",
    "    src=src.replace(/super\\.onCreate\\([^)]*\\);/,s=>s+NL+'    try{ getBridge().getWebView().setWebChromeClient(new WebChromeClient(){ @Override public void onPermissionRequest(final PermissionRequest request){ runOnUiThread(new Runnable(){ public void run(){ try{ String[] res=request.getResources(); java.util.List<String> ok=new java.util.ArrayList<>(); for(String r:res){ " + grantChecks + " } if(!ok.isEmpty()) request.grant(ok.toArray(new String[0])); else request.deny(); }catch(Exception e){ try{request.deny();}catch(Exception ignored){}} }}); } }); }catch(Exception ignored){}');",
    "  }",
    "  fs.writeFileSync(mp,src); changed=true;",
    "}",
    "console.log('Permissions patch applied:'+changed+' hasNative:'+(src.indexOf('NativePermissions')!==-1));"
  ].join(NL)+NL;
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
  ].join(NL)+NL;
}


module.exports = {
  nativePermissionsJavaSrc,
  specialAccessJavaSrc,
  webGrantConsts,
  patchPermissionsSrc,
  patchSpecialSrc
};
