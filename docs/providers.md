# Providers: qué motor renderiza tu app

El provider decide qué `MainActivity` y qué stack de renderizado recibe tu app. Se elige en el paso **Aplicación**, en la tarjeta de proveedor, o con el campo `provider` de la API. El valor se guarda en `provider.json` dentro del ZIP y el workflow lo lee en el paso `Apply provider WebView (pro)`.

Antes que la tabla de estados, la idea que conviene tener clara: **hay tres familias**. `capacitor`, `native`, `twa` y `gecko` (y los alias `react-native`/`ionic`) compilan todos el mismo proyecto Gradle: el workflow añade la plataforma Android de Capacitor y ejecuta Gradle; lo único que cambia es si el provider sustituye `MainActivity`. `cordova` trae su propio proyecto y su propio job (`cordova-build`) con la toolchain real de Cordova. `flutter` y `tauri` también traen su proyecto y su job: Flutter no toca Gradle de Capacitor y Tauri compila con Cargo en Windows.

## Tabla comparativa

| Provider | Qué genera hoy | Compila en CI | Ideal para |
|---|---|---|---|
| **Capacitor** (default) | Proyecto Capacitor completo: `MainActivity extends BridgeActivity`, plugins npm, InteeBridge, Ads config | APK + AAB | Control total con el ecosistema npm |
| **Native WebView** | `MainActivity` Java horneada: WebView, permisos runtime, RadioService, AudioBridge, DownloadManager, file chooser | APK | APK ligero y arranque rápido, sin dependencias |
| **GeckoView** | `MainActivity` con GeckoView + `PermissionDelegate`, file prompt, descargas (`onExternalResponse`) y patch Gradle Mozilla | APK | Motor Mozilla puro, aislamiento de Chromium |
| **TWA** | `twa-manifest.json` + `assetlinks.json` (APK sigue siendo la ruta WebView) | APK | PWA con Digital Asset Links |
| **Cordova** | `config.xml` real (SDK, orientación, fullscreen) + plataforma `cordova-android` en CI | APK (+AAB) (`cordova-build`) | vivir en la toolchain Cordova |
| **Flutter** | Proyecto Flutter: `pubspec.yaml`, `main.dart`, assets, manifiesto propio | APK + AAB (`flutter-build`) | si tu app ya vive en Flutter |
| **Tauri** | `tauri/src-tauri` (Rust): `Cargo.toml`, `tauri.conf.json`, `main.rs`, iconos | EXE de escritorio (`tauri-build`) | apps de escritorio con WebView2 |

No están implementados a propósito: **NativeScript** (otro runtime completo que mantener) y **webapkify** (solo sirve de referencia: no compila). El "WebToApp propio" del plan es justamente el provider `native`. TWA no corre bubblewrap en CI: sólo entrega los manifiestos.

## Estados reales

- **`capacitor` (por defecto)** — genera el proyecto Capacitor completo: `capacitor.config.json`, dependencias `@capacitor/*`, `MainActivity extends BridgeActivity`. Es el único con todos los parches probados: permisos runtime, accesos especiales, DownloadManager, audio nativo, Droncito Pack.
- **`native`** — genera `native-MainActivity.java` (una `AppCompatActivity` con `WebView`, concesión selectiva de permisos, arranque de `RadioService` y `AudioBridge` horneados, `DownloadListener` que encola en `DownloadManager` —con `ibFileName()` desde `Content-Disposition` o la URL, y fallback a `ACTION_VIEW`— y `onShowFileChooser` que abre `ACTION_GET_CONTENT` con `EXTRA_MIME_TYPES`/`EXTRA_ALLOW_MULTIPLE` y devuelve los `Uri` por `onActivityResult` con `ValueCallback`) y el workflow lo copia como `MainActivity.java`. Salida ligera y arranque rápido, a cambio de no tener el runtime de Capacitor: los plugins npm no existen y `inteebridge.js` sólo funciona en los métodos con fallback web (`share`, `vibrate`, `clipboard`, `storage`, `toast`, `dialog`); los que dependen de un plugin (`Intee.location()`, `Intee.camera()`, `Intee.notifications.schedule()`) rechazan con "no disponible". `InteeAudio` sí funciona, porque el puente nativo está inyectado en la propia clase. Las descargas se pueden desactivar con `downloadManager: false` en la config.
- **`gecko`** — genera `gecko-MainActivity.java` (una `AppCompatActivity` que crea un `GeckoView`, abre la URL y hornea los permisos con un `PermissionDelegate` de GeckoView: pide los permisos Android con código 4101 y devuelve `grant`/`reject` a la sesión, más el arranque de `RadioService` si hay `foreground`) y `patch-gecko-gradle.js`, que inyecta la dependencia `org.mozilla.geckoview:geckoview` y el repositorio `https://maven.mozilla.org/maven2` en los `build.gradle`. El workflow lo aplica en el paso `Apply GeckoView dependencies`, así que compila sin tocar nada a mano. El APK usa el runtime de permisos de Capacitor para todo lo demás. El file chooser pasa por `PromptDelegate.onFilePrompt` (devuelve un `GeckoResult<PromptResponse>` y lo resuelve desde `onActivityResult` con `FilePrompt.confirm(Context, Uri[])` o `FilePrompt.dismiss()`), y las descargas por `ContentDelegate.onExternalResponse`: primero intenta `DownloadManager` con `Content-Disposition`/URL y, si la URL no es re-descargable, copia el `body` a Descargas en un hilo. Limitación conocida: GeckoView no expone `addJavascriptInterface`, así que **no existe `window.InteeAudio`** ni el puente `Intee.*` bajo este provider (el runtime de traspaso de `catalog.js` lo detecta y se queda sin hacer nada: con pantalla apagada el audio de la WebView se corta). El AAR de GeckoView pesa ~200 MB, la descarga es lenta y ocurre en cada build.
- **`twa`** — genera `twa-manifest.json` y `assetlinks.json` para que construyas la Trusted Web Activity con bubblewrap (el README incluido lo indica: `bubblewrap build --manifest=twa-manifest.json`). El APK que compila el workflow sigue siendo la app WebView normal con runtime Capacitor; no es una TWA. Además, la huella `sha256_cert_fingerprints` del `assetlinks.json` se genera con ceros de relleno: hay que sustituirla por la huella real de tu certificado de firma antes de subirla a `/.well-known/`.
- **`cordova`** — escribe un `config.xml` real en la raíz del ZIP (`<content src>`, `access`/`allow-intent`, `Orientation`, `Fullscreen`, `BackgroundColor` y las preferences `android-minSdkVersion`/`android-targetSdkVersion`/`android-compileSdkVersion` con tus versiones) y en CI corre el job **`cordova-build`**: `cordova platform add android`, inyección de los `<uses-permission>`/`<uses-feature>` de `main-manifest.xml` en el manifiesto generado (más `INTERNET` y `usesCleartextTraffic` si aplica), icono copiado a los `mipmap-*`, y `cordova build android` (APK debug; AAB si lo pediste, con `continue-on-error`; release firmado con tu keystore vía `build.json`). El job `compile` de Capacitor se salta con este provider. Lo que **no** hereda: el runtime batch `NativePermissions`, `SpecialAccess`, `RadioService`/`AudioBridge` ni `InteeBridge` (la web corre en la `CordovaWebView` estándar); en iOS la compilación sigue por Capacitor. El Audit lo trata como `CI_ANDROID` (compila APK en CI, permisos por runtime de la app).
- **`flutter`** — escribe `flutter/pubspec.yaml` (webview_flutter 4 + permission_handler), `flutter/lib/main.dart` (WebView con `loadFlutterAsset('assets/www/index.html')` o `loadRequest` para URL, controlador inicializado en `initState`), un `AndroidManifest.xml` propio sin `package=` (AGP 8 usa el `namespace` del Gradle del scaffold), `flutter/assets/www/*` con tu web y un README. En CI el job `flutter-build` ejecuta `flutter create` para generar el host Android, copia tu manifiesto encima, ajusta `applicationId`/`namespace` a tu paquete, mueve `MainActivity.kt` al paquete correcto y compila: artefactos `-apk` y (si pediste `aab`) `-aab`. El job `compile` de Capacitor se salta con este provider.
- **`tauri`** — escribe `tauri/src-tauri/Cargo.toml`, `tauri/src-tauri/build.rs`, `tauri/src-tauri/tauri.conf.json` (`distDir: ../../www`, CSP con `unsafe-inline` para los scripts inyectados), `tauri/src-tauri/src/main.rs`, iconos (`icons/*.png`, `icon.ico`, `icon.icns` fabricados a partir de tu PNG; si tu icono no es PNG se omite la clave `bundle.icon`) y un README. En CI el job `tauri-build` corre `cargo build --release` en `windows-latest` y sube el artefacto `-exe`. El proyecto Electron (`desktop/`) queda desactivado con este provider para no pisarse el artefacto `.exe`; el APK Android que sale del job `compile` sigue siendo el de Capacitor.
- **`react-native`** e **`ionic`** — son valores válidos en `normalizeConfig`, pero no generan nada propio: sólo queda `provider.json` con ese nombre, y el workflow los compila como si fueran Capacitor. No aparecen en el estudio.

Los switches del estudio marcan `capacitor`, `native`, `twa`, `gecko`, `cordova`, `flutter` y `tauri` en `READY` (los siete compilan en CI); `react-native` e `ionic` no aparecen.

## Cómo cambiarlo

Por API:

```bash
curl -X POST /api/build -H "Content-Type: application/json" \
  -d '{"appName":"Mi App","url":"https://mi-web.com","provider":"native"}'
```

El ZIP siempre trae `provider.json`:

```json
{ "provider": "native", "version": "7", "webview": "Native WebView" }
```

## Qué cambia de verdad entre `capacitor` y `native`

Capacitor trae el puente completo (`Capacitor`, plugins npm, `BridgeActivity`) y por eso soporta todo el catálogo de plugins y `InteeBridge`. El provider nativo cambia tres cosas: el `MainActivity` es una clase propia que carga la URL o `file:///android_asset/public/index.html`, los permisos runtime y los accesos especiales se invocan directamente desde esa clase, y los plugins npm de Capacitor no existen.

Si vienes de `capacitor` y cambias a `native`, revisa el Audit de nuevo: cada permiso cuyo `providerOk` no incluya el provider nuevo pasa a `WARN` (los que no declaran esa lista siguen en `OK`), y eso hace bajar el readiness aunque no bloquee la build.

## Compatibilidad con permisos

El Audit añade una columna `provider` por fila:

- `OK (<provider>)` — el provider está en `READY` y el permiso tiene implementación declarada para su runtime.
- `WARN (<provider> sin handler declarado para este permiso)` — el provider está en `READY` pero ese permiso no declara handler para su runtime (el APK compila igualmente).
- `WARN (<provider> compila APK en CI, permisos por runtime de la app)` — para `flutter`, `tauri`, `react-native`, `ionic` y `cordova`: el APK se arma por la ruta indicada y los permisos los gestiona el runtime correspondiente.

Un ejemplo concreto de por qué importa: NFC con `NDEFReader` funciona en Chromium (Capacitor y Native) pero en Gecko el Audit devuelve `WARN`.

## Anuncios (AdMob): estado actual

El generador emite configuración, no integración. Si marcas `ads` y rellenas `admobAppId`, el ZIP incluye `admob-config.json`, el manifiesto lleva el `meta-data APPLICATION_ID`, y `normalizeConfig` activa el plugin `@capacitor-community/admob`.

Lo que **no** se genera: inicialización de `MobileAds`, `AdView`, ni código de interstitial ni de rewarded. El Audit lo devuelve explícitamente como `NO GENERADO (requiere AdMob App ID + SDK, no incluido)` y lo trata como `fail`, así que un build con `ads` marcado queda bloqueado hasta que exista la implementación.

## Autenticación de dominio (assetlinks)

`assetlinks.json` se genera siempre que hay un dominio (campo `twaDomain`, dominio de deep links o el hostname de tu URL) y se copia también a `.well-known/assetlinks.json`. Sirve tanto para App Links como para TWA. Recuerda lo dicho arriba: la huella de certificado que trae es de relleno.

Más sobre lo que la app generada expone en [security.md](./security.md); sobre lo que compila realmente, en [outputs.md](./outputs.md).
