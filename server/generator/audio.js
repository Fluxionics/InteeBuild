'use strict';




function escJava(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}


function javaString(s) {
  return '"' + String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}






function nativeAudioServiceSrc(pkg, streamUrl, autoplay, appName) {
  const safeUrl = escJava(streamUrl);
  return `package ${pkg};

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;
import java.util.Collections;

public class RadioService extends Service {
    private static final String TAG = "InteeRadio";
    private static final String CHANNEL_ID = "inteebuild_radio";
    private static final int NOTIF_ID = 1;
    public static final String ACTION_PLAY = "${pkg}.ACTION_PLAY";
    public static final String ACTION_PAUSE = "${pkg}.ACTION_PAUSE";
    public static final String ACTION_KEEP = "${pkg}.ACTION_KEEP";
    private static final String STREAM_URL = "${safeUrl}";
    private static final boolean AUTOPLAY = ${autoplay ? 'true' : 'false'};
    private static volatile RadioService instance;
    private MediaPlayer mp;
    private MediaSession session;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private String currentUrl = STREAM_URL;
    private volatile boolean wantPlay = false;
    private volatile boolean webAwake = false;
    private long pendingSeek = -1;

    public static void play(Context ctx, String url) {
        play(ctx, url, -1);
    }

    public static void play(Context ctx, String url, long startMs) {
        Intent i = new Intent(ctx, RadioService.class);
        i.setAction(ACTION_PLAY);
        if (url != null && !url.isEmpty()) i.putExtra("url", url);
        if (startMs > 0) i.putExtra("seek", startMs);
        try { if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i); else ctx.startService(i); } catch (Exception ignored) { Log.e(TAG, "Error starting service", ignored); }
    }

    public static void pause(Context ctx) {
        if (instance != null) instance.doPause();
        else { Intent i = new Intent(ctx, RadioService.class); i.setAction(ACTION_PAUSE); try { ctx.startService(i); } catch (Exception ignored) { Log.e(TAG, "Error pausing service", ignored); } }
    }

    public static boolean isPlaying() {
        try { return instance != null && instance.mp != null && instance.mp.isPlaying(); }
        catch (Exception e) { return false; }
    }

    public static boolean isActive() {
        try { RadioService s = instance; return s != null && (s.wantPlay || s.webAwake); }
        catch (Exception e) { return false; }
    }

    public static void keepAwake(Context ctx, boolean on) {
        RadioService s = instance;
        if (s == null) {
            if (!on) return;
            Intent i = new Intent(ctx, RadioService.class);
            i.setAction(ACTION_KEEP);
            try { if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i); else ctx.startService(i); } catch (Exception ignored) { Log.e(TAG, "Error starting service", ignored); }
            return;
        }
        s.webAwake = on;
        s.refreshWakeLock();
        s.updateState(s.mpPlaying() || s.webAwake);
    }

    private static boolean looksLive(String url) {
        if (url == null || url.isEmpty()) return true;
        String s = url.toLowerCase();
        String[] hints = { "/stream", "/live", "icecast", "shoutcast", ".m3u8", ".aac", ".pls", "radio", "playlist" };
        for (String h : hints) if (s.contains(h)) return true;
        int q = s.indexOf('?');
        String path = q >= 0 ? s.substring(0, q) : s;
        int dot = path.lastIndexOf('.');
        if (dot < 0) return true;
        String ext = path.substring(dot);
        return !(ext.equals(".mp3") || ext.equals(".ogg") || ext.equals(".m4a") || ext.equals(".wav") || ext.equals(".opus") || ext.equals(".flac") || ext.equals(".webm") || ext.equals(".mp4"));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            try {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, TAG + ":Audio");
                wakeLock.setReferenceCounted(false);
            } catch (Exception e) { wakeLock = null; Log.e(TAG, "WakeLock unavailable", e); }
        }
        try {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, TAG + ":Wifi");
                wifiLock.setReferenceCounted(false);
            }
        } catch (Exception e) { wifiLock = null; Log.e(TAG, "WifiLock unavailable", e); }
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Reproduccion en segundo plano", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Control de reproduccion de audio");
            nm.createNotificationChannel(ch);
        }
        try {
            session = new MediaSession(this, "InteeBuildSession");
            session.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
            session.setCallback(new MediaSession.Callback() {
                @Override public void onPlay() { doPlay(currentUrl); }
                @Override public void onPause() { doPause(); }
                @Override public void onStop() { doPause(); }
            });
            session.setActive(true);
        } catch (Exception e) { Log.e(TAG, "MediaSession error", e); }
        startForeground(NOTIF_ID, buildNotif(false));
        if (AUTOPLAY && STREAM_URL.length() > 0) doPlay(STREAM_URL);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_PAUSE.equals(action)) { doPause(); }
        else if (ACTION_KEEP.equals(action)) { webAwake = true; refreshWakeLock(); updateState(mpPlaying() || webAwake); }
        else {
            String u = intent != null ? intent.getStringExtra("url") : null;
            pendingSeek = intent != null ? intent.getLongExtra("seek", -1) : -1;
            if (u == null || u.isEmpty()) u = currentUrl;
            doPlay(u);
        }
        return START_STICKY;
    }

    private synchronized void doPlay(String url) {
        if (url == null || url.isEmpty()) url = STREAM_URL;
        if (url.isEmpty()) return;
        currentUrl = url;
        wantPlay = true;
        refreshWakeLock();
        try {
            if (mp != null) { try { mp.reset(); } catch (Exception ignored) {} }
            else {
                mp = new MediaPlayer();
                try { mp.setWakeMode(getApplicationContext(), PowerManager.PARTIAL_WAKE_LOCK); } catch (Exception e) { Log.e(TAG, "setWakeMode error", e); }
                if (Build.VERSION.SDK_INT >= 21) mp.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
                mp.setOnPreparedListener(new MediaPlayer.OnPreparedListener() { public void onPrepared(MediaPlayer p) { p.start(); long s = pendingSeek; pendingSeek = -1; if (s > 0) { try { p.seekTo((int) Math.min(s, Integer.MAX_VALUE)); } catch (Exception ignored) {} } updateState(true); } });
                mp.setOnCompletionListener(new MediaPlayer.OnCompletionListener() { public void onCompletion(MediaPlayer p) { if (wantPlay && looksLive(currentUrl)) { try { p.reset(); connectAndPrepare(currentUrl); } catch (Exception ignored) {} } else { wantPlay = false; updateState(false); refreshWakeLock(); } } });
                mp.setOnErrorListener(new MediaPlayer.OnErrorListener() { public boolean onError(MediaPlayer p, int what, int extra) { if (wantPlay && looksLive(currentUrl)) { try { p.reset(); connectAndPrepare(currentUrl); } catch (Exception ignored) {} return true; } wantPlay = false; updateState(false); refreshWakeLock(); return false; } });
            }
            connectAndPrepare(url);
        } catch (Exception ignored) {}
    }

    private void connectAndPrepare(String url) throws Exception {
        mp.setDataSource(getApplicationContext(), Uri.parse(url), Collections.singletonMap("Icy-MetaData", "0"));
        mp.prepareAsync();
        updateState(false);
    }

    private synchronized void doPause() {
        wantPlay = false;
        try { if (mp != null && mp.isPlaying()) mp.pause(); } catch (Exception ignored) {}
        updateState(false);
        refreshWakeLock();
    }

    private boolean mpPlaying() {
        try { return mp != null && mp.isPlaying(); } catch (Exception e) { return false; }
    }

    private void refreshWakeLock() {
        boolean need = webAwake || wantPlay;
        try {
            if (wakeLock != null) {
                if (need && !wakeLock.isHeld()) wakeLock.acquire();
                else if (!need && wakeLock.isHeld()) wakeLock.release();
            }
        } catch (Exception e) { Log.e(TAG, "WakeLock error", e); }
        try {
            if (wifiLock != null) {
                if (need && !wifiLock.isHeld()) wifiLock.acquire();
                else if (!need && wifiLock.isHeld()) wifiLock.release();
            }
        } catch (Exception e) { Log.e(TAG, "WifiLock error", e); }
    }

    private void updateState(boolean playing) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            nm.notify(NOTIF_ID, buildNotif(playing));
            if (session != null) {
                PlaybackState st = new PlaybackState.Builder().setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE).setState(playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, 0, 1.0f).build();
                session.setPlaybackState(st);
            }
        } catch (Exception ignored) {}
    }

    private Notification buildNotif(boolean playing) {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent content = launch != null ? PendingIntent.getActivity(this, 0, launch, pendingFlags()) : null;
        Intent togel = new Intent(this, RadioService.class);
        togel.setAction(playing ? ACTION_PAUSE : ACTION_PLAY);
        PendingIntent act = PendingIntent.getService(this, 1, togel, pendingFlags());
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL_ID) : new Notification.Builder(this);
        b.setContentTitle(${javaString(appName)})
                .setContentText(playing ? "Reproduciendo en segundo plano" : "Toca play en la app")
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .addAction(playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, playing ? "Pausar" : "Play", act);
        if (content != null) b.setContentIntent(content);
        try { if (session != null && Build.VERSION.SDK_INT >= 21) b.setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0)); } catch (Exception ignored) {}
        try { return b.build(); } catch (Exception e) { return new Notification(); }
    }

    private int pendingFlags() {
        return Build.VERSION.SDK_INT >= 23 ? (PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE) : PendingIntent.FLAG_UPDATE_CURRENT;
    }

    @Override
    public void onDestroy() {
        wantPlay = false;
        webAwake = false;
        try { if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); } catch (Exception ignored) {}
        try { if (wifiLock != null && wifiLock.isHeld()) wifiLock.release(); } catch (Exception ignored) {}
        try { if (session != null) { session.setActive(false); session.release(); } } catch (Exception ignored) {}
        try { if (mp != null) { mp.release(); mp = null; } } catch (Exception ignored) {}
        instance = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
`;
}




function audioBridgeSrc(pkg) {
  return `package ${pkg};

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

public class AudioBridge {
    private final Context ctx;
    private final Handler ui = new Handler(Looper.getMainLooper());
    public AudioBridge(Context ctx) { this.ctx = ctx.getApplicationContext(); }
    private void toast(final String msg) {
        try { ui.post(new Runnable() { public void run() { try { Toast.makeText(ctx, msg, Toast.LENGTH_SHORT).show(); } catch (Exception ignored) {} } }); } catch (Exception ignored) {}
    }
    @JavascriptInterface public void play(String url) { toast("Audio nativo: reproduciendo"); RadioService.play(ctx, url); }
    @JavascriptInterface public void playAt(String url, long startMs) { toast("Audio nativo: reproduciendo"); RadioService.play(ctx, url, startMs); }
    @JavascriptInterface public void pause() { toast("Audio nativo: en pausa"); RadioService.pause(ctx); }
    @JavascriptInterface public boolean isPlaying() { return RadioService.isPlaying(); }
    @JavascriptInterface public boolean isActive() { return RadioService.isActive(); }
    @JavascriptInterface public void keepAwake(boolean on) { RadioService.keepAwake(ctx, on); }
}
`;
}




function foregroundRuntimeSrc() {
  return [
    '(function(){',
    'if(window.__ibFg)return;window.__ibFg=1;',
    'var st={owner:"web",url:"",el:null,ms:0,at:0,playing:false,pauseAt:0,hideMs:0,started:0};',
    'function br(){try{var b=window.InteeAudio;return b&&typeof b.play==="function"?b:null;}catch(e){return null;}}',
    'function aud(e){var t=e&&e.target;if(!t||!t.tagName)return null;var n=String(t.tagName).toUpperCase();return (n==="AUDIO"||n==="VIDEO")?t:null;}',
    'function u(el){return el.currentSrc||el.src||"";}',
    'document.addEventListener("play",function(e){',
    'var el=aud(e);if(!el)return;var url=u(el);if(!url||url.indexOf("blob:")===0)return;',
    'st.owner="web";st.el=el;st.url=url;st.ms=(el.currentTime||0)*1000;st.at=Date.now();st.playing=true;',
    'var b=br();if(b){try{b.keepAwake(true);}catch(x){}}',
    '},true);',
    'document.addEventListener("pause",function(e){',
    'var el=aud(e);if(!el)return;st.pauseAt=Date.now();',
    'if(document.hidden)return;',
    'st.playing=false;st.owner="web";',
    'var b=br();if(b){try{b.keepAwake(false);}catch(x){}}',
    '},true);',
    'document.addEventListener("ended",function(e){',
    'var el=aud(e);if(!el)return;st.playing=false;',
    'var b=br();if(b){try{b.keepAwake(false);if(st.owner==="native"){b.pause();st.owner="web";}}catch(x){}}',
    '},true);',
    'function hide(){',
    'if(st.owner!=="web")return;',
    'if(!st.playing&&(!st.pauseAt||Date.now()-st.pauseAt>700))return;',
    'if(!st.url||st.url.indexOf("blob:")===0)return;',
    'var b=br();if(!b)return;',
    'var pos=st.ms+(Date.now()-st.at);if(pos<0)pos=0;',
    'try{ if(typeof b.playAt==="function") b.playAt(st.url,pos); else b.play(st.url); }catch(x){ return; }',
    'st.owner="native";st.hideMs=pos;st.started=Date.now();',
    'if(st.el){try{st.el.pause();}catch(x){}}',
    '}',
    'function show(){',
    'if(st.owner!=="native")return;',
    'st.owner="web";',
    'var b=br();var active=true;',
    'if(b){try{active=(typeof b.isActive==="function")?b.isActive():b.isPlaying();}catch(x){}try{b.pause();}catch(x){}}',
    'if(!active){st.playing=false;return;}',
    'var pos=st.hideMs+(Date.now()-st.started);',
    'st.ms=pos;st.at=Date.now();',
    'var el=st.el;',
    'if(el&&st.playing){try{el.currentTime=pos/1000;}catch(x){}try{var p=el.play();if(p&&p.catch)p.catch(function(){});}catch(x){}}',
    'if(b&&st.playing){try{b.keepAwake(true);}catch(x){}}',
    '}',
    'document.addEventListener("visibilitychange",function(){try{if(document.hidden)hide();else show();}catch(x){}},false);',
    '})();'
  ].join('');
}




function mainActivityPatchSrc() {
  const NL = String.fromCharCode(10);
  return [
    "const fs = require('fs');",
    "const NL = String.fromCharCode(10);",
    "const pkg = JSON.parse(fs.readFileSync('build-config.json', 'utf8')).packageName;",
    "const mp = 'android/app/src/main/java/' + pkg.split('.').join('/') + '/MainActivity.java';",
    "let src = fs.readFileSync(mp, 'utf8');",


    "if (src.indexOf('RadioService') === -1) {",
    "  src = src.split('import com.getcapacitor.BridgeActivity;').join(['import android.content.Intent;', 'import android.os.Build;', 'import android.os.Bundle;', 'import com.getcapacitor.BridgeActivity;'].join(NL));",
    "  const radioHook = 'try { if (Build.VERSION.SDK_INT >= 26) startForegroundService(new Intent(this, RadioService.class)); else startService(new Intent(this, RadioService.class)); } catch (Exception ignored) {}';",
    "  if (/super\\s*\\.\\s*onCreate\\s*\\(/.test(src)) {",
    "    src = src.replace(/super\\.onCreate\\([^)]*\\);/, function (m) { return m + NL + '    ' + radioHook; });",
    "  } else {",
    "    src = src.replace(/public class MainActivity extends BridgeActivity\\s*\\{/, function (m) {",
    "      return m + NL + '  @Override' + NL + '  public void onCreate(Bundle savedInstanceState) {' + NL + '    super.onCreate(savedInstanceState);' + NL + '    ' + radioHook + NL + '  }' + NL;",
    "    });",
    "  }",
    "  fs.writeFileSync(mp, src);",
    "}",
    "console.log('RadioService hook present: ' + (src.indexOf('RadioService') !== -1));"
  ].join(NL) + NL;
}

function patchAudioSrc() {
  const NL = String.fromCharCode(10);
  return [
    "const fs=require('fs');",
    "const NL=String.fromCharCode(10);",
    "const pkg=JSON.parse(fs.readFileSync('build-config.json','utf8')).packageName;",
    "const mp='android/app/src/main/java/'+pkg.split('.').join('/')+'/MainActivity.java';",
    "let src=fs.readFileSync(mp,'utf8');",
    "let changed=false;",
    "if(/extends\\s+BridgeActivity/.test(src)&&src.indexOf('InteeAudio')===-1){",
    "  if(!/super\\s*\\.\\s*onCreate\\s*\\(/.test(src)){",
    "    src=src.replace(/public class MainActivity extends BridgeActivity\\s*\\{/,m=>m+NL+'  @Override protected void onCreate(android.os.Bundle ibState) {'+NL+'    super.onCreate(ibState);'+NL+'  }'+NL);",
    "  }",
    "  src=src.replace(/super\\.onCreate\\([^)]*\\);/,m=>m+NL+'    try{ getBridge().getWebView().addJavascriptInterface(new AudioBridge(this), \"InteeAudio\"); }catch(Exception ignored){}');",
    "  changed=true;",
    "  fs.writeFileSync(mp,src);",
    "}",
    "console.log('AudioBridge patch applied:'+changed);"
  ].join(NL) + NL;
}




function notifyScriptSrc(cfg) {
  return [
    '(function(){',

    'var TITLE=' + JSON.stringify(cfg.notifyTitle) + ';',
    'var TEXT=' + JSON.stringify(cfg.notifyText || cfg.appName) + ';',
    'var ON_OPEN=' + (cfg.notifyOnOpen ? 'true' : 'false') + ';',
    'var ON_CLOSE=' + (cfg.notifyOnClose ? 'true' : 'false') + ';',
    'var DELAY_MIN=' + cfg.notifyDelayMinutes + ';',

    'function cap(){return (window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.LocalNotifications)||null;}',
    'async function ensure(){var LN=cap();if(!LN)return null;try{var st=await LN.checkPermissions();if(st.display!=="granted"){await LN.requestPermissions();}}catch(e){}return LN;}',
    'async function fire(id){var LN=await ensure();if(!LN)return;try{await LN.schedule({notifications:[{id:id,title:TITLE,body:TEXT,schedule:{at:new Date(Date.now()+2000)}}]});}catch(e){}}',

    'if(ON_OPEN){window.addEventListener("load",function(){fire(101);});}',
    'if(ON_CLOSE){document.addEventListener("visibilitychange",function(){if(document.hidden){fire(102);}});window.addEventListener("pagehide",function(){fire(102);});}',
    'if(DELAY_MIN>0){setTimeout(function(){fire(103);},DELAY_MIN*60000);}',

    '})();'
  ].join('');
}

module.exports = {
  escJava,
  nativeAudioServiceSrc,
  audioBridgeSrc,
  javaString,
  foregroundRuntimeSrc,
  mainActivityPatchSrc,
  notifyScriptSrc,
  patchAudioSrc
};
