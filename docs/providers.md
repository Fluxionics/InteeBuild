# Providers: qué motor renderiza tu app

El provider decide qué `MainActivity` y qué stack de renderizado recibe tu app. Se elige en el paso **Aplicación**, en la tarjeta de proveedor, o con el campo `provider` de la API. El valor se guarda en `provider.json` dentro del ZIP y el workflow lo lee en el paso `Apply provider WebView (pro)`.

Antes que la tabla de estados, la idea que conviene tener clara: **todos los providers compilan el mismo proyecto Gradle**. El workflow añade la plataforma Android de Capacitor y ejecuta Gradle en todos los casos; lo único que cambia es si el provider sustituye `MainActivity`. Eso significa que elegir un provider que no compila no rompe el APK por arte de magia: o bien se ignora, o bien Gradle falla.

## Estados reales

- **`capacitor` (por defecto)** — genera el proyecto Capacitor completo: `capacitor.config.json`, dependencias `@capacitor/*`, `MainActivity extends BridgeActivity`. Es el único con todos los parches probados: permisos runtime, accesos especiales, DownloadManager, audio nativo, Droncito Pack.
- **`native`** — genera `native-MainActivity.java` (una `AppCompatActivity` con `WebView`, concesión selectiva de permisos, arranque de `RadioService` y `AudioBridge` horneados) y el workflow lo copia como `MainActivity.java`. Salida ligera y arranque rápido, a cambio de no tener el runtime de Capacitor: los plugins npm no existen y `inteebridge.js` sólo funciona en los métodos con fallback web (`share`, `vibrate`, `clipboard`, `storage`, `toast`, `dialog`); los que dependen de un plugin (`Intee.location()`, `Intee.camera()`, `Intee.notifications.schedule()`) rechazan con "no disponible". `InteeAudio` sí funciona, porque el puente nativo está inyectado en la propia clase.
- **`gecko`** — genera `gecko-MainActivity.java` con imports de `org.mozilla.geckoview`. **No hay ningún patch que añada esa dependencia a `build.gradle`**, así que un build con este provider falla en Gradle con `package org.mozilla.geckoview does not exist` salvo que añadas tú la dependencia en el repo de builds. Estado real: experimental y no compilable tal cual.
- **`twa`** — genera `twa-manifest.json` y `assetlinks.json` para que construyas la Trusted Web Activity con bubblewrap (el README incluido lo indica: `bubblewrap build --manifest=twa-manifest.json`). El APK que compila el workflow sigue siendo la app WebView normal; no es una TWA. Además, la huella `sha256_cert_fingerprints` del `assetlinks.json` se genera con ceros de relleno: hay que sustituirla por la huella real de tu certificado de firma antes de subirla a `/.well-known/`.
- **`cordova`** — sólo escribe un `config.xml` de referencia en la raíz del ZIP. El build no lo usa.
- **`flutter`** — escribe `flutter/pubspec.yaml`, `flutter/lib/main.dart`, un `AndroidManifest.xml` propio y un README con `flutter build apk`. El workflow lo ignora: el APK que sale es el normal. Compilar Flutter queda fuera de la CI.
- **`tauri`** — escribe `tauri/Cargo.toml`, `tauri/tauri.conf.json`, `tauri/src-tauri/src/main.rs` y un README con `cargo tauri build`. Igual que Flutter: código fuente en el ZIP, ningún paso que produzca un binario.
- **`react-native`** e **`ionic`** — son valores válidos en `normalizeConfig`, pero no generan nada propio: sólo queda `provider.json` con ese nombre. No aparecen en el estudio.

Los switches del estudio marcan `flutter` y `tauri` como `PLANNED` y los dejan desactivados; `twa`, `gecko` y `cordova` como `EXPERIMENTAL`. Sólo `capacitor` y `native` están en `READY`.

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

- `OK (capacitor)` o `OK (native)` — el permiso tiene implementación para ese provider.
- `WARN (gecko experimental: verifica en build real)` — vale para `gecko`, `twa` y `cordova`.
- `WARN (<provider> solo genera proyecto, sin APK)` — para `flutter`, `tauri`, `react-native` e `ionic`.

Un ejemplo concreto de por qué importa: NFC con `NDEFReader` funciona en Chromium (Capacitor y Native) pero en Gecko el Audit devuelve `WARN`.

## Anuncios (AdMob): estado actual

El generador emite configuración, no integración. Si marcas `ads` y rellenas `admobAppId`, el ZIP incluye `admob-config.json`, el manifiesto lleva el `meta-data APPLICATION_ID`, y `normalizeConfig` activa el plugin `@capacitor-community/admob`.

Lo que **no** se genera: inicialización de `MobileAds`, `AdView`, ni código de interstitial ni de rewarded. El Audit lo devuelve explícitamente como `NO GENERADO (requiere AdMob App ID + SDK, no incluido)` y lo trata como `fail`, así que un build con `ads` marcado queda bloqueado hasta que exista la implementación.

## Autenticación de dominio (assetlinks)

`assetlinks.json` se genera siempre que hay un dominio (campo `twaDomain`, dominio de deep links o el hostname de tu URL) y se copia también a `.well-known/assetlinks.json`. Sirve tanto para App Links como para TWA. Recuerda lo dicho arriba: la huella de certificado que trae es de relleno.

Más sobre lo que la app generada expone en [security.md](./security.md); sobre lo que compila realmente, en [outputs.md](./outputs.md).
