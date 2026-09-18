# Plantilla Foreground — audio en segundo plano que sí funciona

Esta es la plantilla que más importa en InteeBuild: radio / podcast / streaming que sigue sonando con la app minimizada o la pantalla apagada.

## Qué genera InteeBuild cuando activas Foreground

Marca en el Studio: `Servicio Foreground` + `Pantalla Encendida (WAKE_LOCK)` + `Notificaciones`.

`POST /api/project` o `POST /api/build` con:

```json
{
  "appName": "Mi Radio",
  "url": "https://mi-radio.com",
  "permissions": { "foreground": true, "wakeLock": true, "notifications": true }
}
```

### 1. AndroidManifest.xml (verificable)

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<service android:name=".RadioService" android:exported="false" android:foregroundServiceType="dataSync|mediaPlayback" />
```

Compruébalo en el ZIP: `main-manifest.xml` debe contener `RadioService` y `FOREGROUND_SERVICE_MEDIA_PLAYBACK`. Si no está, el audit marca `fail` y el build se bloquea.

### 2. RadioService.java (verificable)

Archivo `RadioService.java` en el ZIP, paquete = tu `packageName`:

- Crea canal `inteebuild_radio` (IMPORTANCE_LOW).
- `startForeground(1, notificación)` con icono `ic_media_play`.
- `onStartCommand → START_STICKY` (el sistema lo revive).

### 3. MainActivity patch (verificable)

`patch-main-activity.js` inyecta en `MainActivity.java`:

```java
startForegroundService(new Intent(this, RadioService.class));
```

En el log del workflow debes ver:

```
--- servicio instalado ---
1
```

Si ves `0`, el patch no se aplicó: revisa `build-config.json → permissions.foreground: true`.

## Tu HTML debe cumplir esto (si no, el audio se corta igual)

El servicio nativo mantiene el proceso vivo, pero el `<audio>` lo controla tu página:

```html
<audio id="player" src="https://mi-radio.com/stream.mp3" preload="none"></audio>
<script>
  const a = document.getElementById('player');
  // NO pausar en visibilitychange / pagehide
  document.addEventListener('visibilitychange', () => {
    // intencionalmente vacío: el audio sigue
  });
  // Play debe venir de un gesto del usuario (autoplay bloqueado en WebView)
  document.getElementById('play').onclick = () => a.play();
</script>
```

Reglas:

1. `src` en `https://` (no `http://` si `useCleartext` es false).
2. No llames `audio.pause()` en `visibilitychange`, `pagehide` ni `blur`.
3. El primer `play()` siempre desde un tap/click.
4. Si usas HLS (`.m3u8`), verifica que tu servidor envíe CORS correcto.

## Prueba real HTML → APK mínimo → Foreground

### Paso 1: APK mínimo (sin permisos)

```json
{ "appName": "Minima", "inputType": "html", "htmlCode": "<!DOCTYPE html><html><body><h1>Hola</h1></body></html>" }
```

Esperado en ZIP:

- `main-manifest.xml` solo `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`.
- Sin `NativePermissions.java`, sin `RadioService.java`.
- Audit: `total 0, readiness 100`.

Instala, abre, cierra: no debe pedir ningún permiso. Si pide algo, el Engine está metiendo de más.

### Paso 2: APK Foreground

Activa la plantilla Radio (o el JSON de arriba). Esperado:

- Manifest con las 6 líneas de arriba + `RadioService`.
- `RadioService.java` + `patch-main-activity.js` en el ZIP.
- Audit: `foreground ok (GENERATED)`, `wakeLock ok`, `notifications ok`.
- Readiness ≥ 90%.

Instala en Android real:

1. Abre la app → debe aparecer notificación persistente "Reproduciendo en segundo plano".
2. Dale play → minimiza → el audio sigue.
3. Apaga pantalla 30s → el audio sigue (WAKE_LOCK).
4. Desliza la notificación → no se puede descartar (`setOngoing(true)`).

### Paso 3: Build log (qué buscar)

En GitHub Actions → job `compile`:

```
--- permisos aplicados ---
android:name="android.permission.FOREGROUND_SERVICE"
--- permisos nativos instalados ---
--- catalog patches aplicados ---
--- servicio instalado ---
1
manifest XML OK
```

Si `grep -c RadioService` da `0`, el servicio no se inyectó: no instales ese APK, revisa `packageName` y `build-config.json`.

## Errores típicos

| Síntoma | Causa | Fix |
|---|---|---|
| El audio se corta al apagar pantalla | Falta `WAKE_LOCK` o el HTML pausa en `visibilitychange` | Marca Wake Lock y quita `pause()` |
| No aparece notificación | `RadioService` no arrancó | Revisa log `servicio instalado`, debe ser `1` |
| Play rechaza el AAB | `ACCESS_BACKGROUND_LOCATION` sin justificación | No marques ubicación en segundo plano para una radio |
| `onPermissionRequest` concede todo | Patch viejo (grant-all) | Regenera: el patch actual usa `wants()+hasPerm()` y `deny()` por defecto |

## Checklist antes de publicar una radio

- [ ] Manifest tiene `FOREGROUND_SERVICE_MEDIA_PLAYBACK` y `RadioService`
- [ ] ZIP trae `RadioService.java`
- [ ] Audit `foreground/nofitications/wakeLock` en `ok` y `verified: true`
- [ ] HTML no pausa en `visibilitychange`
- [ ] Stream en `https://`
- [ ] Probado minimizado + pantalla apagada 30s
