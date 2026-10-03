# Providers: which engine renders your app

The provider decides which `MainActivity` and which rendering stack your app gets. It's chosen in the **Application** step, on the provider card, or with the API's `provider` field. The value is stored in `provider.json` inside the ZIP and the workflow reads it in the `Apply provider WebView (pro)` step.

Before the status table, the idea worth keeping clear: **there are three families**. `capacitor`, `native`, `twa` and `gecko` (and the `react-native`/`ionic` aliases) all compile the same Gradle project: the workflow adds the Capacitor Android platform and runs Gradle; the only difference is whether the provider replaces `MainActivity`. `cordova` brings its own project and its own job (`cordova-build`) with the real Cordova toolchain. `flutter` and `tauri` also bring their project and their job: Flutter doesn't touch Capacitor's Gradle and Tauri compiles with Cargo on Windows.

## Comparison table

| Provider | What it generates today | Compiles in CI | Ideal for |
|---|---|---|---|
| **Capacitor** (default) | Full Capacitor project: `MainActivity extends BridgeActivity`, npm plugins, InteeBridge, Ads config | APK + AAB | Full control with the npm ecosystem |
| **Native WebView** | Baked Java `MainActivity`: WebView, runtime permissions, RadioService, AudioBridge, DownloadManager, file chooser | APK | Lightweight APK and fast startup, no dependencies |
| **GeckoView** | `MainActivity` with GeckoView + `PermissionDelegate`, file prompt, downloads (`onExternalResponse`) and Mozilla Gradle patch | APK | Pure Mozilla engine, isolation from Chromium |
| **TWA** | `twa-manifest.json` + `assetlinks.json` (the APK is still the WebView route) | APK | PWA with Digital Asset Links |
| **Cordova** | Real `config.xml` (SDK, orientation, fullscreen) + `cordova-android` platform in CI | APK (+AAB) (`cordova-build`) | living in the Cordova toolchain |
| **Flutter** | Flutter project: `pubspec.yaml`, `main.dart`, assets, its own manifest | APK + AAB (`flutter-build`) | if your app already lives in Flutter |
| **Tauri** | `tauri/src-tauri` (Rust): `Cargo.toml`, `tauri.conf.json`, `main.rs`, icons | Desktop EXE (`tauri-build`) | desktop apps with WebView2 |

Deliberately not implemented: **NativeScript** (another full runtime to maintain) and **webapkify** (only useful as a reference: it doesn't compile). The plan's own "WebToApp" is precisely the `native` provider. TWA doesn't run bubblewrap in CI: it only hands over the manifests.

## Real statuses

- **`capacitor` (default)** — generates the full Capacitor project: `capacitor.config.json`, `@capacitor/*` dependencies, `MainActivity extends BridgeActivity`. It's the only one with all the patches tested: runtime permissions, special access, DownloadManager, native audio, Droncito Pack.
- **`native`** — generates `native-MainActivity.java` (an `AppCompatActivity` with `WebView`, selective permission grants, `RadioService` and `AudioBridge` startup baked in, a `DownloadListener` that queues into `DownloadManager` — with `ibFileName()` from `Content-Disposition` or the URL, falling back to `ACTION_VIEW` — and an `onShowFileChooser` that opens `ACTION_GET_CONTENT` with `EXTRA_MIME_TYPES`/`EXTRA_ALLOW_MULTIPLE` and returns the `Uri` via `onActivityResult` with `ValueCallback`) and the workflow copies it as `MainActivity.java`. Lightweight output and fast startup, at the cost of not having the Capacitor runtime: npm plugins don't exist and `inteebridge.js` only works for the methods with a web fallback (`share`, `vibrate`, `clipboard`, `storage`, `toast`, `dialog`); the ones that depend on a plugin (`Intee.location()`, `Intee.camera()`, `Intee.notifications.schedule()`) reject with "not available". `InteeAudio` does work, because the native bridge is injected into the class itself. Downloads can be disabled with `downloadManager: false` in the config.
- **`gecko`** — generates `gecko-MainActivity.java` (an `AppCompatActivity` that creates a `GeckoView`, opens the URL and bakes in the permissions with a GeckoView `PermissionDelegate`: it requests the Android permissions with code 4101 and returns `grant`/`reject` to the session, plus starting `RadioService` if `foreground` is present) and `patch-gecko-gradle.js`, which injects the `org.mozilla.geckoview:geckoview` dependency and the `https://maven.mozilla.org/maven2` repository into the `build.gradle` files. The workflow applies it in the `Apply GeckoView dependencies` step, so it compiles without touching anything by hand. The APK uses Capacitor's permission runtime for everything else. The file chooser goes through `PromptDelegate.onFilePrompt` (returns a `GeckoResult<PromptResponse>` and resolves it from `onActivityResult` with `FilePrompt.confirm(Context, Uri[])` or `FilePrompt.dismiss()`), and downloads through `ContentDelegate.onExternalResponse`: it first tries `DownloadManager` with `Content-Disposition`/URL and, if the URL isn't re-downloadable, copies the `body` to Downloads on a thread. Known limitation: GeckoView doesn't expose `addJavascriptInterface`, so **there's no `window.InteeAudio`** nor an `Intee.*` bridge under this provider (the handoff runtime in `catalog.js` detects it and does nothing: with the screen off the WebView's audio cuts out). The GeckoView AAR weighs ~200 MB, the download is slow and happens on every build.
- **`twa`** — generates `twa-manifest.json` and `assetlinks.json` so you can build the Trusted Web Activity with bubblewrap (the included README says so: `bubblewrap build --manifest=twa-manifest.json`). The APK the workflow compiles is still the normal WebView app with the Capacitor runtime; it isn't a TWA. Also, the `sha256_cert_fingerprints` in `assetlinks.json` is generated with placeholder zeros: you have to replace it with your signing certificate's real fingerprint before uploading it to `/.well-known/`.
- **`cordova`** — writes a real `config.xml` at the ZIP root (`<content src>`, `access`/`allow-intent`, `Orientation`, `Fullscreen`, `BackgroundColor` and the `android-minSdkVersion`/`android-targetSdkVersion`/`android-compileSdkVersion` preferences with your versions) and in CI runs the **`cordova-build`** job: `cordova platform add android`, injection of `main-manifest.xml`'s `<uses-permission>`/`<uses-feature>` into the generated manifest (plus `INTERNET` and `usesCleartextTraffic` if applicable), icon copied to the `mipmap-*` folders, and `cordova build android` (debug APK; AAB if you asked, with `continue-on-error`; signed release with your keystore via `build.json`). Capacitor's `compile` job is skipped with this provider. What it does **not** inherit: the batch runtime `NativePermissions`, `SpecialAccess`, `RadioService`/`AudioBridge` or `InteeBridge` (the web runs in the standard `CordovaWebView`); on iOS the build still goes through Capacitor. The Audit treats it as `CI_ANDROID` (compiles the APK in CI, permissions via the app's runtime).
- **`flutter`** — writes `flutter/pubspec.yaml` (webview_flutter 4 + permission_handler), `flutter/lib/main.dart` (WebView with `loadFlutterAsset('assets/www/index.html')` or `loadRequest` for a URL, controller initialized in `initState`), its own `AndroidManifest.xml` without `package=` (AGP 8 uses the scaffold's Gradle `namespace`), `flutter/assets/www/*` with your web content and a README. In CI the `flutter-build` job runs `flutter create` to generate the Android host, copies your manifest over it, adjusts `applicationId`/`namespace` to your package, moves `MainActivity.kt` to the right package and compiles: `-apk` and (if you asked for `aab`) `-aab` artifacts. Capacitor's `compile` job is skipped with this provider.
- **`tauri`** — writes `tauri/src-tauri/Cargo.toml`, `tauri/src-tauri/build.rs`, `tauri/src-tauri/tauri.conf.json` (`distDir: ../../www`, CSP with `unsafe-inline` for the injected scripts), `tauri/src-tauri/src/main.rs`, icons (`icons/*.png`, `icon.ico`, `icon.icns` built from your PNG; if your icon isn't a PNG the `bundle.icon` key is omitted) and a README. In CI the `tauri-build` job runs `cargo build --release` on `windows-latest` and uploads the `-exe` artifact. The Electron project (`desktop/`) is disabled with this provider so the `.exe` artifacts don't clash; the Android APK coming out of the `compile` job is still Capacitor's.
- **`react-native`** and **`ionic`** — are valid values in `normalizeConfig`, but they don't generate anything of their own: only a `provider.json` with that name remains, and the workflow builds them as if they were Capacitor. They don't appear in the studio.

The studio switches mark `capacitor`, `native`, `twa`, `gecko`, `cordova`, `flutter` and `tauri` as `READY` (all seven compile in CI); `react-native` and `ionic` don't appear.

## How to change it

Via the API:

```bash
curl -X POST /api/build -H "Content-Type: application/json" \
  -d '{"appName":"Mi App","url":"https://mi-web.com","provider":"native"}'
```

The ZIP always carries `provider.json`:

```json
{ "provider": "native", "version": "7", "webview": "Native WebView" }
```

## What actually changes between `capacitor` and `native`

Capacitor ships the full bridge (`Capacitor`, npm plugins, `BridgeActivity`) and that's why it supports the whole plugin catalog and `InteeBridge`. The native provider changes three things: the `MainActivity` is its own class that loads the URL or `file:///android_asset/public/index.html`, runtime permissions and special access are invoked directly from that class, and Capacitor's npm plugins don't exist.

If you're coming from `capacitor` and switch to `native`, review the Audit again: every permission whose `providerOk` doesn't include the new provider moves to `WARN` (those that don't declare that list stay at `OK`), and that lowers readiness even though it doesn't block the build.

## Permission compatibility

The Audit adds a `provider` column per row:

- `OK (<provider>)` — the provider is `READY` and the permission has an implementation declared for its runtime.
- `WARN (<provider> sin handler declarado para este permiso)` — the provider is `READY` but that permission doesn't declare a handler for its runtime (the APK compiles anyway).
- `WARN (<provider> compila APK en CI, permisos por runtime de la app)` — for `flutter`, `tauri`, `react-native`, `ionic` and `cordova`: the APK is built via the indicated route and the permissions are handled by the corresponding runtime.

A concrete example of why this matters: NFC with `NDEFReader` works in Chromium (Capacitor and Native) but in Gecko the Audit returns `WARN`.

## Ads (AdMob): current status

The generator emits configuration, not integration. If you check `ads` and fill in `admobAppId`, the ZIP includes `admob-config.json`, the manifest carries the `meta-data APPLICATION_ID`, and `normalizeConfig` enables the `@capacitor-community/admob` plugin.

What's **not** generated: `MobileAds` initialization, `AdView`, or interstitial/rewarded code. The Audit explicitly returns it as `NO GENERADO (requiere AdMob App ID + SDK, no incluido)` and treats it as `fail`, so a build with `ads` checked stays blocked until the implementation exists.

## Domain authentication (assetlinks)

`assetlinks.json` is generated whenever there's a domain (the `twaDomain` field, the deep link domain or your URL's hostname) and is also copied to `.well-known/assetlinks.json`. It works for both App Links and TWA. Remember what was said above: the certificate fingerprint it ships with is a placeholder.

More about what the generated app exposes in [security.md](./security.md); about what actually gets compiled, in [outputs.md](./outputs.md).
