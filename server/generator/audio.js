'use strict';

function escJava(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}

// Audio 100% nativo: MediaPlayer en foreground service + MediaSession.
// El HTML es solo la cara: llama window.InteeAudio.play(url)/pause().
// Sin dependencias extra (sin ExoPlayer): a Shoutcast se le pide Icy-MetaData:0
// para recibir mp3 limpio que MediaPlayer reproduce sin cortes.
// Mejorado con manejo de errores, reconexión automática y mejor gestión de recursos.

function nativeAudioServiceSrc(pkg, streamUrl, autoplay, appName) {
  const URL = escJava(streamUrl);
  return 'package ' + pkg + ';\n'
    + '\n'
    + 'import android.app.Notification;\n'
    + 'import android.app.NotificationChannel;\n'
    + 'import android.app.NotificationManager;\n'
    + 'import android.app.PendingIntent;\n'
    + 'import android.app.Service;\n'
    + 'import android.content.Context;\n'
    + 'import android.content.Intent;\n'
    + 'import android.media.AudioAttributes;\n'
    + 'import android.media.MediaPlayer;\n'
    + 'import android.media.session.MediaSession;\n'
    + 'import android.media.session.PlaybackState;\n'
    + 'import android.net.Uri;\n'
    + 'import android.os.Build;\n'
    + 'import android.os.IBinder;\n'
    + 'import android.os.PowerManager;\n'
    + 'import android.util.Log;\n'
    + 'import java.util.Collections;\n'
    + '\n'
    + 'public class RadioService extends Service {\n'
    + '    private static final String TAG = "InteeRadio";\n'
    + '    private static final String CHANNEL_ID = "inteebuild_radio";\n'
    + '    private static final int NOTIF_ID = 1;\n'
    + '    public static final String ACTION_PLAY = "' + pkg + '.ACTION_PLAY";\n'
    + '    public static final String ACTION_PAUSE = "' + pkg + '.ACTION_PAUSE";\n'
    + '    private static final String STREAM_URL = "' + URL + '";\n'
    + '    private static final boolean AUTOPLAY = ' + (autoplay ? 'true' : 'false') + ';\n'
    + '    private static RadioService instance;\n'
    + '    private MediaPlayer mp;\n'
    + '    private MediaSession session;\n'
    + '    private PowerManager.WakeLock wakeLock;\n'
    + '    private String currentUrl = STREAM_URL;\n'
    + '    private boolean wantPlay = false;\n'
    + '    private boolean isPrepared = false;\n'
    + '\n'
    + '    public static void play(Context ctx, String url) {\n'
    + '        Intent i = new Intent(ctx, RadioService.class);\n'
    + '        i.setAction(ACTION_PLAY);\n'
    + '        if (url != null && !url.isEmpty()) i.putExtra("url", url);\n'
    + '        try { if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i); else ctx.startService(i); } catch (Exception ignored) { Log.e(TAG, "Error starting service", ignored); }\n'
    + '    }\n'
    + '\n'
    + '    public static void pause(Context ctx) {\n'
    + '        if (instance != null) instance.doPause();\n'
    + '        else { Intent i = new Intent(ctx, RadioService.class); i.setAction(ACTION_PAUSE); try { ctx.startService(i); } catch (Exception ignored) { Log.e(TAG, "Error pausing service", ignored); } }\n'
    + '    }\n'
    + '\n'
    + '    public static boolean isPlaying() {\n'
    + '        try { return instance != null && instance.mp != null && instance.mp.isPlaying(); }\n'
    + '        catch (Exception e) { return false; }\n'
    + '    }\n'
    + '\n'
    + '    @Override\n'
    + '    public void onCreate() {\n'
    + '        super.onCreate();\n'
    + '        instance = this;\n'
    + '        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);\n'
    + '        if (pm != null) {\n'
    + '            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, TAG + ":Audio");\n'
    + '            wakeLock.setReferenceCounted(false);\n'
    + '        }\n'
    + '        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);\n'
    + '        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {\n'
    + '            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Reproduccion en segundo plano", NotificationManager.IMPORTANCE_LOW);\n'
    + '            ch.setDescription("Control de reproduccion de audio");\n'
    + '            nm.createNotificationChannel(ch);\n'
    + '        }\n'
    + '        try {\n'
    + '            session = new MediaSession(this, "InteeBuildSession");\n'
    + '            session.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);\n'
    + '            session.setCallback(new MediaSession.Callback() {\n'
    + '                @Override public void onPlay() { doPlay(currentUrl); }\n'
    + '                @Override public void onPause() { doPause(); }\n'
    + '                @Override public void onStop() { doPause(); }\n'
    + '            });\n'
    + '            session.setActive(true);\n'
    + '        } catch (Exception e) { Log.e(TAG, "MediaSession error", e); }\n'
    + '        startForeground(NOTIF_ID, buildNotif(false));\n'
    + '        if (AUTOPLAY && STREAM_URL.length() > 0) doPlay(STREAM_URL);\n'
    + '    }\n'
    + '\n'
    + '    @Override\n'
    + '    public int onStartCommand(Intent intent, int flags, int startId) {\n'
    + '        String action = intent != null ? intent.getAction() : null;\n'
    + '        if (ACTION_PAUSE.equals(action)) { doPause(); }\n'
    + '        else {\n'
    + '            String u = intent != null ? intent.getStringExtra("url") : null;\n'
    + '            if (u == null || u.isEmpty()) u = currentUrl;\n'
    + '            if (ACTION_PLAY.equals(action) || AUTOPLAY) doPlay(u); else doPlay(u);\n'
    + '        }\n'
    + '        return START_STICKY;\n'
    + '    }\n'
    + '\n'
    + '    private synchronized void doPlay(String url) {\n'
    + '        if (url == null || url.isEmpty()) url = STREAM_URL;\n'
    + '        if (url.isEmpty()) return;\n'
    + '        currentUrl = url;\n'
    + '        wantPlay = true;\n'
    + '        if (wakeLock != null && !wakeLock.isHeld()) {\n'
    + '            try { wakeLock.acquire(10*60*1000L); } catch (Exception e) { Log.e(TAG, "WakeLock error", e); }\n'
    + '        }\n'
    + '        try {\n'
    + '            if (mp != null) { try { mp.reset(); } catch (Exception ignored) {} }\n'
    + '            else {\n'
    + '                mp = new MediaPlayer();\n'
    + '                mp.setWakeMode(getApplicationContext(), PowerManager.PARTIAL_WAKE_LOCK);\n'
    + '                if (Build.VERSION.SDK_INT >= 21) mp.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());\n'
    + '                mp.setOnPreparedListener(new MediaPlayer.OnPreparedListener() { public void onPrepared(MediaPlayer p) { p.start(); updateState(true); } });\n'
    + '                mp.setOnCompletionListener(new MediaPlayer.OnCompletionListener() { public void onCompletion(MediaPlayer p) { if (wantPlay) { try { p.reset(); connectAndPrepare(currentUrl); } catch (Exception ignored) {} } } });\n'
    + '                mp.setOnErrorListener(new MediaPlayer.OnErrorListener() { public boolean onError(MediaPlayer p, int what, int extra) { if (wantPlay) { try { p.reset(); connectAndPrepare(currentUrl); } catch (Exception ignored) {} return true; } return false; } });\n'
    + '            }\n'
    + '            connectAndPrepare(url);\n'
    + '        } catch (Exception ignored) {}\n'
    + '    }\n'
    + '\n'
    + '    private void connectAndPrepare(String url) throws Exception {\n'
    + '        mp.setDataSource(getApplicationContext(), Uri.parse(url), Collections.singletonMap("Icy-MetaData", "0"));\n'
    + '        mp.prepareAsync();\n'
    + '        updateState(false);\n'
    + '    }\n'
    + '\n'
    + '    private synchronized void doPause() {\n'
    + '        wantPlay = false;\n'
    + '        try { if (mp != null && mp.isPlaying()) mp.pause(); } catch (Exception ignored) {}\n'
    + '        updateState(false);\n'
    + '    }\n'
    + '\n'
    + '    private void updateState(boolean playing) {\n'
    + '        try {\n'
    + '            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);\n'
    + '            nm.notify(NOTIF_ID, buildNotif(playing));\n'
    + '            if (session != null) {\n'
    + '                PlaybackState st = new PlaybackState.Builder().setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE).setState(playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, 0, 1.0f).build();\n'
    + '                session.setPlaybackState(st);\n'
    + '            }\n'
    + '        } catch (Exception ignored) {}\n'
    + '    }\n'
    + '\n'
    + '    private Notification buildNotif(boolean playing) {\n'
    + '        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());\n'
    + '        PendingIntent content = launch != null ? PendingIntent.getActivity(this, 0, launch, pendingFlags()) : null;\n'
    + '        Intent togel = new Intent(this, RadioService.class);\n'
    + '        togel.setAction(playing ? ACTION_PAUSE : ACTION_PLAY);\n'
    + '        PendingIntent act = PendingIntent.getService(this, 1, togel, pendingFlags());\n'
    + '        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL_ID) : new Notification.Builder(this);\n'
    + '        b.setContentTitle(' + javaString(appName) + ')\n'
    + '                .setContentText(playing ? "Transmitiendo en directo" : "Toca play en la app")\n'
    + '                .setSmallIcon(android.R.drawable.ic_media_play)\n'
    + '                .setOngoing(true)\n'
    + '                .setOnlyAlertOnce(true)\n'
    + '                .addAction(playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, playing ? "Pausar" : "Play", act);\n'
    + '        if (content != null) b.setContentIntent(content);\n'
    + '        try { if (session != null && Build.VERSION.SDK_INT >= 21) b.setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0)); } catch (Exception ignored) {}\n'
    + '        try { return b.build(); } catch (Exception e) { return new Notification(); }\n'
    + '    }\n'
    + '\n'
    + '    private int pendingFlags() {\n'
    + '        return Build.VERSION.SDK_INT >= 23 ? (PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE) : PendingIntent.FLAG_UPDATE_CURRENT;\n'
    + '    }\n'
    + '\n'
    + '    @Override\n'
    + '    public void onDestroy() {\n'
    + '        wantPlay = false;\n'
    + '        try { if (session != null) { session.setActive(false); session.release(); } } catch (Exception ignored) {}\n'
    + '        try { if (mp != null) { mp.release(); mp = null; } } catch (Exception ignored) {}\n'
    + '        instance = null;\n'
    + '        super.onDestroy();\n'
    + '    }\n'
    + '\n'
    + '    @Override\n'
    + '    public IBinder onBind(Intent intent) {\n'
    + '        return null;\n'
    + '    }\n'
    + '}\n';
}

// Puente JS: window.InteeAudio.play(url) / .pause() / .isPlaying()

function audioBridgeSrc(pkg) {
  return 'package ' + pkg + ';\n'
    + '\n'
    + 'import android.content.Context;\n'
    + 'import android.os.Handler;\n'
    + 'import android.os.Looper;\n'
    + 'import android.webkit.JavascriptInterface;\n'
    + 'import android.widget.Toast;\n'
    + '\n'
    + 'public class AudioBridge {\n'
    + '    private final Context ctx;\n'
    + '    private final Handler ui = new Handler(Looper.getMainLooper());\n'
    + '    public AudioBridge(Context ctx) { this.ctx = ctx.getApplicationContext(); }\n'
    + '    private void toast(final String msg) {\n'
    + '        try { ui.post(new Runnable() { public void run() { try { Toast.makeText(ctx, msg, Toast.LENGTH_SHORT).show(); } catch (Exception ignored) {} } }); } catch (Exception ignored) {}\n'
    + '    }\n'
    + '    @JavascriptInterface public void play(String url) { toast("Audio nativo: reproduciendo"); RadioService.play(ctx, url); }\n'
    + '    @JavascriptInterface public void pause() { toast("Audio nativo: en pausa"); RadioService.pause(ctx); }\n'
    + '    @JavascriptInterface public boolean isPlaying() { return RadioService.isPlaying(); }\n'
    + '}\n';
}


function javaString(s) {
  return '"' + String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}


function radioServiceSrc(pkg) {
  return 'package ' + pkg + ';\n'
    + '\n'
    + 'import android.app.Notification;\n'
    + 'import android.app.NotificationChannel;\n'
    + 'import android.app.NotificationManager;\n'
    + 'import android.app.Service;\n'
    + 'import android.content.Intent;\n'
    + 'import android.os.Build;\n'
    + 'import android.os.IBinder;\n'
    + 'import androidx.core.app.NotificationCompat;\n'
    + '\n'
    + 'public class RadioService extends Service {\n'
    + '    private static final String CHANNEL_ID = "inteebuild_radio";\n'
    + '\n'
    + '    @Override\n'
    + '    public void onCreate() {\n'
    + '        super.onCreate();\n'
    + '        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);\n'
    + '        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {\n'
    + '            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Reproduccion en segundo plano", NotificationManager.IMPORTANCE_LOW);\n'
    + '            nm.createNotificationChannel(ch);\n'
    + '        }\n'
    + '        Notification n = new NotificationCompat.Builder(this, CHANNEL_ID)\n'
    + '                .setContentTitle(getString(getApplicationInfo().labelRes))\n'
    + '                .setContentText("Reproduciendo en segundo plano")\n'
    + '                .setSmallIcon(android.R.drawable.ic_media_play)\n'
    + '                .setOngoing(true)\n'
    + '                .build();\n'
    + '        startForeground(1, n);\n'
    + '    }\n'
    + '\n'
    + '    @Override\n'
    + '    public int onStartCommand(Intent intent, int flags, int startId) {\n'
    + '        return START_STICKY;\n'
    + '    }\n'
    + '\n'
    + '    @Override\n'
    + '    public IBinder onBind(Intent intent) {\n'
    + '        return null;\n'
    + '    }\n'
    + '}\n';
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


function notifyScriptSrc(cfg) {
  return '(function(){'
    + 'var TITLE=' + JSON.stringify(cfg.notifyTitle) + ';'
    + 'var TEXT=' + JSON.stringify(cfg.notifyText || cfg.appName) + ';'
    + 'var ON_OPEN=' + (cfg.notifyOnOpen ? 'true' : 'false') + ';'
    + 'var ON_CLOSE=' + (cfg.notifyOnClose ? 'true' : 'false') + ';'
    + 'var DELAY_MIN=' + cfg.notifyDelayMinutes + ';'
    + 'function cap(){return (window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.LocalNotifications)||null;}'
    + 'async function ensure(){var LN=cap();if(!LN)return null;try{var st=await LN.checkPermissions();if(st.display!=="granted"){await LN.requestPermissions();}}catch(e){}return LN;}'
    + 'async function fire(id){var LN=await ensure();if(!LN)return;try{await LN.schedule({notifications:[{id:id,title:TITLE,body:TEXT,schedule:{at:new Date(Date.now()+2000)}}]});}catch(e){}}'
    + 'if(ON_OPEN){window.addEventListener("load",function(){fire(101);});}'
    + 'if(ON_CLOSE){document.addEventListener("visibilitychange",function(){if(document.hidden){fire(102);}});window.addEventListener("pagehide",function(){fire(102);});}'
    + 'if(DELAY_MIN>0){setTimeout(function(){fire(103);},DELAY_MIN*60000);}'
    + '})();';
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
  ].join(NL)+NL;
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
