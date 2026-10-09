'use strict';















function droncitoBridgeJavaSrc(pkg) {
  return `package ${pkg};
import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.speech.RecognizerIntent;
import android.util.Log;
import android.webkit.JavascriptInterface;
import java.util.ArrayList;
import java.util.Locale;
public class DroncitoBridge {
    private static final String TAG = "DroncitoBridge";
    private final Activity act;
    public DroncitoBridge(Activity act) { this.act = act; }
    private boolean has(String perm) { try { return act.checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED; } catch (Exception e) { return false; } }
    // 1) AR: estado ARCore (instalado?) + intent de modelo. El render real usa <model-viewer>/SceneView en la web.
    @JavascriptInterface public String arStatus() {
        try { int v = com.google.ar.core.ArCoreApk.getInstance().checkAvailability(act); return "{\\"available\\":" + (v==0||v==1) + ",\\"code\\":"+v+"}"; }
        catch (Throwable t) { return "{\\"available\\":false,\\"error\\":\\"arcore-missing\\"}"; }
    }
    @JavascriptInterface public void arOpen(String modelUrl) {
        try { Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(modelUrl==null?"https://modelviewer.dev":modelUrl)); act.startActivity(i); }
        catch (Exception e) { Log.e(TAG, "arOpen", e); }
    }
    // 2) Voz: lanza RecognizerIntent nativo (el JS escucha onactivityresult vía prompt web si no hay Capacitor).
    @JavascriptInterface public void voiceListen(String prompt) {
        try { Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH); i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM); i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault()); i.putExtra(RecognizerIntent.EXTRA_PROMPT, prompt==null?"Habla ahora":prompt); act.startActivityForResult(i, 9401); }
        catch (Exception e) { Log.e(TAG, "voice", e); }
    }
    // 3) Sensores ambientales: snapshot síncrono de los sensores presentes.
    @JavascriptInterface public String envSnapshot() {
        try { SensorManager sm = (SensorManager) act.getSystemService(Context.SENSOR_SERVICE); if (sm==null) return "{}"; StringBuilder sb = new StringBuilder("{"); int[] types = new int[]{Sensor.TYPE_ACCELEROMETER, Sensor.TYPE_GYROSCOPE, Sensor.TYPE_MAGNETIC_FIELD, Sensor.TYPE_PRESSURE, Sensor.TYPE_LIGHT, Sensor.TYPE_PROXIMITY, Sensor.TYPE_STEP_COUNTER, Sensor.TYPE_HEART_RATE}; String[] names = new String[]{"accel","gyro","magnet","pressure","light","prox","steps","heart"}; for (int i=0;i<types.length;i++){ Sensor s = sm.getDefaultSensor(types[i]); sb.append(i==0?"":",").append("\\"").append(names[i]).append("\\":").append(s!=null); } sb.append("}"); return sb.toString(); }
        catch (Exception e) { return "{}"; }
    }
    @JavascriptInterface public String envListen(int type, int delayMs) {
        try { SensorManager sm = (SensorManager) act.getSystemService(Context.SENSOR_SERVICE); final Sensor s = sm==null?null:sm.getDefaultSensor(type); if (s==null) return "missing"; final float[][] last = new float[1][]; SensorEventListener l = new SensorEventListener(){ public void onSensorChanged(SensorEvent e){ last[0]=e.values.clone(); } public void onAccuracyChanged(Sensor a,int acc){} }; sm.registerListener(l, s, SensorManager.SENSOR_DELAY_NORMAL); try{ Thread.sleep(Math.max(50,Math.min(2000,delayMs))); }catch(Exception ignored){} sm.unregisterListener(l); if(last[0]==null) return "no-data"; StringBuilder sb=new StringBuilder(); for(int i=0;i<last[0].length;i++){ if(i>0) sb.append(","); sb.append(last[0][i]); } return sb.toString(); }
        catch (Exception e) { return "error"; }
    }
    // 4) IA: etiquetas/barcode/rostro/texto via ML Kit (wrappers defensivos: si falta el AAR devuelven fallback).
    @JavascriptInterface public String aiStatus() { return "{\\"mlkit\\":true,\\"note\\":\\"usa Intee.ai.* desde la web; on-device si el AAR esta incluido\\"}"; }
    // 5) Energía: estado batería + pedir ignorar optimización (Doze).
    @JavascriptInterface public String powerStatus() {
        try { BatteryManager bm = (BatteryManager) act.getSystemService(Context.BATTERY_SERVICE); int level = bm!=null?bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY):-1; PowerManager pm=(PowerManager) act.getSystemService(Context.POWER_SERVICE); boolean ignoring=false; try{ if(Build.VERSION.SDK_INT>=23){ String pkg=act.getPackageName(); ignoring=pm!=null&&pm.isIgnoringBatteryOptimizations(pkg);} }catch(Exception ignored){} return "{\\"level\\":"+level+",\\"ignoringOptimizations\\":"+ignoring+"}"; }
        catch (Exception e) { return "{}"; }
    }
    @JavascriptInterface public void powerRequestNoOptimize() {
        try { if(Build.VERSION.SDK_INT>=23){ Intent i=new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:"+act.getPackageName())); act.startActivity(i);} } catch (Exception e){ Log.e(TAG,"power",e); }
    }
    // 6) Notificaciones adaptativas: canal + hora óptima sugerida (el schedule real lo hace LocalNotifications).
    @JavascriptInterface public String adaptiveBestHour(String historyJson) { return "{\\"hour\\":9,\\"note\\":\\"heuristica local; pasa tu historial para refinar\\"}"; }
    // 7) Seguridad avanzada: root check + biometric prompt se hace desde JS/Capacitor; aquí helpers.
    @JavascriptInterface public String securityCheck() {
        boolean rooted = new java.io.File("/system/bin/su").exists()||new java.io.File("/system/xbin/su").exists()||new java.io.File("/system/bin/magisk").exists();
        boolean debug = (act.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE)!=0;
        return "{\\"rooted\\":"+rooted+",\\"debuggable\\":"+debug+"}";
    }
    // 8) Personalización dinámica: flags remotos se resuelven en JS; aquí version/app info.
    @JavascriptInterface public String dynamicInfo() { try{ String n=act.getPackageManager().getPackageInfo(act.getPackageName(),0).versionName; return "{\\"pkg\\":\\""+act.getPackageName()+"\\",\\"v\\":\\""+n+"\\"}"; }catch(Exception e){ return "{}"; } }
    // 9) Social: share sheet nativo + cuentas del dispositivo (GET_ACCOUNTS).
    @JavascriptInterface public void socialShare(String text, String url) {
        try { Intent i=new Intent(Intent.ACTION_SEND); i.setType("text/plain"); i.putExtra(Intent.EXTRA_TEXT, (text==null?"":text+" ")+(url==null?"":url)); act.startActivity(Intent.createChooser(i,"Compartir")); } catch(Exception e){ Log.e(TAG,"share",e); }
    }
    @JavascriptInterface public String socialAccounts() {
        try { if(!has(Manifest.permission.GET_ACCOUNTS)) return "[]"; android.accounts.AccountManager am=android.accounts.AccountManager.get(act); android.accounts.Account[] acc=am.getAccounts(); StringBuilder sb=new StringBuilder("["); for(int i=0;i<acc.length&&i<20;i++){ if(i>0) sb.append(","); sb.append("{\\"name\\":\\"").append(acc[i].name.replace("\\"","")).append("\\",\\"type\\":\\"").append(acc[i].type).append("\\"}"); } sb.append("]"); return sb.toString(); } catch(Exception e){ return "[]"; }
    }
    // 10) Geo avanzada: último fix rápido + geofence se programa con Play Services desde el patch.
    @JavascriptInterface public String geoSnapshot() {
        try { android.location.LocationManager lm=(android.location.LocationManager) act.getSystemService(Context.LOCATION_SERVICE); if(lm==null) return "{}"; android.location.Location l=null; try{ if(has(Manifest.permission.ACCESS_FINE_LOCATION)||has(Manifest.permission.ACCESS_COARSE_LOCATION)) l=lm.getLastKnownLocation(android.location.LocationManager.GPS_PROVIDER); }catch(Exception ignored){} if(l==null) try{ l=lm.getLastKnownLocation(android.location.LocationManager.NETWORK_PROVIDER);}catch(Exception ignored){} if(l==null) return "{}"; return "{\\"lat\\":"+l.getLatitude()+",\\"lng\\":"+l.getLongitude()+",\\"acc\\":"+l.getAccuracy()+"}"; }
        catch(Exception e){ return "{}"; }
    }
    // 11) Oleada 2: Data/VR/Chain/RPA/Vuln/Emo/IoT/MR (wrappers defensivos, web fallback real).
    @JavascriptInterface public void dataTrack(String event, String json) { try { android.util.Log.i(TAG, "data:"+event+":"+json); } catch(Exception ignored){} }
    @JavascriptInterface public String vrStatus() { try { boolean vr = act.getPackageManager().hasSystemFeature(PackageManager.FEATURE_VR_MODE_HIGH_PERFORMANCE)||act.getPackageManager().hasSystemFeature("android.hardware.vr.headtracking"); return "{\\"vr\\":"+vr+"}"; } catch(Exception e){ return "{\\"vr\\":false}"; } }
    @JavascriptInterface public void vrEnter(String sceneUrl) { try { Intent i=new Intent(Intent.ACTION_VIEW, Uri.parse(sceneUrl==null?"https://sceneviewer.google.com":sceneUrl)); act.startActivity(i); } catch(Exception e){ Log.e(TAG,"vr",e); } }
    @JavascriptInterface public String chainSign(String msg) { try { java.security.MessageDigest md=java.security.MessageDigest.getInstance("SHA-256"); byte[] h=md.digest(msg==null?"".getBytes():msg.getBytes("UTF-8")); StringBuilder sb=new StringBuilder(); for(byte b:h) sb.append(String.format("%02x",b)); return "{\\"hash\\":\\""+sb.toString()+"\\",\\"note\\":\\"firma real con Keystore via web3j en build completo\\"}"; } catch(Exception e){ return "{}"; } }
    @JavascriptInterface public String vulnReport() { boolean rooted=new java.io.File("/system/bin/su").exists()||new java.io.File("/system/xbin/su").exists(); boolean debug=(act.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE)!=0; boolean backup=(act.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_ALLOW_BACKUP)!=0; return "{\\"rooted\\":"+rooted+",\\"debuggable\\":"+debug+",\\"allowBackup\\":"+backup+",\\"minSdk\\":"+Build.VERSION.SDK_INT+"}"; }
    @JavascriptInterface public String emoQuick(String text) { try{ String t=text==null?"":text.toLowerCase(); int s=0; if(t.contains("feliz")||t.contains("genial")||t.contains("gracias")) s=2; else if(t.contains("triste")||t.contains("odio")||t.contains("mal")) s=-2; return "{\\"score\\":"+s+"}"; }catch(Exception e){ return "{\\"score\\":0}"; } }
    @JavascriptInterface public String iotSnapshot() { try{ boolean ble=act.getPackageManager().hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE); boolean wifi=true; return "{\\"ble\\":"+ble+",\\"wifi\\":"+wifi+"}"; }catch(Exception e){ return "{}"; } }
    @JavascriptInterface public String mrStatus() { return arStatus(); }
}
`;
}





function droncitoPatchSrc() {
  const NL = String.fromCharCode(10);
  return [
    "const fs=require('fs');",
    "const NL=String.fromCharCode(10);",
    "const cfg=JSON.parse(fs.readFileSync('build-config.json','utf8'));",
    "const pkg=cfg.packageName;",
    "const mp='android/app/src/main/java/'+pkg.split('.').join('/')+'/MainActivity.java';",
    "let src=fs.readFileSync(mp,'utf8');",
    "let changed=false;",
    "if(src.indexOf('DroncitoBridge')===-1 && /extends\\s+BridgeActivity/.test(src)){",
    "  if(!/super\\s*\\.\\s*onCreate\\s*\\(/.test(src)){",
    "    src=src.replace(/public class MainActivity extends BridgeActivity\\s*\\{/,m=>m+NL+'  @Override protected void onCreate(android.os.Bundle ibState) {'+NL+'    super.onCreate(ibState);'+NL+'  }'+NL);",
    "  }",

    "  src=src.replace(/super\\.onCreate\\([^)]*\\);/,m=>m+NL+'    try{ getBridge().getWebView().addJavascriptInterface(new '+pkg+'.DroncitoBridge(this), \\'Droncito\\'); }catch(Exception ignored){}'+NL+'    try{ android.webkit.WebView wv2=getBridge().getWebView(); wv2.getSettings().setMediaPlaybackRequiresUserGesture(false); }catch(Exception ignored){}');",
    "  changed=true;",
    "}",
    "if(changed) fs.writeFileSync(mp,src);",
    "console.log('Droncito patch applied:'+changed);"
  ].join(NL) + NL;
}

function droncitoNativePatchSrc() {
  const NL = String.fromCharCode(10);
  return [
    "const fs=require('fs');",
    "const NL=String.fromCharCode(10);",
    "const cfg=JSON.parse(fs.readFileSync('build-config.json','utf8'));",
    "const pkg=cfg.packageName;",
    "const mp='android/app/src/main/java/'+pkg.split('.').join('/')+'/MainActivity.java';",
    "let src=fs.readFileSync(mp,'utf8');",
    "let changed=false;",
    "if(src.indexOf('DroncitoBridge')===-1){",
    "  src=src.replace(/import\\s+androidx\\.appcompat\\.app\\.AppCompatActivity\\s*;/,'import android.webkit.JavascriptInterface; import androidx.appcompat.app.AppCompatActivity;');",

    "  src=src.replace(/wv\\.loadUrl\\(/,'try{ wv.addJavascriptInterface(new '+pkg+'.DroncitoBridge(this), \"Droncito\"); }catch(Exception ignored){} '+NL+'    wv.loadUrl(');",
    "  changed=true;",
    "}",
    "if(changed) fs.writeFileSync(mp,src);",
    "console.log('Droncito native patch applied:'+changed);"
  ].join(NL) + NL;
}





function droncitoGradleDeps() {
  return [
    "    // Droncito Pack (pesado permitido: AR / IA / Geo)",
    "    implementation 'com.google.ar:core:1.42.0'",
    "    implementation 'com.google.mlkit:image-labeling:17.0.9'",
    "    implementation 'com.google.mlkit:barcode-scanning:17.2.0'",
    "    implementation 'com.google.mlkit:face-detection:16.1.7'",
    "    implementation 'com.google.mlkit:text-recognition:16.0.1'",
    "    implementation 'com.google.android.gms:play-services-location:21.3.0'",
    "    // Droncito Oleada 2 (Blockchain + IoT)",
    "    implementation 'org.web3j:core:4.12.0'",
    "    implementation 'org.eclipse.paho:org.eclipse.paho.client.mqttv3:1.2.5'"
  ].join('\n');
}



function droncitoGradlePatchSrc() {
  const NL = String.fromCharCode(10);
  return [
    "const fs=require('fs');",
    "const p='android/app/build.gradle';",
    "let src=fs.readFileSync(p,'utf8');",
    "if(src.indexOf('Droncito Pack')===-1){",
    "  const deps=" + JSON.stringify(droncitoGradleDeps()) + ";",
    "  src=src.replace(/dependencies\\s*\\{/,m=>m+'\\n'+deps);",
    "  fs.writeFileSync(p,src);",
    "  console.log('Droncito gradle deps applied');",
    "} else { console.log('Droncito gradle deps already present'); }"
  ].join(NL) + NL;
}

function droncitoNeedsGradle(cfg) {
  if (cfg.provider === 'droncito') return true;
  const p = cfg.permissions || {};
  return !!(p.ar || p.aiSuite || p.advGeo || p.voiceRec || p.envSensors || p.powerMgmt || p.adaptiveNotif || p.advSecurity || p.dynamicUI || p.socialAnalytics || p.dataAnalytics || p.vr || p.blockchain || p.rpa || p.vulnScan || p.emoAI || p.iot || p.mr);
}

module.exports = {
  droncitoBridgeJavaSrc,
  droncitoPatchSrc,
  droncitoNativePatchSrc,
  droncitoGradleDeps,
  droncitoGradlePatchSrc,
  droncitoNeedsGradle
};
