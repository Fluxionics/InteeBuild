'use strict';

const { PERMISSION_SPEC, needsSpecialFile } = require('./permissions');
const { webGrantConsts } = require('./runtime');







function catalogUiJsSrc(cfg) {
  const cfgJson = JSON.stringify({
    pullRefresh: cfg.pullRefresh,
    offlineScreen: cfg.offlineScreen,
    offlineMessage: cfg.offlineMessage,
    flagSecure: cfg.flagSecure,
    blockSelection: cfg.blockSelection,
    drawerEnabled: cfg.drawerEnabled,
    bottomNavEnabled: cfg.bottomNavEnabled,
    loadingIndicator: cfg.loadingIndicator,
    rootDetection: cfg.rootDetection
  });
  const drawerItems = JSON.stringify(cfg.drawerItems || []);
  const bottomItems = JSON.stringify(cfg.bottomNavItems || []);

  return [
    '(function(){if(window.__ibCat)return;window.__ibCat=1;var CFG=' + cfgJson + ';var DRAWER=' + drawerItems + ';var BOTTOM=' + bottomItems + ';',


    'if(CFG.blockSelection){var s=document.createElement("style");s.textContent="*{ -webkit-user-select:none; user-select:none; -webkit-touch-callout:none;} input,textarea{ -webkit-user-select:text; user-select:text;}";document.head.appendChild(s);document.addEventListener("contextmenu",e=>e.preventDefault());}',


    'if(CFG.loadingIndicator!=="none"){window.addEventListener("beforeunload",()=>{var el=document.createElement("div");el.id="ib-loading";el.style.cssText="position:fixed;top:0;left:0;right:0;height:3px;background:var(--accent,#6366f1);z-index:9999;animation:ibLoad 1s infinite";if(CFG.loadingIndicator==="spinner")el.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.5);display:grid;place-items:center;z-index:9999";el.innerHTML=CFG.loadingIndicator==="spinner"?"<div style=\'width:40px;height:40px;border:4px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite\'></div>":"";document.body.appendChild(el);});}',



    'if(CFG.pullRefresh&&window.Capacitor){document.addEventListener("DOMContentLoaded",()=>{let startY=0;document.addEventListener("touchstart",e=>startY=e.touches[0].clientY,{passive:true});document.addEventListener("touchend",e=>{let dy=e.changedTouches[0].clientY-startY;if(dy>80&&window.scrollY===0) location.reload();},{passive:true});});}',


    'if(CFG.offlineScreen){function check(){var off=!navigator.onLine;var el=document.getElementById("ib-offline");if(off){if(!el){el=document.createElement("div");el.id="ib-offline";el.style.cssText="position:fixed;inset:0;background:#111827;color:#fff;display:grid;place-items:center;z-index:9998;text-align:center;padding:20px";el.innerHTML="<div><b>Sin conexión</b><p style=\'color:#9ca3af\'>"+CFG.offlineMessage.replace(/"/g,"&quot;")+"</p><button onclick=\'location.reload()\' style=\'margin-top:12px;padding:8px 16px;background:#6366f1;color:#fff;border:none;border-radius:8px\'>Reintentar</button></div>";document.body.appendChild(el);} } else if(el) el.remove();}window.addEventListener("online",check);window.addEventListener("offline",check);document.addEventListener("DOMContentLoaded",check);}',


    'if(CFG.drawerEnabled&&DRAWER.length){var btn=document.createElement("button");btn.textContent="\u2630";btn.style.cssText="position:fixed;top:12px;left:12px;z-index:9997;background:#111827;color:#fff;border:none;width:36px;height:36px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.3)";var drawer=document.createElement("div");drawer.id="ib-drawer";drawer.style.cssText="position:fixed;top:0;left:-280px;width:260px;height:100%;background:#111827;color:#fff;z-index:9998;transition:left .3s;overflow:auto;padding:16px";drawer.innerHTML="<b style=\'display:block;margin-bottom:12px\'>Menú</b>"+DRAWER.map(i=>"<a href=\'"+i.url+"\' style=\'display:block;padding:10px 8px;color:#fff;text-decoration:none;border-radius:6px;margin-bottom:4px;background:#1f2937\'>"+(i.icon?i.icon+" ":"")+i.label+"</a>").join("")+"<button id=\'ib-drawer-close\' style=\'margin-top:12px;width:100%;padding:8px;background:#374151;color:#fff;border:none;border-radius:6px\'>Cerrar</button>";document.addEventListener("DOMContentLoaded",()=>{document.body.appendChild(btn);document.body.appendChild(drawer);btn.onclick=()=>drawer.style.left="0";drawer.querySelector("#ib-drawer-close").onclick=()=>drawer.style.left="-280px";});}',


    'if(CFG.bottomNavEnabled&&BOTTOM.length){var bar=document.createElement("div");bar.id="ib-bottom";bar.style.cssText="position:fixed;bottom:0;left:0;right:0;background:#111827;color:#fff;display:flex;justify-content:space-around;padding:6px 0 8px;z-index:9997;border-top:1px solid #1f2937";bar.innerHTML=BOTTOM.map(i=>"<a href=\'"+i.url+"\' style=\'flex:1;text-align:center;color:#9ca3af;text-decoration:none;font-size:11px\'><div style=\'font-size:18px\'>"+(i.icon||"\u2022")+"</div>"+i.label+"</a>").join("");document.addEventListener("DOMContentLoaded",()=>{document.body.appendChild(bar);document.body.style.paddingBottom="60px";});}',

    'if(window.Intee){var origLog=console.log;window.addEventListener("error",e=>{try{Intee.track&&Intee.track("js_error",{message:e.message,source:e.filename});}catch{}});} })();'
  ].join('');
}






function patchCatalogSrc(cfg) {
  const NL = String.fromCharCode(10);

  const downloadJava = [
    'try{ getBridge().getWebView().setDownloadListener(new DownloadListener(){ public void onDownloadStart(String url, String ua, String cd, String mime, long len){ try{ Intent i=new Intent(Intent.ACTION_VIEW); i.setData(Uri.parse(url)); startActivity(i);}catch(Exception e){ try{ DownloadManager dm=(DownloadManager)getSystemService(DOWNLOAD_SERVICE); DownloadManager.Request r=new DownloadManager.Request(Uri.parse(url)); r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED); dm.enqueue(r);}catch(Exception ignored){}} } }); }catch(Exception ignored){}',
    'try{ getBridge().getWebView().setWebViewClient(new com.getcapacitor.BridgeWebViewClient(getBridge()){'
    + ' @Override public boolean shouldOverrideUrlLoading(WebView v, android.webkit.WebResourceRequest req){ String u=String.valueOf(req.getUrl());'
    + ' if(u.startsWith("tel:")||u.startsWith("mailto:")||u.startsWith("sms:")||u.startsWith("whatsapp://")||u.startsWith("intent:")){ try{ startActivity(new Intent(Intent.ACTION_VIEW, req.getUrl())); return true;}catch(Exception e){ return false;}}'
    + ' String rp=req.getUrl().getPath(); if(rp!=null&&rp.startsWith("/_capacitor_http_interceptor_")) return true;'
    + ' String rs=req.getUrl().getScheme(); if("http".equals(rs)||"https".equals(rs)) return false;'
    + ' return super.shouldOverrideUrlLoading(v, req); }'
    + ' @Override public boolean shouldOverrideUrlLoading(WebView v, String u){'
    + ' if(u.startsWith("tel:")||u.startsWith("mailto:")||u.startsWith("sms:")||u.startsWith("whatsapp://")||u.startsWith("intent:")){ try{ startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(u))); return true;}catch(Exception e){ return false;}}'
    + ' android.net.Uri du=android.net.Uri.parse(u); String sp=du.getPath(); if(sp!=null&&sp.startsWith("/_capacitor_http_interceptor_")) return true;'
    + ' String ss=du.getScheme(); if("http".equals(ss)||"https".equals(ss)) return false;'
    + ' return super.shouldOverrideUrlLoading(v, u); }'
    + ' @Override public void onPageFinished(WebView v, String url){ super.onPageFinished(v, url); try{ java.io.InputStream is=getAssets().open("public/catalog.js"); java.io.BufferedReader br=new java.io.BufferedReader(new java.io.InputStreamReader(is)); StringBuilder sb=new StringBuilder(); String line; while((line=br.readLine())!=null) sb.append(line).append("\\n"); br.close(); v.evaluateJavascript(sb.toString(), null);}catch(Exception ignored){} }'
    + ' }); }catch(Exception ignored){}'
  ].join(NL + '    ');

  return [
    "const fs=require('fs');",
    "const NL=String.fromCharCode(10);",
    "const cfg=JSON.parse(fs.readFileSync('build-config.json','utf8'));",
    "const pkg=cfg.packageName;",
    "const mp='android/app/src/main/java/'+pkg.split('.').join('/')+'/MainActivity.java';",
    "let src=fs.readFileSync(mp,'utf8');",
    "let changed=false;",

    "// onCreate: el scaffold vacio de Capacitor no lo trae, crearlo si hace falta",
    "if(!/super\\s*\\.\\s*onCreate\\s*\\(/.test(src)){",
    "  src=src.replace(/public class MainActivity extends BridgeActivity\\s*\\{/,m=>m+NL+'  @Override protected void onCreate(android.os.Bundle ibState) {'+NL+'    super.onCreate(ibState);'+NL+'  }'+NL);",
    "  changed=true;",
    "}",

    "// FLAG_SECURE",
    "if(cfg.flagSecure && src.indexOf('FLAG_SECURE')===-1){",
    "  src=src.replace(/super\\.onCreate\\([^)]*\\);/,m=>m+NL+'    if(true) getWindow().setFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE, android.view.WindowManager.LayoutParams.FLAG_SECURE);');",
    "  changed=true;",
    "}",


    "// DownloadManager + tel/mailto intents + catalog JS (delegando a BridgeWebViewClient)",
    "if(src.indexOf('DownloadListener')===-1){",
    "  src=src.replace(/import\\s+com\\.getcapacitor\\.BridgeActivity\\s*;/,'import android.app.DownloadManager; import android.content.Intent; import android.net.Uri; import android.webkit.DownloadListener; import android.webkit.WebView; import android.webkit.WebViewClient; import com.getcapacitor.BridgeActivity;');",
    "  src=src.replace(/super\\.onCreate\\([^)]*\\);/,m=>m+NL+" + JSON.stringify(downloadJava) + ");",
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
  ].join(NL) + NL;
}



function nativeMainActivitySrc(pkg, cfg) {
  const url = cfg.inputType === 'url' ? cfg.url : 'file:///android_asset/public/index.html';
  const needPerms = Object.entries(cfg.permissions || {}).some(([k, v]) => v && PERMISSION_SPEC[k]?.runtime);
  const needSpecial = needsSpecialFile(cfg);



  const grantBody = [
    ['VIDEO', 'VIDEO'],
    ['AUDIO', 'AUDIO'],
    ['GEO', 'GEOLOCATION']
  ].map(([kind, resource]) => {
    const consts = webGrantConsts(cfg, kind);
    if (!consts.length) return '';
    const shortNames = consts.map(c => '"' + c.split('.').pop() + '"').join(',');
    return 'if(r.contains("' + resource + '")&&hasAny(new String[]{' + shortNames + '})) ok.add(r);';
  }).filter(Boolean).join(' else ');

  const audioBridgeHook = cfg.permissions.foreground ? ' try { wv.addJavascriptInterface(new AudioBridge(this), "InteeAudio"); } catch (Exception ignored) {}' : '';
  const permsHook = needPerms ? ' try { NativePermissions.requestAll(this); } catch (Exception ignored) {}' : '';
  const specialHook = needSpecial ? ' try { SpecialAccess.ensure(this); } catch (Exception ignored) {}' : '';


  const foregroundHook = cfg.permissions.foreground
    ? ' try { if (android.os.Build.VERSION.SDK_INT >= 26) startForegroundService(new android.content.Intent(this, RadioService.class)); else startService(new android.content.Intent(this, RadioService.class)); } catch (Exception ignored) {}'
    : '';
  const permissionResultHook = needPerms
    ? '  @Override public void onRequestPermissionsResult(int c,String[] p,int[] r){ super.onRequestPermissionsResult(c,p,r); try{ if(c==NativePermissions.REQ_BATCH) NativePermissions.requestBackground(this); }catch(Exception ignored){} }\n'
    : '';

  const downloadHook = cfg.downloadManager
    ? ' wv.setDownloadListener(new DownloadListener(){ public void onDownloadStart(String u,String ua,String cd,String mime,long len){ try{ if(!u.startsWith("http")){ startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(u))); return; } String nm=ibFileName(cd,u); DownloadManager dm=(DownloadManager)getSystemService(DOWNLOAD_SERVICE); DownloadManager.Request rq=new DownloadManager.Request(Uri.parse(u)); rq.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED); try{ rq.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,nm); }catch(Exception ignored){} dm.enqueue(rq); }catch(Exception e){ try{ startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(u))); }catch(Exception ignored){} } } });'
    : '';

  const fileChooserHook = ' public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> cb,WebChromeClient.FileChooserParams p){ if(fileCb!=null){ try{ fileCb.onReceiveValue(null); }catch(Exception ignored){} } fileCb=cb; try{ Intent i=new Intent(Intent.ACTION_GET_CONTENT); i.addCategory(Intent.CATEGORY_OPENABLE); i.setType("*/*"); String[] mt=p!=null?p.getAcceptTypes():null; if(mt!=null&&mt.length>0&&mt[0]!=null&&!mt[0].isEmpty()&&!mt[0].equals("*/*")) i.putExtra(Intent.EXTRA_MIME_TYPES,mt); if(p!=null&&p.getMode()==WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true); startActivityForResult(Intent.createChooser(i,"Seleccionar archivo"),4102); }catch(Exception e){ fileCb=null; try{ cb.onReceiveValue(null); }catch(Exception ignored){} } return true; }';

  const activityResultHook = '  @Override protected void onActivityResult(int c,int d,Intent data){ super.onActivityResult(c,d,data); if(c==4102&&fileCb!=null){ Uri[] out=null; try{ if(d==RESULT_OK&&data!=null){ if(data.getClipData()!=null&&data.getClipData().getItemCount()>0){ int n=data.getClipData().getItemCount(); out=new Uri[n]; for(int i=0;i<n;i++) out[i]=data.getClipData().getItemAt(i).getUri(); } else if(data.getData()!=null){ out=new Uri[]{data.getData()}; } } }catch(Exception ignored){} ValueCallback<Uri[]> cb=fileCb; fileCb=null; try{ cb.onReceiveValue(out); }catch(Exception ignored){} } }\n';

  return `package ${pkg};
import android.app.DownloadManager; import android.content.Intent; import android.net.Uri; import android.os.Environment; import android.content.pm.PackageManager; import android.os.Bundle; import android.webkit.ValueCallback; import android.webkit.DownloadListener; import android.webkit.WebView; import android.webkit.WebChromeClient; import android.webkit.WebViewClient; import android.webkit.PermissionRequest; import androidx.appcompat.app.AppCompatActivity;
public class MainActivity extends AppCompatActivity {
  WebView wv; ValueCallback<Uri[]> fileCb;
  private boolean hasAny(String[] perms){ try{ for(String p : perms){ String full="android.permission."+p; if(checkSelfPermission(full)==PackageManager.PERMISSION_GRANTED) return true; } }catch(Exception ignored){} return false; }
  private boolean declared(String p){ try{ String[] d=getPackageManager().getPackageInfo(getPackageName(),PackageManager.GET_PERMISSIONS).requestedPermissions; return d!=null && java.util.Arrays.asList(d).contains("android.permission."+p); }catch(Exception e){ return false; } }
  private String ibFileName(String cd,String u){ try{ if(cd!=null){ int i=cd.indexOf("filename="); if(i>=0){ String n=cd.substring(i+8).trim().replace(String.valueOf('"'),""); if(!n.isEmpty()) return n.replaceAll("[\\\\/:*?\\\"<>|]","_"); } } String s=Uri.parse(u).getLastPathSegment(); if(s!=null&&!s.isEmpty()) return s.replaceAll("[\\\\/:*?\\\"<>|]","_"); }catch(Exception ignored){} return "download"+System.currentTimeMillis(); }
  @Override protected void onCreate(Bundle b){ super.onCreate(b); wv=new WebView(this); setContentView(wv); wv.getSettings().setJavaScriptEnabled(true); wv.getSettings().setDomStorageEnabled(true); wv.getSettings().setAllowFileAccess(true); wv.getSettings().setMixedContentMode(0);${audioBridgeHook}${downloadHook} wv.setWebViewClient(new WebViewClient(){ public boolean shouldOverrideUrlLoading(WebView v,String u){ if(u.startsWith("tel:")||u.startsWith("mailto:")||u.startsWith("whatsapp:")){ try{ startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(u))); return true;}catch(Exception e){} } return false; } public void onPageFinished(WebView v,String u){ try{ java.io.InputStream is=getAssets().open("public/catalog.js"); java.io.BufferedReader br=new java.io.BufferedReader(new java.io.InputStreamReader(is)); StringBuilder sb=new StringBuilder(); String l; while((l=br.readLine())!=null) sb.append(l).append("\\n"); br.close(); v.evaluateJavascript(sb.toString(),null);}catch(Exception e){} } }); wv.setWebChromeClient(new WebChromeClient(){ public void onPermissionRequest(final PermissionRequest r){ runOnUiThread(new Runnable(){ public void run(){ try{ String[] res=r.getResources(); java.util.List<String> ok=new java.util.ArrayList<>(); for(String x:res){ ${grantBody || ' '} } if(!ok.isEmpty()) r.grant(ok.toArray(new String[0])); else r.deny(); }catch(Exception e){ try{r.deny();}catch(Exception ignored){}} }}); }${fileChooserHook} });${permsHook}${specialHook}${foregroundHook} wv.loadUrl("${url}"); }
${permissionResultHook}${activityResultHook}  @Override public void onBackPressed(){ if(wv.canGoBack()) wv.goBack(); else super.onBackPressed(); }
}
`;
}



function geckoMainActivitySrc(pkg, cfg) {
  const url = cfg.inputType === 'url' ? cfg.url : 'file:///android_asset/public/index.html';
  const needPerms = Object.entries(cfg.permissions || {}).some(([k, v]) => v && PERMISSION_SPEC[k]?.runtime);
  const needSpecial = needsSpecialFile(cfg);

  const hooks = (needPerms ? ' try { NativePermissions.requestAll(this); } catch (Exception ignored) {}' : '')
    + (needSpecial ? ' try { SpecialAccess.ensure(this); } catch (Exception ignored) {}' : '')
    + (cfg.permissions.foreground ? ' try { if (android.os.Build.VERSION.SDK_INT >= 26) startForegroundService(new android.content.Intent(this, RadioService.class)); else startService(new android.content.Intent(this, RadioService.class)); } catch (Exception ignored) {}' : '');

  const bgHook = needPerms ? ' try{ if(c==NativePermissions.REQ_BATCH) NativePermissions.requestBackground(this); }catch(Exception ignored){}' : '';

  const filePromptHook = ' session.setPromptDelegate(new GeckoSession.PromptDelegate(){ public GeckoResult<GeckoSession.PromptDelegate.PromptResponse> onFilePrompt(GeckoSession s,final GeckoSession.PromptDelegate.FilePrompt p){ GeckoResult<GeckoSession.PromptDelegate.PromptResponse> r=new GeckoResult<GeckoSession.PromptDelegate.PromptResponse>(); try{ filePrompt=p; fileRes=r; Intent i; if(p.type==GeckoSession.PromptDelegate.FilePrompt.Type.FOLDER){ i=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE); }else{ i=new Intent(Intent.ACTION_GET_CONTENT); i.addCategory(Intent.CATEGORY_OPENABLE); i.setType("*/*"); String[] mt=p.mimeTypes; if(mt!=null&&mt.length>0&&mt[0]!=null&&!mt[0].isEmpty()) i.putExtra(Intent.EXTRA_MIME_TYPES,mt); if(p.type==GeckoSession.PromptDelegate.FilePrompt.Type.MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true); } startActivityForResult(i,4102); }catch(Exception e){ fileRes=null; filePrompt=null; try{ r.complete(p.dismiss()); }catch(Exception ignored){} } return r; } });';

  const downloadDelegate = cfg.downloadManager
    ? ' session.setContentDelegate(new GeckoSession.ContentDelegate(){ public void onExternalResponse(GeckoSession s,WebResponse resp){ try{ String u=resp.uri; String nm=null; try{ for(java.util.Map.Entry<String,String> en:resp.headers.entrySet()){ if(en.getKey()!=null&&en.getKey().equalsIgnoreCase("content-disposition")){ String v=en.getValue(); int ix=v!=null?v.indexOf("filename="):-1; if(ix>=0) nm=v.substring(ix+8).trim().replace(String.valueOf(\'"\'),""); } } }catch(Exception ignored){} if(nm!=null&&!nm.isEmpty()) nm=nm.replaceAll("[\\\\/:*?\\\"<>|]","_"); boolean queued=false; if(u!=null&&u.startsWith("http")){ try{ DownloadManager dm=(DownloadManager)getSystemService(DOWNLOAD_SERVICE); DownloadManager.Request rq=new DownloadManager.Request(Uri.parse(u)); rq.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED); if(nm!=null&&!nm.isEmpty()){ try{ rq.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,nm); }catch(Exception ignored){} } dm.enqueue(rq); queued=true; }catch(Exception ignored){} } if(queued){ try{ if(resp.body!=null) resp.body.close(); }catch(Exception ignored){} return; } final String fname=(nm!=null&&!nm.isEmpty())?nm:("download"+System.currentTimeMillis()); final java.io.InputStream in=resp.body; if(in==null) return; new Thread(new Runnable(){ public void run(){ try{ java.io.File dir=Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS); dir.mkdirs(); java.io.File f=new java.io.File(dir,fname); java.io.OutputStream os=new java.io.FileOutputStream(f); byte[] b=new byte[8192]; int n; while((n=in.read(b))>0) os.write(b,0,n); os.close(); in.close(); }catch(Exception ignored){ try{ in.close(); }catch(Exception ignored2){} } } }).start(); }catch(Exception ignored){} } });'
    : '';

  const activityResultHook = '  @Override protected void onActivityResult(int c,int d,Intent data){ super.onActivityResult(c,d,data); if(c==4102&&fileRes!=null){ GeckoResult<GeckoSession.PromptDelegate.PromptResponse> r=fileRes; GeckoSession.PromptDelegate.FilePrompt p=filePrompt; fileRes=null; filePrompt=null; if(p==null) return; try{ if(!p.isComplete()){ if(d==RESULT_OK&&data!=null){ if(data.getClipData()!=null&&data.getClipData().getItemCount()>0){ int n=data.getClipData().getItemCount(); Uri[] us=new Uri[n]; for(int i=0;i<n;i++) us[i]=data.getClipData().getItemAt(i).getUri(); r.complete(p.confirm(this,us)); } else if(data.getData()!=null){ r.complete(p.confirm(this,data.getData())); } else { r.complete(p.dismiss()); } } else { r.complete(p.dismiss()); } } }catch(Exception e){ try{ if(!p.isComplete()) r.complete(p.dismiss()); }catch(Exception ignored){} } } }\n';

  return `package ${pkg};
import android.app.DownloadManager; import android.content.Intent; import android.net.Uri; import android.os.Environment; import android.content.pm.PackageManager; import android.os.Bundle; import org.mozilla.geckoview.GeckoView; import org.mozilla.geckoview.GeckoSession; import org.mozilla.geckoview.GeckoRuntime; import org.mozilla.geckoview.GeckoResult; import org.mozilla.geckoview.WebResponse; import androidx.appcompat.app.AppCompatActivity;
public class MainActivity extends AppCompatActivity {
  GeckoView gv; GeckoSession session; private GeckoSession.PermissionDelegate.Callback pendCb; GeckoResult<GeckoSession.PromptDelegate.PromptResponse> fileRes; GeckoSession.PromptDelegate.FilePrompt filePrompt;
  @Override protected void onCreate(Bundle b){ super.onCreate(b); gv=new GeckoView(this); setContentView(gv); GeckoRuntime rt=GeckoRuntime.create(this); session=new GeckoSession(); session.open(rt); session.setPermissionDelegate(new GeckoSession.PermissionDelegate(){ public void onAndroidPermissionsRequest(GeckoSession s,String[] perms,GeckoSession.PermissionDelegate.Callback cb){ pendCb=cb; try{ requestPermissions(perms,4101); }catch(Exception e){ pendCb=null; try{ cb.reject(); }catch(Exception ignored){} } } });${filePromptHook}${downloadDelegate}${hooks} session.loadUri("${url}"); }
  @Override public void onRequestPermissionsResult(int c,String[] p,int[] r){ super.onRequestPermissionsResult(c,p,r); if(c==4101&&pendCb!=null){ GeckoSession.PermissionDelegate.Callback cb=pendCb; pendCb=null; boolean ok=r!=null&&r.length>0; if(r!=null){ for(int x:r){ if(x!=PackageManager.PERMISSION_GRANTED){ ok=false; break; } } } if(ok) cb.grant(); else cb.reject(); }${bgHook} }
${activityResultHook}  @Override public void onBackPressed(){ if(session!=null) session.goBack(); else super.onBackPressed(); }
}
`;
}



function cordovaConfigXml(cfg) {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const orientation = cfg.orientation === 'portrait' ? 'portrait' : (cfg.orientation === 'landscape' ? 'landscape' : 'default');
  return `<?xml version="1.0" encoding="utf-8"?>
<widget id="${cfg.packageName}" version="${cfg.versionName}" xmlns="http://www.w3.org/ns/widgets" xmlns:cdv="http://cordova.apache.org/ns/1.0">
    <name>${esc(cfg.appName)}</name>
    <description>${esc(cfg.description)}</description>
    <author>${esc(cfg.author)}</author>
    <content src="${cfg.inputType === 'url' ? esc(cfg.url) : 'index.html'}" />
    <access origin="*" />
    <allow-intent href="tel:*" />
    <allow-intent href="sms:*" />
    <allow-intent href="mailto:*" />
    <allow-intent href="https://*" />
    <allow-intent href="http://*" />
    <preference name="Orientation" value="${orientation}" />
    <preference name="Fullscreen" value="${cfg.fullscreen ? 'true' : 'false'}" />
    <preference name="BackgroundColor" value="${cfg.splashColor || '#ffffff'}" />
    <preference name="android-minSdkVersion" value="${cfg.minSdk}" />
    <preference name="android-targetSdkVersion" value="${cfg.targetSdk}" />
    <preference name="android-compileSdkVersion" value="${cfg.compileSdk}" />
</widget>`;
}


function geckoGradlePatchSrc() {
  const NL = String.fromCharCode(10);
  const dep = "    implementation 'org.mozilla.geckoview:geckoview:120.0.20231208211905'";
  return [
    "const fs=require('fs');",
    "const NL=String.fromCharCode(10);",
    "const root='android/build.gradle';",
    "const app='android/app/build.gradle';",
    "if(fs.existsSync(root)){",
    "  let s=fs.readFileSync(root,'utf8');",
    "  if(s.indexOf('maven.mozilla.org')===-1){",
    "    if(/allprojects\\s*\\{/.test(s)){ s=s.replace(/allprojects\\s*\\{/, m=>m+NL+'    repositories { maven { url \\'https://maven.mozilla.org/maven2\\' } }'); fs.writeFileSync(root,s); console.log('GeckoView repository added'); }",
    "    else { console.log('GeckoView: sin bloque allprojects, se usa el repositorio por defecto'); }",
    "  } else { console.log('GeckoView repository already present'); }",
    "}",
    "if(fs.existsSync(app)){",
    "  let a=fs.readFileSync(app,'utf8');",
    "  if(a.indexOf('geckoview')===-1){",
    "    a=a.replace(/dependencies\\s*\\{/, m=>m+NL+" + JSON.stringify(dep) + ");",
    "    fs.writeFileSync(app,a); console.log('GeckoView dependency added');",
    "  } else { console.log('GeckoView dependency already present'); }",
    "}"
  ].join(NL) + NL;
}

module.exports = {
  catalogUiJsSrc,
  patchCatalogSrc,
  nativeMainActivitySrc,
  geckoMainActivitySrc,
  cordovaConfigXml,
  geckoGradlePatchSrc
};
