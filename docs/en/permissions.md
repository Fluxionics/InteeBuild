# Android Permissions

The Permission Engine lives in `server/generator/permissions.js` and defines **86 entries** in `PERMISSION_SPEC`, each with its manifest permission, whether it needs a runtime dialog, its `minSdk`, its dependencies and the native implementation it generates. The same object feeds three things: the studio switches, `GET /api/permissions/spec` and the Audit. If an entry is added to the spec tomorrow, it shows up in the UI by itself.

The rule that holds the whole system together is that declaring a permission is not the same as Android granting it. That's why the Audit inspects the ZIP that's going to be compiled, not the configuration:

1. **Manifest** — `main-manifest.xml` contains the `uses-permission` line.
2. **Runtime** — `NativePermissions.java` and its patch in `MainActivity.java` call `requestPermissions()` with that batch.
3. **WebView bridge** — `WebChromeClient.onPermissionRequest` only does `grant()` if the permission is in the manifest and was also granted; otherwise `deny()`.

Only the first level is truly automatic. Whether the dialog appears and whether your web app reacts properly gets checked on a real Android device.

## How to read the Audit

`POST /api/permissions/audit` (or the QA button in the studio) returns one row per checked permission:

- `GENERATED OK` — it's in the manifest and has generated implementation. It's the only state that's usable for building.
- `SPEC ONLY, NOT GENERATED` — you requested it but it wasn't generated. The Audit marks it `fail` and blocks the build.
- `NO GENERADO` — reserved for `ads`: today only the configuration and AdMob's `meta-data` are emitted, there's no `AdView` or initialization.
- `warn` — it builds, but there's something to review: a special permission from Settings, a `minSdk` above the `targetSdk`, or an experimental provider.
- `fail` — blocks. `gpsBackground` without `gps` is the typical case.

Every row carries a `mechanism`: `runtime` (normal dialog), `background` (two-step), `special` (granted from Settings), `install-time` (granted at install time) or `missing`.

There are three levels of truth and it's worth not mixing them up: the Audit tests that the project *contains* the permission; whether Android *grants* it is only visible on the device; and whether the feature *works* is only visible by testing the feature. For the matrix per Android version there's the `lab` template (Permission Test Lab), which runs each test from the app itself.

## Always included

`INTERNET`, `ACCESS_NETWORK_STATE` and `ACCESS_WIFI_STATE` are declared in every project (the `internet` entry in the spec). Without them the web page doesn't load and the app stays blank. They don't appear in the Audit because they aren't chosen.

## Notifications — `notifications`

Only enabled on Android 13+ (the entry's `minSdk`: 33); below that the permission didn't exist and the system asks nothing. What gets generated: `POST_NOTIFICATIONS` in the manifest, the `@capacitor/local-notifications` and `@capacitor/push-notifications` plugins in `package.json` (the studio enables them on its own when you check the box) and the bridge `Intee.notifications.schedule({title, body})`. If you enable the scheduled alert in Settings without checking this permission, the manifest adds it anyway.

The test is straightforward: build with only this option, install on Android 13+, accept the dialog and schedule an alert with `notifyOnOpen`. With `targetSdk < 33` the Audit returns `warn`.

## Background audio — `foreground`, `wakeLock`, `foregroundService`

These are three spec entries with the same goal from different angles: keep the process alive while audio plays. `foreground` adds `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` and `WAKE_LOCK` (without it `PARTIAL_WAKE_LOCK` throws a `SecurityException` and the service crashes), and it's the only one of the three that generates `RadioService.java`, `AudioBridge.java` and the `MainActivity` patch that starts it on open. `foregroundService` declares the three service lines without `WAKE_LOCK`, but doesn't generate any service: it contributes the permission and nothing more. `wakeLock` adds only `WAKE_LOCK`, with no dialog. If you enable native audio with a stream URL, the engine checks `foreground` and `wakeLock` by itself, because without a live process and with the screen off the sound cuts out. The spec warns that Play requires justification if the service isn't for audio or sync.

For the details, with the HTML that uses it, everything is in [foreground.md](./foreground.md).

## Camera and microphone — `cameraMic`, `microphone`

They're separated on purpose: Play audits the microphone separately from the camera, and an app that only records video shouldn't request `RECORD_AUDIO`.

- `cameraMic` generates `CAMERA`, `NativePermissions.request(CAMERA)` and `@capacitor/camera`.
- `microphone` generates `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS`.

The WebView bridge checks `wants(VIDEO)` against the manifest and `hasPerm(CAMERA)` against the grant before doing `grant()`. If you didn't check camera, `getUserMedia({video:true})` returns `denied` from the app: that's expected behavior, not a bug.

The fine-grained splits of the group are `cameraFlash`, `cameraAutoFocus`, `videoCapture` and `audioRecord`; they share a manifest permission but are declared separately so the Audit can track what you requested.

## Storage — `storage`, `readExternalStorage`, `writeExternalStorage`, `manageExternalStorage`

With `targetSdk` 33 or above, `storage` generates `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` and `READ_MEDIA_AUDIO` and omits `READ_EXTERNAL_STORAGE` to avoid triggering warnings on Play. Below `targetSdk`, it falls back to the legacy permission. `manageExternalStorage` (`MANAGE_EXTERNAL_STORAGE`, API 30+) is the "all files" one and goes through Settings, not a dialog.

The test: an `<input type="file" accept="image/*">` should open the gallery, and a download from your web app should appear in the download manager.

## Location — `gps`, `gpsBackground` and the splits

`gps` declares `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` without touching background. `gpsBackground` declares `ACCESS_BACKGROUND_LOCATION` and is deliberately a separate entry: on Android 11+ the system ignores a background request if it goes in the same batch as the foreground one, so the runtime requests it in two steps (`requestBackground()` after the foreground is granted).

The Audit returns `fail` if you check background without foreground. Play additionally requires a justification video demonstrating tracking with the app closed; for stores, blogs and radios you should never check it.

The splits `accessFineLocation`, `accessCoarseLocation` and `accessBackgroundLocation` exist for whoever wants the deepest level of detail, and `advGeo` adds tracking with `FusedLocationProvider` and geofencing (requires justification on Play).

## Bluetooth — `bluetoothScan`, `bluetoothConnect`, `bluetoothAdvertise`, `bluetooth`

On Android 12+ they're three distinct permissions and the studio presents them as three switches: scan (`BLUETOOTH_SCAN`), connect (`BLUETOOTH_CONNECT`) and advertise (`BLUETOOTH_ADVERTISE`), all with `minSdk` 31.

`bluetooth` is the legacy entry (`BLUETOOTH` + `BLUETOOTH_ADMIN`), valid up to API 30. If you check it with `targetSdk` 31 or above, `normalizeConfig` enables `bluetoothScan` and `bluetoothConnect` automatically instead of leaving a dead permission behind. `bluetoothPrivileged` is for system apps and doesn't work in a normal app.

## Exact alarms — pick one

There are five entries for two real permissions, and only one should be checked at a time:

- `alarmSchedule` → `SCHEDULE_EXACT_ALARM`. This is the recommended one: the user can revoke it from Settings.
- `alarmUse` → `USE_EXACT_ALARM`, only for clock, alarm or calendar apps. Play reviews it manually.
- `scheduleExactAlarm` and `useExactAlarm` are the splits of those same two.
- `alarm` is the legacy picker; `normalizeConfig` converts it to `scheduleExactAlarm`.

The Audit resolves them to `special` (they go through Settings) and the `SpecialAccess.java` system is generated only if you checked one.

## Phone and SMS — restricted on Play

`phone` groups `CALL_PHONE`, `READ_PHONE_STATE` and `CALL_LOG`; `sms` groups `SEND_SMS` and `READ_SMS`. The splits are `callPhone`, `answerPhone`, `readPhoneState`, `readPhoneNumber`, `readCallLog`, `processOutgoingCalls`, `sendSms`, `readSms`, `receiveSms` and `receiveMms`.

All of them carry the `Play Store restringido` warning in the spec. They build without a problem, but Play only accepts them in apps whose category is dialer or messaging. If your app isn't one of those, don't check them.

## Contacts, calendar and sensors

`contacts` and `calendar` are the read+write packages; their splits are `readContacts`, `writeContacts`, `readCalendar` and `writeCalendar`.

`sensors` covers `BODY_SENSORS` and `HIGH_SAMPLING_RATE_SENSORS`; the splits are `bodySensors` (runtime) and `highSamplingRateSensors` (install-time, API 31+). `activityRecognition` needs API 29+ and `envSensors` (Droncito) adds accelerometer, gyroscope, barometer, light and proximity with API 29 permissions.

## Network, accounts and WiFi

`nearby` and `nearbyWifiDevices` are the same key (`NEARBY_WIFI_DEVICES`, API 33) seen from two pickers. `changeWifiState` and `changeNetworkState` are granted at install time. `getAccounts` (`GET_ACCOUNTS`) is marked as restricted on Play.

## Special access (not a dialog)

- `systemAlert` / `systemAlertWindow` → `SYSTEM_ALERT_WINDOW`, granted via `Settings.ACTION_MANAGE_OVERLAY_PERMISSION`.
- `installPackages` / `requestInstallPackages` → `REQUEST_INSTALL_PACKAGES`, with `canRequestPackageInstalls`.
- `powerMgmt` → `WAKE_LOCK` plus `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, which opens Settings to take the app out of battery optimization.

The Audit marks them `warn` with `special` even when the manifest is correct. That's expected: the user has to grant that permission by hand.

## Rest of the catalog

- `nfc` — `NFC` with no dialog, plus `uses-feature` and the `TECH_DISCOVERED` filter with `nfc_tech_filter.xml` if you check it.
- `vibration` / `vibrate` — `VIBRATE`, install-time. Both pickers point at the same permission.
- `biometric` (`USE_BIOMETRIC`, API 28+) and `fingerprint` (`USE_FINGERPRINT`, up to API 27): checking the legacy one enables `biometric`.
- `infrared` — `TRANSMIT_IR`, only on devices with IR.
- `ads` — AdMob config only: the manifest carries the `meta-data APPLICATION_ID` and the plugin, but there's no ad code. The Audit returns it as NO GENERADO and blocks builds that select it.
- `foregroundService` — the same three manifest permissions as `foreground`, without the service.
- `internet` — the base network entry (`INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`): every project includes it, with or without this box checked.

## Droncito Pack

The Droncito Pack is **18 spec entries** (`ar`, `voiceRec`, `envSensors`, `aiSuite`, `powerMgmt`, `adaptiveNotif`, `advSecurity`, `dynamicUI`, `socialAnalytics`, `advGeo`, `dataAnalytics`, `vr`, `blockchain`, `rpa`, `vulnScan`, `emoAI`, `iot`, `mr`) that resolve into a single `DroncitoBridge.java` file injected by patch, plus Gradle dependencies added with `patch-droncito-gradle.js` when needed (ARCore, ML Kit, SceneView, GVR). From the web you use them with `Intee.ar.*`, `Intee.voice.*`, `Intee.ai.*`, `Intee.chain.*`, `Intee.iot.*` and friends.

Three warnings the spec itself records: `ar`, `vr` and `mr` noticeably increase APK size (ARCore/GVR) and only work on compatible devices; `blockchain` stores keys in the Android Keystore and you should test it on a testnet; `iot` adds Bluetooth and location on top of whatever you check.

## How the runtime works under the hood

1. `NativePermissions.java` is generated with a `BATCH[]` array containing exactly your runtime permissions: no background, no `MANAGE_EXTERNAL_STORAGE`. `requestAll()` only requests what's declared and not yet granted.
2. `ACCESS_BACKGROUND_LOCATION` goes in two steps: `requestBackground()` is called only after the foreground is granted.
3. `SpecialAccess.java` opens Settings for overlay, installer, exact alarms and storage management. It's generated only if you requested it.
4. `patch-permissions.js` injects `onPermissionRequest` with selective grants (VIDEO to camera, AUDIO to microphone, GEO to location) and `deny()` by default.
5. The manifest declares `uses-feature ... required="false"` for camera, Bluetooth LE, GPS, NFC and microphone, and adds the NFC filter only when it applies.
6. The workflow log shows `permisos nativos instalados`, `accesos especiales instalados` and `filtro NFC instalado`.

## Recommended testing order

One permission per build, in this order:

1. Minimal HTML with only `INTERNET`: install, open and check that it asks for nothing.
2. Camera: `getUserMedia({video:true})` should trigger the dialog.
3. GPS: `navigator.geolocation.getCurrentPosition` should ask for location.
4. Notifications on Android 13+: should ask on open.
5. Bluetooth Scan + Connect: `navigator.bluetooth.requestDevice()` should ask for Bluetooth.

If a build requests something you didn't check, the engine is adding too much: open an issue with the `build-config.json` and the Audit result.

## After the build

Two endpoints serve release review:

- `POST /api/manifest-diff` compares what was requested against what was generated and returns `MATCH` or `MISSING` per permission, plus the unexpected ones.
- `POST /api/inspect` (max 30 MB APK) returns the package's info card with a score.

It's worth running both before uploading to Play. The rest of the flow is in [production.md](./production.md) and the common errors are in [troubleshooting.md](./troubleshooting.md).
