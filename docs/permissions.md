# Permisos Android

El Permission Engine vive en `server/generator/permissions.js` y define **86 entradas** en `PERMISSION_SPEC`, cada una con su permiso de manifiesto, si necesita diálogo runtime, su `minSdk`, sus dependencias y la implementación nativa que se genera. El mismo objeto alimenta tres cosas: los switches del estudio, el `GET /api/permissions/spec` y el Audit. Si mañana se añade una entrada al spec, aparece sola en la UI.

La regla que sostiene todo el sistema es que declarar un permiso no es lo mismo que que Android lo conceda. Por eso el Audit mira el ZIP que se va a compilar y no la configuración:

1. **Manifiesto** — `main-manifest.xml` contiene la línea `uses-permission`.
2. **Runtime** — `NativePermissions.java` y su patch en `MainActivity.java` llaman a `requestPermissions()` con ese lote.
3. **Puente WebView** — `WebChromeClient.onPermissionRequest` sólo hace `grant()` si el permiso está en el manifiesto y además fue concedido; si no, `deny()`.

Sólo el primer nivel es automático de verdad. Que el diálogo aparezca y que tu web reaccione bien se comprueba en un dispositivo Android real.

## Cómo leer el Audit

`POST /api/permissions/audit` (o el botón de QA en el estudio) devuelve una fila por permiso marcado:

- `GENERATED OK` — está en el manifiesto y tiene implementación generada. Es el único estado que sirve para compilar.
- `SPEC ONLY, NOT GENERATED` — lo pediste pero no se generó. El Audit lo marca `fail` y bloquea el build.
- `NO GENERADO` — reservado para `ads`: hoy sólo se emite la configuración y el `meta-data` de AdMob, no hay `AdView` ni inicialización.
- `warn` — compila, pero algo hay que revisar: permiso especial de Settings, `minSdk` por encima del `targetSdk`, o provider experimental.
- `fail` — bloquea. `gpsBackground` sin `gps` es el caso típico.

Cada fila trae un `mechanism`: `runtime` (diálogo normal), `background` (two-step), `special` (se concede desde Ajustes), `install-time` (se concede al instalar) o `missing`.

Los niveles de verdad son tres y conviene no confundirlos: el Audit prueba que el proyecto *contiene* el permiso; que Android lo *conceda* sólo se ve en el dispositivo; y que la función *sirva* sólo se ve probando la función. Para la matriz por versión de Android está la plantilla `lab` (Permission Test Lab), que ejecuta cada prueba desde la propia app.

## Siempre incluidos

`INTERNET`, `ACCESS_NETWORK_STATE` y `ACCESS_WIFI_STATE` se declaran en todos los proyectos (entrada `internet` del spec). Sin ellos la web no carga y la app se queda en blanco. No aparecen en el Audit porque no se eligen.

## Notificaciones — `notifications`

Sólo se activan en Android 13+ (`minSdk` de la entrada: 33); por debajo el permiso no existía y el sistema no pregunta nada. Lo que se genera: `POST_NOTIFICATIONS` en el manifiesto, los plugins `@capacitor/local-notifications` y `@capacitor/push-notifications` en `package.json` (el estudio los activa solo al marcar la casilla) y el puente `Intee.notifications.schedule({title, body})`. Si activas el aviso programado de Ajustes sin marcar este permiso, el manifiesto lo añade igualmente.

La prueba es directa: compila con sólo esta opción, instala en Android 13+, acepta el diálogo y programa un aviso con `notifyOnOpen`. Con `targetSdk < 33` el Audit devuelve `warn`.

## Audio en segundo plano — `foreground`, `wakeLock`, `foregroundService`

Son tres entradas del spec con el mismo objetivo desde ángulos distintos: mantener el proceso vivo mientras suena audio. `foreground` añade `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` y `WAKE_LOCK` (sin él el `PARTIAL_WAKE_LOCK` lanza `SecurityException` y el servicio se cae), y es el único de los tres que genera `RadioService.java`, `AudioBridge.java` y el patch de `MainActivity` que lo arranca al abrir. `foregroundService` declara las tres líneas de servicio sin `WAKE_LOCK`, pero no genera servicio alguno: aporta el permiso y nada más. `wakeLock` añade sólo `WAKE_LOCK`, sin diálogo. Si activas audio nativo con URL de stream, el motor marca solo `foreground` y `wakeLock`, porque sin proceso vivo y con la pantalla apagada el sonido se corta. El spec advierte que Play pide justificación si el servicio no es de audio o sincronización.

En detalle, con el HTML que lo usa, está todo en [foreground.md](./foreground.md).

## Cámara y micrófono — `cameraMic`, `microphone`

Están separados a propósito: Play audita el micrófono por separado de la cámara, y una app que sólo graba vídeo no debería pedir `RECORD_AUDIO`.

- `cameraMic` genera `CAMERA`, `NativePermissions.request(CAMERA)` y `@capacitor/camera`.
- `microphone` genera `RECORD_AUDIO` y `MODIFY_AUDIO_SETTINGS`.

El puente WebView comprueba `wants(VIDEO)` contra el manifiesto y `hasPerm(CAMERA)` contra la concesión antes de hacer `grant()`. Si no marcaste cámara, `getUserMedia({video:true})` devuelve `denied` desde la app: es el comportamiento esperado, no un bug.

Los splits finos del grupo son `cameraFlash`, `cameraAutoFocus`, `videoCapture` y `audioRecord`; comparten permiso de manifiesto pero se declaran por separado para que el Audit pueda rastrear qué pediste.

## Almacenamiento — `storage`, `readExternalStorage`, `writeExternalStorage`, `manageExternalStorage`

Con `targetSdk` 33 o superior, `storage` genera `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` y `READ_MEDIA_AUDIO` y omite `READ_EXTERNAL_STORAGE` para no levantar avisos en Play. Con `targetSdk` por debajo, cae al permiso legacy. `manageExternalStorage` (`MANAGE_EXTERNAL_STORAGE`, API 30+) es el de "todos los archivos" y va por Settings, no por diálogo.

La prueba: un `<input type="file" accept="image/*">` debe abrir la galería, y una descarga desde tu web debe aparecer en el gestor de descargas.

## Ubicación — `gps`, `gpsBackground` y los splits

`gps` declara `ACCESS_FINE_LOCATION` y `ACCESS_COARSE_LOCATION` sin tocar el segundo plano. `gpsBackground` declara `ACCESS_BACKGROUND_LOCATION` y es una entrada aparte deliberadamente: en Android 11+ el sistema ignora la petición de background si va en el mismo lote que el foreground, así que el runtime la pide en dos pasos (`requestBackground()` después de conceder el foreground).

El Audit devuelve `fail` si marcas background sin foreground. Play exige además justificación con vídeo demostrando rastreo con la app cerrada; para tiendas, blogs y radios no se marca nunca.

Los splits `accessFineLocation`, `accessCoarseLocation` y `accessBackgroundLocation` existen para quien quiere el nivel de detalle máximo, y `advGeo` añade tracking con `FusedLocationProvider` y geofencing (requiere justificación en Play).

## Bluetooth — `bluetoothScan`, `bluetoothConnect`, `bluetoothAdvertise`, `bluetooth`

En Android 12+ son tres permisos distintos y el estudio los presenta como tres switches: escanear (`BLUETOOTH_SCAN`), conectar (`BLUETOOTH_CONNECT`) y anunciar (`BLUETOOTH_ADVERTISE`), todos con `minSdk` 31.

`bluetooth` es la entrada legacy (`BLUETOOTH` + `BLUETOOTH_ADMIN`) válida hasta API 30. Si la marcas con `targetSdk` 31 o superior, `normalizeConfig` activa `bluetoothScan` y `bluetoothConnect` automáticamente en lugar de dejar un permiso muerto. `bluetoothPrivileged` es de apps del sistema y no sirve en una app normal.

## Alarmas exactas — elige una

Hay cinco entradas para dos permisos reales, y sólo una debe estar marcada a la vez:

- `alarmSchedule` → `SCHEDULE_EXACT_ALARM`. Es la recomendada: el usuario puede revocarla desde Ajustes.
- `alarmUse` → `USE_EXACT_ALARM`, sólo para reloj, alarma o calendario. Play lo revisa manualmente.
- `scheduleExactAlarm` y `useExactAlarm` son los splits de esas mismas dos.
- `alarm` es el selector legacy; `normalizeConfig` lo convierte en `scheduleExactAlarm`.

El Audit los resuelve a `special` (van por Settings) y el sistema `SpecialAccess.java` se genera sólo si marcaste alguno.

## Teléfono y SMS — permisos restringidos en Play

`phone` agrupa `CALL_PHONE`, `READ_PHONE_STATE` y `READ_CALL_LOG`; `sms` agrupa `SEND_SMS` y `READ_SMS`. Los splits son `callPhone`, `answerPhone`, `readPhoneState`, `readPhoneNumber`, `readCallLog`, `processOutgoingCalls`, `sendSms`, `readSms`, `receiveSms` y `receiveMms`.

Todos llevan la advertencia `Play Store restringido` en el spec. Compilan sin problema, pero Play sólo los acepta en apps cuya categoría es marcador o mensajería. Si tu app no es de esas, no los marques.

## Contactos, calendario y sensores

`contacts` y `calendar` son los paquetes de lectura+escritura; sus splits son `readContacts`, `writeContacts`, `readCalendar` y `writeCalendar`.

`sensors` cubre `BODY_SENSORS` y `HIGH_SAMPLING_RATE_SENSORS`; los splits son `bodySensors` (runtime) y `highSamplingRateSensors` (install-time, API 31+). `activityRecognition` necesita API 29+ y `envSensors` (Droncito) añade acelerómetro, giroscopio, barómetro, luz y proximidad con permisos de API 29.

## Red, cuentas y WiFi

`nearby` y `nearbyWifiDevices` son la misma llave (`NEARBY_WIFI_DEVICES`, API 33) vista desde dos selectores. `changeWifiState` y `changeNetworkState` se conceden al instalar. `getAccounts` (`GET_ACCOUNTS`) está marcado como restringido en Play.

## Accesos especiales (no son un diálogo)

- `systemAlert` / `systemAlertWindow` → `SYSTEM_ALERT_WINDOW`, se concede con `Settings.ACTION_MANAGE_OVERLAY_PERMISSION`.
- `installPackages` / `requestInstallPackages` → `REQUEST_INSTALL_PACKAGES`, con `canRequestPackageInstalls`.
- `powerMgmt` → `WAKE_LOCK` más `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, que abre Ajustes para sacar la app del ahorro de batería.

El Audit los marca `warn` con `special` aunque el manifiesto esté correcto. Es esperado: el usuario tiene que dar ese permiso a mano.

## Resto del catálogo

- `nfc` — `NFC` sin diálogo, más `uses-feature` y el filtro `TECH_DISCOVERED` con `nfc_tech_filter.xml` si lo marcas.
- `vibration` / `vibrate` — `VIBRATE`, install-time. Los dos selectores apuntan al mismo permiso.
- `biometric` (`USE_BIOMETRIC`, API 28+) y `fingerprint` (`USE_FINGERPRINT`, hasta API 27): marcar legacy activa `biometric`.
- `infrared` — `TRANSMIT_IR`, sólo en dispositivos con IR.
- `ads` — sólo config AdMob: el manifiesto lleva el `meta-data APPLICATION_ID` y el plugin, pero no hay código de anuncios. El Audit lo devuelve como NO GENERADO y bloquea builds que lo seleccionen.
- `foregroundService` — las mismas tres permisos de manifiesto que `foreground`, sin el servicio.
- `internet` — la entrada base de red (`INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`): la incluye todo proyecto, con o sin esta casilla.

## Droncito Pack

El Droncito Pack son **18 entradas del spec** (`ar`, `voiceRec`, `envSensors`, `aiSuite`, `powerMgmt`, `adaptiveNotif`, `advSecurity`, `dynamicUI`, `socialAnalytics`, `advGeo`, `dataAnalytics`, `vr`, `blockchain`, `rpa`, `vulnScan`, `emoAI`, `iot`, `mr`) que se resuelven en un único archivo `DroncitoBridge.java` inyectado por patch, más dependencias de Gradle que se añaden con `patch-droncito-gradle.js` cuando hace falta (ARCore, ML Kit, SceneView, GVR). Desde la web se usan con `Intee.ar.*`, `Intee.voice.*`, `Intee.ai.*`, `Intee.chain.*`, `Intee.iot.*` y compañía.

Tres advertencias que el propio spec recoge: `ar`, `vr` y `mr` suben el peso del APK de forma apreciable (ARCore/GVR) y sólo funcionan en dispositivos compatibles; `blockchain` guarda claves en el Keystore de Android y conviene probarlo en testnet; `iot` añade Bluetooth y localización encima de lo que marques.

## Cómo funciona el runtime por dentro

1. `NativePermissions.java` se genera con un array `BATCH[]` exactamente con tus permisos runtime: sin background, sin `MANAGE_EXTERNAL_STORAGE`. `requestAll()` pide sólo lo declarado y no concedido.
2. `ACCESS_BACKGROUND_LOCATION` va en dos pasos: `requestBackground()` se llama sólo después de conceder el foreground.
3. `SpecialAccess.java` abre Settings para overlay, instalador, alarmas exactas y gestión de almacenamiento. Se genera sólo si lo pediste.
4. `patch-permissions.js` inyecta `onPermissionRequest` con grant selectivo (VIDEO a cámara, AUDIO a micrófono, GEO a ubicación) y `deny()` por defecto.
5. El manifiesto declara `uses-feature ... required="false"` para cámara, Bluetooth LE, GPS, NFC y micrófono, y añade el filtro NFC sólo si toca.
6. En el log del workflow aparecen `permisos nativos instalados`, `accesos especiales instalados` y `filtro NFC instalado`.

## Orden de pruebas recomendado

Un permiso por build, en este orden:

1. HTML mínimo con sólo `INTERNET`: instalar, abrir y comprobar que no pide nada.
2. Cámara: `getUserMedia({video:true})` debe disparar el diálogo.
3. GPS: `navigator.geolocation.getCurrentPosition` debe pedir ubicación.
4. Notificaciones en Android 13+: debe preguntar al abrir.
5. Bluetooth Scan + Connect: `navigator.bluetooth.requestDevice()` debe pedir Bluetooth.

Si un build pide algo que no marcaste, el motor está metiendo de más: abre un issue con el `build-config.json` y el resultado del Audit.

## Después del build

Dos endpoints sirven para la revisión de release:

- `POST /api/manifest-diff` compara lo pedido contra lo generado y devuelve `MATCH` o `MISSING` por permiso, más los inesperados.
- `POST /api/inspect` (máximo 30 MB de APK) devuelve la ficha del paquete con un score.

Conviene pasar los dos antes de subir a Play. El resto del flujo está en [production.md](./production.md) y los errores frecuentes en [troubleshooting.md](./troubleshooting.md).
