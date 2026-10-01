# Audio en segundo plano

El caso de uso que más se repite en InteeBuild es una radio, un podcast o un streaming que siga sonando con la app minimizada y la pantalla apagada. Esta guía describe qué genera el proyecto para eso, cómo probarlo y qué hacer cuando el sonido se corta.

Hay dos caminos y conviene elegir uno:

- **Audio nativo (recomendado).** El HTML sólo tiene botones que llaman a `window.InteeAudio`; el stream lo reproduce `RadioService.java` con `MediaPlayer` y `MediaSession`. Lo que haga la WebView deja de importar.
- **Audio desde la WebView.** Tu página controla un `<audio>` convencional. Funciona, pero depende de que no pauses el elemento y de que el sistema no mate la página.

Las plantillas `radio`, `streaming` y `podcast` activan `nativeAudio`.

## Configuración mínima

En el estudio, tarjeta **Audio 100% nativo** (paso Ajustes): marca la reproducción nativa y pega la URL del stream. Por API:

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

Con `nativeAudio` y `streamUrl` rellenados, `normalizeConfig` fuerza `foreground` y `wakeLock`, así que no hace falta marcarlos a mano. Sin `streamUrl`, el readiness devuelve `canBuild: false` con el aviso `Audio nativo activo pero sin URL del stream`: sin URL no hay nada que suene en nativo, y ese bloqueo es deliberado.

## Qué aparece en el ZIP

Manifiesto (verificable en `main-manifest.xml`):

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

Archivos:

- `RadioService.java` — canal `inteebuild_radio` con `IMPORTANCE_LOW`, `startForeground(1, notificación)` y `onStartCommand` que devuelve `START_STICKY` para que el sistema lo reviva. Pide el stream con `MediaPlayer` y envía cabecera `Icy-MetaData: 0` para que Shoutcast no meta metadatos en el MP3.
- `AudioBridge.java` — expone `window.InteeAudio` con `play(url)` y `pause()`.
- `patch-main-activity.js` y `patch-audio.js` — inyectan el arranque del servicio y el puente en `MainActivity.java`.

En el log del workflow debe salir `--- servicio instalado ---` seguido de `1` y `--- audio nativo instalado ---` seguido de `1`. Si ves `0`, el patch no se aplicó: revisa `build-config.json` y `permissions.foreground`.

## Tu cara HTML


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

Si en vez de audio nativo usas un `<audio>` de la página, hay cuatro reglas que se incumplen casi siempre:

1. `src` en `https://`, salvo que hayas activado tráfico HTTP cleartext.
2. No llamar a `audio.pause()` en `visibilitychange`, `pagehide` ni `blur`.
3. El primer `play()` tiene que venir de un toque del usuario: el autoplay está bloqueado en la WebView.
4. Reconectar en `error`, `stalled` y `ended`. Los streams Shoutcast e Icecast se caen solos cada cierto tiempo y, sin reintento, el silencio parece un corte de la app.

Reconexión mínima:

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

## Prueba en dispositivo

1. Compila con la plantilla Radio y `streamUrl` rellenado. Antes de instalar, comprueba en el ZIP que `main-manifest.xml` contiene `RadioService` y `FOREGROUND_SERVICE_MEDIA_PLAYBACK`.
2. Abre la app: debe aparecer la notificación con botón Play. Si no hay notificación, el servicio no arrancó y no continúes con las demás pruebas.
3. Dale play y minimiza: el audio sigue.
4. Apaga la pantalla 30 segundos: el audio sigue (`WAKE_LOCK` más el `PARTIAL_WAKE_LOCK` del reproductor).
5. Comprueba que la notificación no se descarta (`setOngoing(true)`) y que sus botones y los de la pantalla de bloqueo controlan el stream.

## Si se corta igual

- **Se corta al apagar pantalla** — falta `WAKE_LOCK`, o el HTML pausa en `visibilitychange`.
- **No aparece notificación** — el servicio no arrancó. Revisa `servicio instalado: 1` en el log.
- **Se corta a los minutos con la notificación visible** — optimización de batería agresiva del fabricante. En Ajustes, Apps, tu app, Batería: sin restricciones y permitir actividad en segundo plano.
- **Se corta al minimizar sin notificación** — el build no lleva Foreground. Recompila con `foreground + wakeLock + notifications`.
- **Play rechaza el AAB** — casi siempre `ACCESS_BACKGROUND_LOCATION` sin justificación. Una radio no lo necesita.
- **`onPermissionRequest` concede todo** — parche antiguo con `grant-all`; regenera el proyecto.

## Errores de compilación relacionados

`androidx.media.app.NotificationCompat does not exist` aparece en ZIPs generados con una versión anterior del workflow. El servicio usa sólo clases del framework (`Notification.MediaStyle`, `MediaPlayer`, `MediaSession`) y no necesita dependencias androidx de medios: vuelve a compilar y verifica `--- audio nativo instalado ---` en el log.

Si `grep -c RadioService` da `0` en el proyecto generado, no instales ese APK: el servicio no está. Si `grep -c InteeAudio` da `0`, el puente JS no se inyectó y tus botones caerán al fallback web, que con pantalla apagada se corta.

## Antes de publicar

- Plantilla Radio aplicada y `streamUrl` con tu servidor en la tarjeta de audio nativo.
- `main-manifest.xml` con `FOREGROUND_SERVICE_MEDIA_PLAYBACK` y `RadioService`.
- `RadioService.java`, `AudioBridge.java`, `patch-audio.js` presentes en el ZIP.
- Audit con `foreground`, `wakeLock` y `notifications` en estado `GENERATED` y `verified: true`.
- Cara usando `window.InteeAudio.play(url)`.
- Stream en `https://` con certificado válido.
- Prueba de 30 segundos con pantalla apagada pasada en el dispositivo objetivo.

La parte de permisos relacionada está en [permissions.md](./permissions.md); si el build falla, [troubleshooting.md](./troubleshooting.md).
