# Permisos Android — guía completa y verificable

> Marca solo lo que tu app usa. Google Play rechaza permisos sensibles sin justificación.
> Cada permiso aquí explica: **dónde se activa, qué genera en el APK, cómo probarlo y qué muestra el Audit.**
> Detalle de audio en segundo plano: [foreground.md](./foreground.md).

**Regla de oro:**

```
"mostrar un permiso" ≠ "Android lo concede"
```

Cada permiso necesita 3 capas y el Audit las verifica contra el ZIP generado (no solo contra la definición):

1. **Manifest** — `main-manifest.xml` contiene `uses-permission`.
2. **Runtime** — `NativePermissions.java` + patch en `MainActivity.java` lo pide con `requestPermissions()`.
3. **WebView bridge** — `onPermissionRequest` solo hace `grant()` si el recurso está en Manifest **y** el runtime fue concedido. Si no, `deny()`.

Cómo leer el Audit: `GENERATED OK` = existe en el proyecto que se compila. `SPEC ONLY, NOT GENERATED` = no instales. `warn` = compila pero revisa Play Store / versión / provider. `fail` = bloquea el botón Generar APK.

---

## 0. Siempre incluidos (sin pedir nada)

| Permiso | Para qué | Runtime |
|---|---|---|
| `INTERNET` | Cargar tu web | No |
| `ACCESS_NETWORK_STATE` | Detectar offline/online | No |
| `ACCESS_WIFI_STATE` | Calidad de red | No |

Sin estos la app muestra blanco. No aparecen en el Audit porque no se eligen.

---

## 1. Notificaciones — `notifications`

**Dónde se activa:** Paso 2 → tile `Notificaciones` (viene marcado por defecto).

**Qué genera:**
- Manifest: `POST_NOTIFICATIONS`
- Nativo: `LocalNotifications.requestPermissions + schedule` + canal configurable (`notifChannel`, `notifImportance`, sonido, vibración)
- Bridge: `Intee.notifications.schedule({title, body})`

**Cómo probarlo:**
1. Compila con solo `notifications`. Instala en Android 13+.
2. Al abrir debe pedir "Permitir notificaciones".
3. En Android 12 o menos no pide nada (normal, el permiso no existía).
4. Programa un aviso con `notifyOnOpen` y reabre: debe llegar la notificación.

**Audit esperado:** `notifications ok (GENERATED)`, `verified: true`. Si `targetSdk < 33` → `warn`.

---

## 2. Foreground + Wake Lock — `foreground`, `wakeLock`

**Dónde se activa:** tile `Servicio Foreground` + `Pantalla Encendida`. Plantilla Radio los marca.

**Qué genera:**
- Manifest: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `WAKE_LOCK`, más `POST_NOTIFICATIONS`
- Archivos: `RadioService.java` + `patch-main-activity.js` → `startForegroundService()`
- Manifest service: `<service android:name=".RadioService" foregroundServiceType="dataSync|mediaPlayback" />`

**Cómo probarlo:** ver [foreground.md](./foreground.md) completo. Resumen: notificación persistente + audio con pantalla apagada 30 segundos.

**Audit esperado:** `foreground ok`, `wakeLock ok`. Sin estos el audio se corta al minimizar.

---

## 3. Cámara — `cameraMic`

**Dónde se activa:** tile `Cámara`.

**Qué genera:**
- Manifest: **solo** `CAMERA` (el audio va separado en `microphone`)
- Nativo: `NativePermissions.request(CAMERA)` en `onStart()` + plugin `@capacitor/camera`
- Bridge: `Intee.camera()` → `Camera.getPhoto()`
- WebView: `getUserMedia({video:true})` → `onPermissionRequest` comprueba `wants(VIDEO)` (¿CAMERA en Manifest?) y `hasPerm(CAMERA)` (¿usuario concedió?). Solo entonces `grant(VIDEO)`, si no `deny()`.

**Cómo probarlo:**
1. Página de prueba: `<button onclick="navigator.mediaDevices.getUserMedia({video:true})">Probar</button>`.
2. Sin marcar Cámara → debe fallar con `Permission denied` (correcto, el bridge deniega).
3. Marcando Cámara → Android pide "Permitir cámara" → el video funciona.
4. En `chrome://inspect` no debe aparecer `grant-all`.

**Audit esperado:** `Cámara ok (GENERATED (NativePermissions.request(CAMERA)+Capacitor Camera.getPhoto))`, `verified: true`.

---

## 4. Micrófono — `microphone`

**Dónde se activa:** tile `Micrófono`. Separa de Cámara a propósito (Play lo audita distinto).

**Qué genera:**
- Manifest: `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`
- Nativo: `NativePermissions.request(RECORD_AUDIO)`
- WebView: `getUserMedia({audio:true})` → `wants(AUDIO)` + `hasPerm(RECORD_AUDIO)` → `grant` o `deny()`.

**Cómo probarlo:** igual que Cámara pero con `{audio:true}`. Para videollamadas WebRTC marca ambos.

---

## 5. Almacenamiento multimedia — `storage`

**Dónde se activa:** tile `Archivos & Galería`.

**Qué genera (targetSdk 35):**
- Manifest: `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`
- `READ_EXTERNAL_STORAGE` **solo** si `targetSdk < 33` (legacy, se omite en 35 para no levantar flags en Play)
- Nativo: `@capacitor/filesystem` + `FileProvider` + `DownloadManager`

**Cómo probarlo:**
1. `<input type="file" accept="image/*">` debe abrir la galería.
2. Descarga un PDF desde tu web → debe ir al gestor de descargas con notificación.
3. En Android 13+ pide "Permitir fotos y videos". En Android 10 pide "archivos".

---

## 6. Ubicación precisa — `gps`

**Dónde se activa:** tile `Ubicación GPS`.

**Qué genera:**
- Manifest: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` (**sin** background automático)
- Nativo: `Geolocation.getCurrentPosition` + `Intee.location()`
- WebView: `navigator.geolocation` → `wants(GEOLOCATION)` + `hasPerm(FINE|COARSE)` → `grant` o `deny()`.

**Cómo probarlo:** página con `navigator.geolocation.getCurrentPosition(console.log, console.error)`. Sin `gps` → error `denied`. Con `gps` → Android pide ubicación.

---

## 7. Ubicación en segundo plano — `gpsBackground`

**Dónde se activa:** Paso 2 → avanzado → `Ubicación en segundo plano`. **Separado a propósito.**

**Qué genera:** `ACCESS_BACKGROUND_LOCATION`.

**Advertencia Play Store:** requiere justificación con video demostrando rastreo con app cerrada. No lo marques para tiendas, blogs ni radios.

**Audit:** `fail` si pides background sin `gps` preciso. El orden correcto es: primero concede `gps`, luego el sistema pide background.

---

## 8. Bluetooth granular — `bluetoothScan`, `bluetoothConnect`, `bluetoothAdvertise`

**Dónde se activa:** avanzado → tres switches separados (Android 12+).

| Switch | Manifest | Uso |
|---|---|---|
| Escanear | `BLUETOOTH_SCAN` | `navigator.bluetooth.requestDevice()` |
| Conectar | `BLUETOOTH_CONNECT` | Conectar al dispositivo |
| Anunciar | `BLUETOOTH_ADVERTISE` | Hacer visible tu dispositivo |

**Legacy:** `bluetooth` (`BLUETOOTH + BLUETOOTH_ADMIN`) solo para `targetSdk ≤ 30`. Si lo marcas en target 35, el Engine activa `Scan + Connect` automáticamente.

**Cómo probarlo:** página BLE con `requestDevice()`. En Android 12+ sin `Scan` → error. Con `Scan + Connect` → Android pide Bluetooth.

---

## 9. Alarmas — elige UNA

**Dónde se activa:** avanzado → dos opciones (nunca ambas).

- `alarmSchedule` → `SCHEDULE_EXACT_ALARM` (**recomendado**). El usuario lo puede revocar en Ajustes. Para recordatorios y notificaciones programadas.
- `alarmUse` → `USE_EXACT_ALARM` (**solo** reloj, alarma o calendario). Play lo verifica manualmente.
- Legacy `alarm` equivale a `SCHEDULE`.

---

## 10. Teléfono y SMS — sensibles

| Permiso | Manifest | Cuándo marcar |
|---|---|---|
| `phone` | `CALL_PHONE, READ_PHONE_STATE, READ_CALL_LOG` | Solo apps de marcador/teléfono |
| `sms` | `SEND_SMS, READ_SMS` | Solo apps de SMS por defecto |

Nativo: `tel:` / `sms:` se abren con `Intent.ACTION_VIEW` nativo (no quedan en el WebView).
**Si tu app no es de esas categorías, no los marques:** compila igual pero Play la rechaza.

---

## 11. Especiales (no son runtime normal)

| Permiso | Manifest | Cómo se concede |
|---|---|---|
| `systemAlert` | `SYSTEM_ALERT_WINDOW` | `Settings.ACTION_MANAGE_OVERLAY_PERMISSION` (pantalla de Ajustes) |
| `installPackages` | `REQUEST_INSTALL_PACKAGES` | `canRequestPackageInstalls` (Play restringido) |

El Audit los marca `warn` con `special` aunque el Manifest esté OK. Es normal.

---

## 12. Sistema y sensores

| Permiso | Manifest | Notas |
|---|---|---|
| `nearby` | `NEARBY_WIFI_DEVICES` | Runtime, minSdk 33 |
| `biometric` | `USE_BIOMETRIC` | `BiometricPrompt` + `Intee.biometric()` + WebAuthn |
| `sensors` | `BODY_SENSORS, HIGH_SAMPLING_RATE_SENSORS` | Runtime |
| `activityRecognition` | `ACTIVITY_RECOGNITION` | Runtime, minSdk 29 |
| `calendar` | `READ_CALENDAR, WRITE_CALENDAR` | Runtime |
| `contacts` | `READ_CONTACTS, WRITE_CONTACTS` | Runtime |
| `nfc` | `NFC` | `NfcAdapter` + `NDEFReader`, no pide runtime |
| `vibration` | `VIBRATE` | `navigator.vibrate` + `Intee.vibrate` |
| `wakeLock` | `WAKE_LOCK` | Sin runtime, imprescindible para radios |

---

## 13. Splits finos (una capacidad = una key)

El Paso 2 → `Manifiesto Técnico` → `Permisos granulares técnicos` lista cada capacidad por separado, generada desde el mismo spec que el Audit. Todas pasan por Manifest + mecanismo real:

| Grupo | Keys | Mecanismo |
|---|---|---|
| Cámara | `cameraFlash`, `cameraAutoFocus`, `videoCapture`, `audioRecord` | Batch runtime (`CAMERA` / `RECORD_AUDIO`) |
| Contactos / Calendario | `readContacts`, `writeContacts`, `readCalendar`, `writeCalendar` | Batch runtime |
| Teléfono | `readPhoneState`, `readPhoneNumber`, `callPhone`, `answerPhone`, `readCallLog`, `processOutgoingCalls` | Batch runtime (Play restringido) |
| SMS | `sendSms`, `readSms`, `receiveSms`, `receiveMms` | Batch runtime (Play restringido) |
| Sensores | `bodySensors`, `highSamplingRateSensors` | `BODY_SENSORS` runtime; alta tasa es install-time |
| Storage legacy | `readExternalStorage`, `writeExternalStorage` | Batch runtime (solo `targetSdk < 33`) |
| Ubicación fina | `accessFineLocation`, `accessCoarseLocation`, `accessBackgroundLocation` | Foreground en batch; background en two-step |
| Red / WiFi | `getAccounts`, `nearbyWifiDevices`, `changeWifiState`, `changeNetworkState` | `GET_ACCOUNTS` y `NEARBY` en batch; cambios de red son install-time |
| Otros | `bluetoothPrivileged`, `infrared`, `vibrate` | Manifest (+ `uses-feature` donde aplica) |

Si mañana el spec crece, estos switches aparecen solos: la UI se renderiza desde `GET /api/permissions/spec`.

## 14. Cómo funciona el runtime por dentro (verificable en el ZIP)

1. `NativePermissions.java` trae un `BATCH[]` generado exactamente con tus permisos runtime (sin background, sin manage-storage). `requestAll()` pide solo lo declarado y no concedido.
2. `ACCESS_BACKGROUND_LOCATION` va en **two-step**: `requestBackground()` solo se llama tras conceder foreground (Android 11+ ignora el background pedido en lote).
3. `SpecialAccess.java` abre **Settings** para overlay, instalador, alarmas exactas y manage-storage. Se genera solo si los pides.
4. `patch-permissions.js` inyecta `WebChromeClient.onPermissionRequest` con grant **selectivo** (VIDEO→cámara, AUDIO→mic, GEO→ubicación) y `deny()` por defecto.
5. El Manifest declara `uses-feature ... required="false"` (cámara, BT LE, GPS, NFC, micrófono) y filtro `TECH_DISCOVERED` + `nfc_tech_filter.xml` si pides NFC.
6. En el log del workflow busca: `permisos nativos instalados`, `accesos especiales instalados`, `filtro NFC instalado`.

## Flujo recomendado de pruebas reales

```
HTML mínimo (solo INTERNET) → instalar → abre sin pedir nada
  → Cámara → instalar → getUserMedia pide cámara
  → GPS → instalar → geolocation pide ubicación
  → Notificaciones → instalar → pide avisos (Android 13+)
  → Bluetooth Scan+Connect → instalar → requestDevice pide BT
```

Un permiso por build. Si un build pide algo que no marcaste, el Engine tiene un bug: abre un issue con `build-config.json` y el Audit.
