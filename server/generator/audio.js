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
    private static final String STREAM_URL = "${safeUrl}";
    private static final boolean AUTOPLAY = ${autoplay ? 'true' : 'false'};
    private static RadioService instance;
    private MediaPlayer mp;
    private MediaSession session;
    private PowerManager.WakeLock wakeLock;
    private String currentUrl = STREAM_URL;
    private boolean wantPlay = false;
    private boolean isPrepared = false;

    public static void play(Context ctx, String url) {
        Intent i = new Intent(ctx, RadioService.class);
        i.setAction(ACTION_PLAY);
        if (url != null && !url.isEmpty()) i.putExtra("url", url);
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

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, TAG + ":Audio");
            wakeLock.setReferenceCounted(false);
        }
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
        else {
            String u = intent != null ? intent.getStringExtra("url") : null;
            if (u == null || u.isEmpty()) u = currentUrl;
            if (ACTION_PLAY.equals(action) || AUTOPLAY) doPlay(u); else doPlay(u);
        }
        return START_STICKY;
    }

    private synchronized void doPlay(String url) {
        if (url == null || url.isEmpty()) url = STREAM_URL;
        if (url.isEmpty()) return;
        currentUrl = url;
        wantPlay = true;
        if (wakeLock != null && !wakeLock.isHeld()) {
            try { wakeLock.acquire(10*60*1000L); } catch (Exception e) { Log.e(TAG, "WakeLock error", e); }
        }
        try {
            if (mp != null) { try { mp.reset(); } catch (Exception ignored) {} }
            else {
                mp = new MediaPlayer();
                mp.setWakeMode(getApplicationContext(), PowerManager.PARTIAL_WAKE_LOCK);
                if (Build.VERSION.SDK_INT >= 21) mp.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
                mp.setOnPreparedListener(new MediaPlayer.OnPreparedListener() { public void onPrepared(MediaPlayer p) { p.start(); updateState(true); } });
                mp.setOnCompletionListener(new MediaPlayer.OnCompletionListener() { public void onCompletion(MediaPlayer p) { if (wantPlay) { try { p.reset(); connectAndPrepare(currentUrl); } catch (Exception ignored) {} } } });
                mp.setOnErrorListener(new MediaPlayer.OnErrorListener() { public boolean onError(MediaPlayer p, int what, int extra) { if (wantPlay) { try { p.reset(); connectAndPrepare(currentUrl); } catch (Exception ignored) {} return true; } return false; } });
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
                .setContentText(playing ? "Transmitiendo en directo" : "Toca play en la app")
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
    @JavascriptInterface public void pause() { toast("Audio nativo: en pausa"); RadioService.pause(ctx); }
    @JavascriptInterface public boolean isPlaying() { return RadioService.isPlaying(); }
}
`;
}





function radioServiceSrc(pkg) {
  return `package ${pkg};

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;

public class RadioService extends Service {
    private static final String CHANNEL_ID = "inteebuild_radio";

    @Override
    public void onCreate() {
        super.onCreate();
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Reproduccion en segundo plano", NotificationManager.IMPORTANCE_LOW);
            nm.createNotificationChannel(ch);
        }
        Notification n = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(getString(getApplicationInfo().labelRes))
                .setContentText("Reproduciendo en segundo plano")
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setOngoing(true)
                .build();
        startForeground(1, n);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
`;
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
    "  src = src.replace(/public class MainActivity extends BridgeActivity\\s*\\{/, function (m) {",
    "    return m + NL + '  @Override' + NL + '  public void onCreate(Bundle savedInstanceState) {' + NL + '    super.onCreate(savedInstanceState);' + NL + '    try { if (Build.VERSION.SDK_INT >= 26) startForegroundService(new Intent(this, RadioService.class)); else startService(new Intent(this, RadioService.class)); } catch (Exception ignored) {}' + NL + '  }' + NL;",
    "  });",
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
    "if(src.indexOf('InteeAudio')===-1){",
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
  radioServiceSrc,
  mainActivityPatchSrc,
  notifyScriptSrc,
  patchAudioSrc
};
