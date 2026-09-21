'use strict';

const { PERMISSION_SPEC, needsSpecialFile } = require('./permissions');
const { webGrantConsts } = require('./runtime');

function catalogUiJsSrc(cfg){
  const drawerItems = JSON.stringify(cfg.drawerItems||[]);
  const bottomItems = JSON.stringify(cfg.bottomNavItems||[]);
  return '(function(){var CFG='+JSON.stringify({pullRefresh:cfg.pullRefresh, offlineScreen:cfg.offlineScreen, offlineMessage:cfg.offlineMessage, flagSecure:cfg.flagSecure, blockSelection:cfg.blockSelection, drawerEnabled:cfg.drawerEnabled, bottomNavEnabled:cfg.bottomNavEnabled, loadingIndicator:cfg.loadingIndicator, rootDetection:cfg.rootDetection})+';var DRAWER='+drawerItems+';var BOTTOM='+bottomItems+';'
   + 'if(CFG.blockSelection){var s=document.createElement("style");s.textContent="*{ -webkit-user-select:none; user-select:none; -webkit-touch-callout:none;} input,textarea{ -webkit-user-select:text; user-select:text;}";document.head.appendChild(s);document.addEventListener("contextmenu",e=>e.preventDefault());}'
   + 'if(CFG.loadingIndicator!=="none"){window.addEventListener("beforeunload",()=>{var el=document.createElement("div");el.id="ib-loading";el.style.cssText="position:fixed;top:0;left:0;right:0;height:3px;background:var(--accent,#6366f1);z-index:9999;animation:ibLoad 1s infinite";if(CFG.loadingIndicator==="spinner")el.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.5);display:grid;place-items:center;z-index:9999";el.innerHTML=CFG.loadingIndicator==="spinner"?"<div style=\'width:40px;height:40px;border:4px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite\'></div>":"";document.body.appendChild(el);});}'
   + 'if(CFG.pullRefresh&&window.Capacitor){document.addEventListener("DOMContentLoaded",()=>{let startY=0;document.addEventListener("touchstart",e=>startY=e.touches[0].clientY,{passive:true});document.addEventListener("touchend",e=>{let dy=e.changedTouches[0].clientY-startY;if(dy>80&&window.scrollY===0) location.reload();},{passive:true});});}'
   + 'if(CFG.offlineScreen){function check(){var off=!navigator.onLine;var el=document.getElementById("ib-offline");if(off){if(!el){el=document.createElement("div");el.id="ib-offline";el.style.cssText="position:fixed;inset:0;background:#111827;color:#fff;display:grid;place-items:center;z-index:9998;text-align:center;padding:20px";el.innerHTML="<div><div style=\'font-size:48px;margin-bottom:12px\'>📡</div><b>Sin conexión</b><p style=\'color:#9ca3af\'>"+CFG.offlineMessage.replace(/"/g,"&quot;")+"</p><button onclick=\'location.reload()\' style=\'margin-top:12px;padding:8px 16px;background:#6366f1;color:#fff;border:none;border-radius:8px\'>Reintentar</button></div>";document.body.appendChild(el);} } else if(el) el.remove();}window.addEventListener("online",check);window.addEventListener("offline",check);document.addEventListener("DOMContentLoaded",check);}'
   + 'if(CFG.drawerEnabled&&DRAWER.length){var btn=document.createElement("button");btn.textContent="☰";btn.style.cssText="position:fixed;top:12px;left:12px;z-index:9997;background:#111827;color:#fff;border:none;width:36px;height:36px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.3)";var drawer=document.createElement("div");drawer.id="ib-drawer";drawer.style.cssText="position:fixed;top:0;left:-280px;width:260px;height:100%;background:#111827;color:#fff;z-index:9998;transition:left .3s;overflow:auto;padding:16px";drawer.innerHTML="<b style=\'display:block;margin-bottom:12px\'>Menú</b>"+DRAWER.map(i=>"<a href=\'"+i.url+"\' style=\'display:block;padding:10px 8px;color:#fff;text-decoration:none;border-radius:6px;margin-bottom:4px;background:#1f2937\'>"+(i.icon?i.icon+" ":"")+i.label+"</a>").join("")+"<button id=\'ib-drawer-close\' style=\'margin-top:12px;width:100%;padding:8px;background:#374151;color:#fff;border:none;border-radius:6px\'>Cerrar</button>";document.addEventListener("DOMContentLoaded",()=>{document.body.appendChild(btn);document.body.appendChild(drawer);btn.onclick=()=>drawer.style.left="0";drawer.querySelector("#ib-drawer-close").onclick=()=>drawer.style.left="-280px";});}'
   + 'if(CFG.bottomNavEnabled&&BOTTOM.length){var bar=document.createElement("div");bar.id="ib-bottom";bar.style.cssText="position:fixed;bottom:0;left:0;right:0;background:#111827;color:#fff;display:flex;justify-content:space-around;padding:6px 0 8px;z-index:9997;border-top:1px solid #1f2937";bar.innerHTML=BOTTOM.map(i=>"<a href=\'"+i.url+"\' style=\'flex:1;text-align:center;color:#9ca3af;text-decoration:none;font-size:11px\'><div style=\'font-size:18px\'>"+(i.icon||"•")+"</div>"+i.label+"</a>").join("");document.addEventListener("DOMContentLoaded",()=>{document.body.appendChild(bar);document.body.style.paddingBottom="60px";});}'
   + 'if(window.Intee){var origLog=console.log;window.addEventListener("error",e=>{try{Intee.track&&Intee.track("js_error",{message:e.message,source:e.filename});}catch{}});} })();';
}


function patchCatalogSrc(cfg){
  const NL=String.fromCharCode(10);
  return [
    "const fs=require('fs');",
    "const NL=String.fromCharCode(10);",
    "const cfg=JSON.parse(fs.readFileSync('build-config.json','utf8'));",
    "const pkg=cfg.packageName;",
    "const mp='android/app/src/main/java/'+pkg.split('.').join('/')+'/MainActivity.java';",
    "let src=fs.readFileSync(mp,'utf8');",
    "let changed=false;",
    "// FLAG_SECURE",
    "if(cfg.flagSecure && src.indexOf('FLAG_SECURE')===-1){",
    "  src=src.replace(/super\\.onCreate\\([^)]*\\);/,m=>m+NL+'    if(true) getWindow().setFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE, android.view.WindowManager.LayoutParams.FLAG_SECURE);');",
    "  changed=true;",
    "}",
    "// DownloadManager + tel/mailto intents + catalog JS injection",
    "if(src.indexOf('DownloadListener')===-1){",
    "  src=src.replace(/import\\s+com\\.getcapacitor\\.BridgeActivity\\s*;/,'import android.app.DownloadManager; import android.content.Intent; import android.net.Uri; import android.webkit.DownloadListener; import android.webkit.WebView; import android.webkit.WebViewClient; import com.getcapacitor.BridgeActivity;');",
    "  src=src.replace(/super\\.onCreate\\([^)]*\\);/,m=>m+NL+'    try{ getBridge().getWebView().setDownloadListener(new DownloadListener(){ public void onDownloadStart(String url, String ua, String cd, String mime, long len){ try{ Intent i=new Intent(Intent.ACTION_VIEW); i.setData(Uri.parse(url)); startActivity(i);}catch(Exception e){ try{ DownloadManager dm=(DownloadManager)getSystemService(DOWNLOAD_SERVICE); DownloadManager.Request r=new DownloadManager.Request(Uri.parse(url)); r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED); dm.enqueue(r);}catch(Exception ignored){}} } }); }catch(Exception ignored){}'+NL+'    try{ getBridge().getWebView().setWebViewClient(new WebViewClient(){ public boolean shouldOverrideUrlLoading(WebView v, String url){ if(url.startsWith(\"tel:\")||url.startsWith(\"mailto:\")||url.startsWith(\"sms:\")||url.startsWith(\"whatsapp://\")||url.startsWith(\"intent:\")){ try{ startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); return true;}catch(Exception e){ return false;}} return false; } public void onPageFinished(WebView v, String url){ super.onPageFinished(v,url); try{ java.io.InputStream is=getAssets().open(\"public/catalog.js\"); java.io.BufferedReader br=new java.io.BufferedReader(new java.io.InputStreamReader(is)); StringBuilder sb=new StringBuilder(); String line; while((line=br.readLine())!=null) sb.append(line).append(\"\\\\n\"); br.close(); v.evaluateJavascript(sb.toString(),null);}catch(Exception ignored){} } }); }catch(Exception ignored){}');",
    "  changed=true;",
    "}",
    "// Back button behavior",
    "if(cfg.backButtonBehavior && src.indexOf('onBackPressed')===-1){",
    "  const behavior=cfg.backButtonBehavior;",
    "  let code='  @Override public void onBackPressed(){ try{ if(getBridge().getWebView().canGoBack()) getBridge().getWebView().goBack(); else super.onBackPressed(); }catch(Exception e){ super.onBackPressed(); }}';",
    "  if(behavior==='exit') code='  @Override public void onBackPressed(){ finishAffinity(); }';",
    "  if(behavior==='confirm') code='  @Override public void onBackPressed(){ new androidx.appcompat.app.AlertDialog.Builder(this).setTitle(\"Salir?\").setMessage(\"¿Deseas salir de la app?\").setPositiveButton(\"Salir\", (d,w)->finishAffinity()).setNegativeButton(\"Cancelar\", null).show(); }';",
    "  if(behavior==='none') code='  @Override public void onBackPressed(){ }';",
    "  src=src.replace(/public class MainActivity extends BridgeActivity\\s*\\{/,m=>m+NL+code);",
    "  changed=true;",
    "}",
    "// Root detection",
    "if(cfg.rootDetection && src.indexOf('RootCheck')===-1){",
    "  src=src.replace(/super\\.onCreate\\([^)]*\\);/,m=>m+NL+'    try{ boolean rooted=new java.io.File(\"/system/bin/su\").exists()||new java.io.File(\"/system/xbin/su\").exists()||new java.io.File(\"/system/bin/magisk\").exists(); if(rooted) android.util.Log.w(\"InteeBuild\",\"Root detected\"); }catch(Exception ignored){}');",
    "  changed=true;",
    "}",
    "if(changed) fs.writeFileSync(mp,src);",
    "console.log('Catalog patch applied:'+changed);"
  ].join(NL)+NL;
}


function nativeMainActivitySrc(pkg, cfg){
  const url = cfg.inputType==='url' ? cfg.url : 'file:///android_asset/public/index.html';
  const useAudio = cfg.nativeAudio && cfg.streamUrl;
  const needPerms = Object.entries(cfg.permissions || {}).some(([k,v])=>v && PERMISSION_SPEC[k]?.runtime);
  const needSpecial = needsSpecialFile(cfg);
  const vid = webGrantConsts(cfg, 'VIDEO');
  const aud = webGrantConsts(cfg, 'AUDIO');
  const geo = webGrantConsts(cfg, 'GEO');
  const grantBody = [
    vid.length ? 'if(r.contains("VIDEO")&&hasAny(new String[]{' + vid.map(c=>'"'+c.split('.').pop()+'"').join(',') + '})) ok.add(r);' : '',
    aud.length ? 'if(r.contains("AUDIO")&&hasAny(new String[]{' + aud.map(c=>'"'+c.split('.').pop()+'"').join(',') + '})) ok.add(r);' : '',
    geo.length ? 'if(r.contains("GEOLOCATION")&&hasAny(new String[]{' + geo.map(c=>'"'+c.split('.').pop()+'"').join(',') + '})) ok.add(r);' : ''
  ].filter(Boolean).join(' else ');
  const fgHook = cfg.permissions.foreground ? ' try { if (android.os.Build.VERSION.SDK_INT >= 26) startForegroundService(new android.content.Intent(this, RadioService.class)); else startService(new android.content.Intent(this, RadioService.class)); } catch (Exception ignored) {}' : '';
  const bridgeHook = useAudio ? ' try { wv.addJavascriptInterface(new AudioBridge(this), "InteeAudio"); } catch (Exception ignored) {}' : '';
  const permHook = needPerms ? ' try { NativePermissions.requestAll(this); } catch (Exception ignored) {}' : '';
  const specialHook = needSpecial ? ' try { SpecialAccess.ensure(this); } catch (Exception ignored) {}' : '';
  return 'package '+pkg+';\nimport android.content.pm.PackageManager; import android.os.Bundle; import android.webkit.WebView; import android.webkit.WebViewClient; import android.webkit.WebChromeClient; import android.webkit.PermissionRequest; import androidx.appcompat.app.AppCompatActivity;\npublic class MainActivity extends AppCompatActivity {\n  WebView wv;\n'
    + '  private boolean hasAny(String[] perms){ try{ for(String p : perms){ String full="android.permission."+p; if(checkSelfPermission(full)==PackageManager.PERMISSION_GRANTED) return true; } }catch(Exception ignored){} return false; }\n'
    + '  private boolean declared(String p){ try{ String[] d=getPackageManager().getPackageInfo(getPackageName(),PackageManager.GET_PERMISSIONS).requestedPermissions; return d!=null && java.util.Arrays.asList(d).contains("android.permission."+p); }catch(Exception e){ return false; } }\n'
    + '  @Override protected void onCreate(Bundle b){ super.onCreate(b); wv=new WebView(this); setContentView(wv); wv.getSettings().setJavaScriptEnabled(true); wv.getSettings().setDomStorageEnabled(true); wv.getSettings().setAllowFileAccess(true); wv.getSettings().setMixedContentMode(0);'+bridgeHook+' wv.setWebViewClient(new WebViewClient(){ public boolean shouldOverrideUrlLoading(WebView v,String u){ if(u.startsWith("tel:")||u.startsWith("mailto:")||u.startsWith("whatsapp:")){ try{ startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(u))); return true;}catch(Exception e){} } return false; } public void onPageFinished(WebView v,String u){ try{ java.io.InputStream is=getAssets().open("public/catalog.js"); java.io.BufferedReader br=new java.io.BufferedReader(new java.io.InputStreamReader(is)); StringBuilder sb=new StringBuilder(); String l; while((l=br.readLine())!=null) sb.append(l).append("\\n"); br.close(); v.evaluateJavascript(sb.toString(),null);}catch(Exception e){} } }); wv.setWebChromeClient(new WebChromeClient(){ public void onPermissionRequest(final PermissionRequest r){ runOnUiThread(new Runnable(){ public void run(){ try{ String[] res=r.getResources(); java.util.List<String> ok=new java.util.ArrayList<>(); for(String x:res){ ' + (grantBody || ' ') + ' } if(!ok.isEmpty()) r.grant(ok.toArray(new String[0])); else r.deny(); }catch(Exception e){ try{r.deny();}catch(Exception ignored){}} }}); } });'+permHook+specialHook+fgHook+' wv.loadUrl("'+url+'"); }\n'
    + (needPerms ? '  @Override public void onRequestPermissionsResult(int c,String[] p,int[] r){ super.onRequestPermissionsResult(c,p,r); try{ if(c==NativePermissions.REQ_BATCH) NativePermissions.requestBackground(this); }catch(Exception ignored){} }\n' : '')
    + '  @Override public void onBackPressed(){ if(wv.canGoBack()) wv.goBack(); else super.onBackPressed(); }\n}\n';
}


function geckoMainActivitySrc(pkg, cfg){
  const url = cfg.inputType==='url' ? cfg.url : 'file:///android_asset/public/index.html';
  const needPerms = Object.entries(cfg.permissions || {}).some(([k,v])=>v && PERMISSION_SPEC[k]?.runtime);
  const needSpecial = needsSpecialFile(cfg);
  // NOTA: requiere agregar org.mozilla.geckoview manualmente (ver docs/providers.md).
  const hooks = (needPerms ? ' try { NativePermissions.requestAll(this); } catch (Exception ignored) {}' : '')
    + (needSpecial ? ' try { SpecialAccess.ensure(this); } catch (Exception ignored) {}' : '')
    + (cfg.permissions.foreground ? ' try { if (android.os.Build.VERSION.SDK_INT >= 26) startForegroundService(new android.content.Intent(this, RadioService.class)); else startService(new android.content.Intent(this, RadioService.class)); } catch (Exception ignored) {}' : '');
  return 'package '+pkg+';\nimport android.os.Bundle; import org.mozilla.geckoview.GeckoView; import org.mozilla.geckoview.GeckoSession; import org.mozilla.geckoview.GeckoRuntime; import androidx.appcompat.app.AppCompatActivity;\npublic class MainActivity extends AppCompatActivity {\n  GeckoView gv; GeckoSession session;\n  @Override protected void onCreate(Bundle b){ super.onCreate(b); gv=new GeckoView(this); setContentView(gv); GeckoRuntime rt=GeckoRuntime.create(this); session=new GeckoSession(); session.open(rt); gv.setSession(session);'+hooks+' session.loadUri("'+url+'"); }\n  @Override public void onBackPressed(){ if(session!=null) session.goBack(); else super.onBackPressed(); }\n}\n';
}

function cordovaConfigXml(cfg){
  return '<?xml version="1.0" encoding="utf-8"?><widget id="'+cfg.packageName+'" version="'+cfg.versionName+'" xmlns="http://www.w3.org/ns/widgets"><name>'+cfg.appName+'</name><description>'+cfg.description+'</description><author>'+cfg.author+'</author><content src="'+(cfg.inputType==='url'?cfg.url:'index.html')+'" /><access origin="*" /><allow-intent href="tel:*" /><allow-intent href="mailto:*" /></widget>';
}


module.exports = {
  catalogUiJsSrc,
  patchCatalogSrc,
  nativeMainActivitySrc,
  geckoMainActivitySrc,
  cordovaConfigXml
};
