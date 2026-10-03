# Background audio

The most repeated use case in InteeBuild is a radio, podcast or streaming that keeps playing with the app minimized and the screen off. This guide describes what the project generates for that, how to test it and what to do when the sound cuts out.

There are two paths and you should pick one:

- **Native audio (recommended).** The HTML only has buttons that call `window.InteeAudio`; the stream is played by `RadioService.java` with `MediaPlayer` and `MediaSession`. Whatever the WebView does stops mattering.
- **Audio from the WebView.** Your page controls a regular `<audio>` or `<video>`. With `foreground` enabled, the project injects a runtime into `catalog.js` that, when the page is hidden (app minimized or screen off), hands playback over to `RadioService` with the current position and hands it back to the WebView when you return. While the app is visible, your player stays in charge as always.

The `radio`, `streaming` and `podcast` templates enable `nativeAudio`.

## Minimal configuration

In the studio, the **Audio 100% native** card (Settings step): check native playback and paste the stream URL. Via the API:

```json
{
  "appName": "Mi Radio",
  "url": "https://mi-radio.com",
  "template": "radio",
  "permissions": { "foreground": true, "wakeLock": true, "notifications": true },
  "nativeAudio": true,
  "nativeAutoplay": true,
  "streamUrl": "https://tu-servidor.com:8000/stream"
}
```

With `nativeAudio` and `streamUrl` filled in, `normalizeConfig` forces `foreground` and `wakeLock`, so you don't need to check them by hand. Without `streamUrl`, readiness returns `canBuild: false` with the notice `Audio nativo activo pero sin URL del stream`: without a URL there's nothing to play natively, and that block is deliberate.

## What shows up in the ZIP

Manifest (verifiable in `main-manifest.xml`):

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<service android:name=".RadioService"
         android:exported="false"
         android:foregroundServiceType="dataSync|mediaPlayback" />
```

Files:

- `RadioService.java` — an `inteebuild_radio` channel with `IMPORTANCE_LOW`, `startForeground(1, notificación)` and an `onStartCommand` that returns `START_STICKY` so the system revives it. It requests the stream with `MediaPlayer` and sends the `Icy-MetaData: 0` header so Shoutcast doesn't inject metadata into the MP3. The `PARTIAL_WAKE_LOCK` and the `WifiLock` (`WIFI_MODE_FULL_HIGH_PERF`, so WiFi doesn't go into power saving with the screen off and the stream doesn't run out of buffer) are requested inside a `try/catch`: if the permission is missing, playback continues without locks instead of crashing the service, and they're released on pause or destroy. In `onCompletion` it only reconnects if the URL looks like a live stream; an MP3 ends and stops.
- `AudioBridge.java` — exposes `window.InteeAudio` with `play(url)`, `playAt(url, ms)`, `pause()`, `isPlaying()`, `isActive()` and `keepAwake(bool)`. It's generated with `foreground` even if you don't use native audio, because it's the destination of the handoff.
- `patch-main-activity.js` and `patch-audio.js` — inject the service startup and the bridge into `MainActivity.java`. `patch-audio.js` only touches `MainActivity extends BridgeActivity`; in the `native` provider the bridge already comes baked into the class, and in `gecko` the service startup also comes baked in via `gecko-MainActivity.java` but the bridge doesn't (see the limitation below).
- `www/catalog.js` — in addition to the catalog UI, it carries the handoff runtime (recognizable by `window.__ibFg`).

In the workflow log you should see `--- audio service installed ---` followed by `1` and `--- native audio installed ---`. If you see `0`, the patch wasn't applied: check `build-config.json` and `permissions.foreground`.

## Automatic handoff of the page's `<audio>`

With `foreground` checked, the runtime in `catalog.js` does this on every page (also on a remote URL, because the patch injects it in `onPageFinished`):

1. It listens to `play`, `pause` and `ended` on `<audio>` and `<video>` and notes the URL, position and whether it's playing.
2. When the page is hidden, if something was playing, it calls `InteeAudio.playAt(url, posición)` and pauses your element. The WebView freezes with the screen off, but the service's `MediaPlayer` keeps going with the wakelock and WifiLock held.
3. When you come back, if the service is still active (`isActive()`), it pauses the native player, returns the element to the estimated position and calls `play()`. If you stopped the audio from the notification controls, it doesn't resume it.

Limitations that remain yours:

- **Provider `gecko`: no `InteeAudio` bridge.** GeckoView doesn't expose `addJavascriptInterface`, so `AudioBridge` can't attach to the WebView. The `RadioService` service does compile and can start (the hook comes baked into `gecko-MainActivity.java`), but your HTML has no `window.InteeAudio`: the buttons fall back to the web `<audio>` and with the screen off the sound cuts out, because the handoff runtime in `catalog.js` detects there's no bridge and does nothing. For background radio with the screen off, use `capacitor`, `native` or `twa`.
- `blob:` URLs (hls.js, embedded YouTube, anything going through Media Source Extensions) can't be handed to the native side: with the screen off they cut out. Use a direct stream URL or native audio.
- Iframes aren't touched.
- If your HTML pauses on `visibilitychange`, remove that listener: the handoff and your pause will fight each other.

## Your HTML face


```html
<button onclick="nPlay()">Play</button>
<button onclick="nPause()">Pausa</button>
<script>
  const STREAM = 'https://tu-servidor.com:8000/stream';

  function nPlay() {
    if (window.InteeAudio) InteeAudio.play(STREAM);
    else {
      const a = document.createElement('audio');
      a.src = STREAM; a.play();
    }
  }
  function nPause() {
    if (window.InteeAudio) InteeAudio.pause();
  }
</script>
```

If instead of native audio you use the page's `<audio>`, there are four rules that are almost always broken:

1. `src` on `https://`, unless you've enabled cleartext HTTP traffic.
2. Don't call `audio.pause()` on `visibilitychange`, `pagehide` or `blur`.
3. The first `play()` has to come from a user tap: autoplay is blocked in the WebView.
4. Reconnect on `error`, `stalled` and `ended`. Shoutcast and Icecast streams drop on their own every so often and, without a retry, the silence looks like an app cutout.

Minimal reconnection:

```html
<script>
  const a = document.getElementById('player');
  let wantPlay = false;

  document.getElementById('play').onclick = () => {
    if (a.paused) { wantPlay = true; a.load(); a.play().catch(() => {}); }
    else { wantPlay = false; a.pause(); }
  };

  ['error', 'stalled', 'suspend'].forEach(ev => a.addEventListener(ev, () => {
    if (!wantPlay) return;
    setTimeout(() => { a.load(); a.play().catch(() => {}); }, 3000);
  }));

  a.addEventListener('ended', () => {
    if (!wantPlay) return;
    a.load(); a.play().catch(() => {});
  });

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
      wantPlay = true; a.load(); a.play().catch(() => {});
    });
    navigator.mediaSession.setActionHandler('pause', () => { wantPlay = false; a.pause(); });
  }
</script>
```

## Device test

1. Build with the Radio template and `streamUrl` filled in. Before installing, check in the ZIP that `main-manifest.xml` contains `RadioService` and `FOREGROUND_SERVICE_MEDIA_PLAYBACK`.
2. Open the app: the notification with a Play button should appear. If there's no notification, the service didn't start — don't continue with the other tests.
3. Hit play and minimize: the audio keeps going.
4. Turn the screen off for 30 seconds: the audio keeps going (`WAKE_LOCK` plus the player's `PARTIAL_WAKE_LOCK`).
5. Check that the notification can't be dismissed (`setOngoing(true)`) and that its buttons and the lock screen's control the stream.

## If it still cuts out

- **Cuts out when the screen turns off** — almost always a `blob:` URL (hls.js, YouTube) that the handoff can't give to the native side, or your HTML pauses on `visibilitychange`. With a direct URL and no pauses of your own, `WAKE_LOCK` already comes automatically with `foreground`.
- **Cuts out when returning from the background and doesn't restart on its own** — the element was left paused by the system; hit play. If you stopped it yourself from the notification, that's the expected behavior.
- **No notification appears** — the service didn't start. Check for `servicio instalado: 1` in the log.
- **Cuts out after a few minutes with the notification visible** — aggressive battery optimization from the manufacturer. In Settings, Apps, your app, Battery: no restrictions and allow background activity.
- **Cuts out when minimizing with no notification** — the build doesn't include Foreground. Rebuild with `foreground + wakeLock + notifications`.
- **Play rejects the AAB** — almost always `ACCESS_BACKGROUND_LOCATION` without justification. A radio doesn't need it.
- **`onPermissionRequest` grants everything** — an old patch with `grant-all`; regenerate the project.

## Related build errors

`androidx.media.app.NotificationCompat does not exist` shows up in ZIPs generated with an earlier version of the workflow. The service uses only framework classes (`Notification.MediaStyle`, `MediaPlayer`, `MediaSession`) and doesn't need androidx media dependencies: rebuild and verify `--- audio nativo instalado ---` in the log.

If `grep -c RadioService` returns `0` in the generated project, don't install that APK: the service isn't there. If `grep -c InteeAudio` returns `0`, the JS bridge wasn't injected and your buttons will fall back to the web fallback, which cuts out with the screen off. The only expected exception is the `gecko` provider, where `InteeAudio` can't exist (GeckoView doesn't allow it); in that case the count is `0` on purpose and the handoff won't work.

## Before publishing

- Radio template applied and `streamUrl` with your server on the native audio card.
- `main-manifest.xml` with `FOREGROUND_SERVICE_MEDIA_PLAYBACK` and `RadioService`.
- `RadioService.java`, `AudioBridge.java`, `patch-audio.js` present in the ZIP.
- Audit with `foreground`, `wakeLock` and `notifications` in state `GENERATED` and `verified: true`.
- Face using `window.InteeAudio.play(url)`.
- Stream on `https://` with a valid certificate.
- 30-second screen-off test passed on the target device.

The related permissions part is in [permissions.md](./permissions.md); if the build fails, [troubleshooting.md](./troubleshooting.md).
