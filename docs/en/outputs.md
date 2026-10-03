# Build outputs

The classic `outputType` still accepts three values: `apk`, `aab`, and `both`. Above it sits `outputs`, a list (it also accepts comma-separated text) that overrides it: `apk`, `aab`, `xapk`, `apks`, `ipa`, `exe`, `msi`, `dmg`, `appimage`. The workflow has one step per format, gated on the list, so only the one you asked for runs, and the `platform` field (`android`, `ios`, or `both`) decides whether the Android jobs, the iOS jobs, or both get launched. When `platform` is `ios` or `both`, the ZIP's `package.json` includes `@capacitor/ios` so the `npx cap add ios` step doesn't fail with "Could not find the ios platform". The `GET /api/v1/build/:id` endpoint returns `outputs` and `formats`, the second with what the artifact confirms actually exists.

## What you download when the build finishes

Each format has its own path at `GET /api/download/:id/:fmt`; without a suffix, APK is assumed.

- **APK** — `GET /api/download/:id` (or `.../apk`). Installable straight onto a device. With the `flutter` provider it's built by the `flutter-build` job; with the `cordova` provider by the `cordova-build` job; not the Capacitor one.
- **AAB** — `GET /api/download/:id/aab`. What Play Console uploads. Only shows up if you asked for it in `outputs`. With the `flutter` provider it comes out of the `flutter-build` job; with `cordova` it's attempted with `--packageType=bundle` (if that version of cordova-android doesn't support it in debug, the step doesn't block and there's no AAB).
- **XAPK** — `GET /api/download/:id/xapk`. Base APK plus an `AndroidManifest.json` with package, version, and permissions. Only if you asked for `xapk`.
- **APKS** — `GET /api/download/:id/apks`. Bundletool in universal mode, generated from the AAB. Only if you asked for `apks`.
- **IPA** — `GET /api/download/:id/ipa`. Only exists if the build ran on `macos-latest` with `.p12`, `.mobileprovision`, and the password sent in the iOS signing step. Otherwise there's no artifact and the endpoint returns an error.
- **EXE and MSI** — `GET /api/download/:id/exe` and `.../msi`. Electron EXE: a `windows-latest` job with `electron-builder`, only runs if you asked for that format and the ZIP ships `desktop/`. Tauri EXE: if the provider is `tauri`, the `tauri-build` job uploads the Cargo binary with the `-exe` artifact even if you didn't request a desktop format. MSI: Electron only.
- **DMG** — `GET /api/download/:id/dmg`. A `macos-latest` job, same conditions as the EXE.
- **AppImage** — `GET /api/download/:id/appimage`. An `ubuntu-latest` job, same conditions.

A format not in the list above returns `404` with the supported formats. Artifacts live in GitHub Actions and expire after 30 minutes; the server also deletes them during its automatic cleanup. The history (`GET /api/history`) keeps the link for as long as the local entry lasts.

On top of that, the project ZIP is available uncompiled with `POST /api/project`, with any configuration: it includes `build-config.json`, `main-manifest.xml`, the generated Java code, the patch scripts, and the workflow.

## What is only source code in the ZIP

- **Desktop** — if you enable `desktopEnabled` **or request `exe`, `msi`, `dmg`, or `appimage` in `outputs`** (the engine auto-enables `desktopEnabled` in that case), a `desktop/` folder appears with an Electron project (`package.json`, `main.js`, README), and the studio's "Desktop .EXE/.APP" selector writes to that folder. To actually get a binary you must request `exe`, `msi`, `dmg`, or `appimage` in `outputs`: then the workflow runs `electron-builder` on Windows, macOS, or Linux depending on the format. `desktopPlatform` (`win`, `mac`, `both`) is validated, saved to `build-config.json`, and used by the `desktop/package.json` generator to set the `electron-builder` targets.
- **TWA** — `twa-manifest.json`, `assetlinks.json`, and a README with the bubblewrap command. The real Trusted Web Activity is built outside, with your own tools.
- **`react-native` and `ionic`** — they generate nothing beyond `provider.json`; the APK that comes out is the Capacitor one.

## Flutter, Tauri, and Cordova in CI

- **Flutter** (`provider: flutter`) — the `flutter-build` job on `ubuntu-latest` runs `flutter create` to generate the Android host, layers your manifest on top, fixes `applicationId`/`namespace` to your package, moves `MainActivity.kt`, and compiles with `flutter build apk --release` (plus `appbundle` if you asked for `aab`). Artifacts: `-apk` and optionally `-aab`. Capacitor's `compile` job is skipped with this provider, so there's no double APK.

- **Tauri** (`provider: tauri`) — the `tauri-build` job on `windows-latest` runs `cargo build --release --manifest-path tauri/src-tauri/Cargo.toml` and uploads the binary as the `-exe` artifact. The Electron project (`desktop/`) is left out with this provider so it doesn't collide on the artifact name, and the Android APK is still produced by the `compile` job (it's still Capacitor underneath).

- **Cordova** (`provider: cordova`) — the `cordova-build` job on `ubuntu-latest` runs `cordova platform add android` on your real `config.xml`, injects the permissions from `main-manifest.xml` into Cordova's manifest, copies the icon into the `mipmap-*` folders, and runs `cordova build android` (debug `-apk` artifact; optional `-aab` with `continue-on-error`; `-release-apk` if you uploaded a keystore, via `build.json`). Capacitor's `compile` job is skipped with this provider: the APK is pure Cordova.

The workflow receives the provider as an input (`provider`), which the server sends in the `workflow_dispatch` along with `id`, `platform`, and `outputs`.

## PWA inside the project

With `pwaEnabled` turned on (it's on by default) the ZIP includes `www/manifest.webmanifest` with name, colors, and icon, plus `www/sw.js` with an offline cache and a fallback to `index.html`. The service worker registration and the `manifest` tag are injected into your `index.html` if they weren't there.

You don't need to host anything on InteeBuild for this: upload the `www/` folder to your hosting and the site becomes installable as a PWA on its own. Turn it off with `pwaEnabled: false` if your site already ships its own manifest.

## Play Store listing

`POST /api/listing` returns text ready to paste into Play Console, generated with local rules and no external services:

```bash
curl -X POST /api/listing -H "Content-Type: application/json" \
  -d '{"appName":"Mi Radio","url":"https://mi-radio.com","packageName":"com.miempresa.radio","permissions":{"foreground":true}}'
```

The response brings `title` (trimmed to 30 characters), `shortDescription` (80), `fullDescription` (up to 4000, with the features derived from your permissions and UI flags), `keywords` (100), `category` (`Herramientas`), `packageName`, and `version`. It's a draft: worth rewriting before you publish.

There's also `POST /api/security-audit` (a textual score with GDPR and permission findings) and `GET /api/privacy-policy?appName=&package=` (a generic policy filled in with your data).

## Download QR

`GET /api/qr/:id` returns a PNG image with the QR of the download link. The image is generated by an external service (`api.qrserver.com`); if it doesn't respond within 8 seconds, the endpoint returns `502` with the download link as text so you can display it yourself.

## Minification

The `minify` option (or `minify: true` in the API) strips HTML comments and leftover whitespace from the code it injects. It doesn't touch your JavaScript and it isn't a production minifier: it just makes the embedded HTML weigh less.

## What's missing

There's no iOS build without Apple certificates (the job only validates in the simulator; with `.p12` and `.mobileprovision` it does export the IPA), no store or distribution of your own, and no paid plan behind any of this. What there is, are server usage limits: 10 builds per hour per IP and the input sizes detailed in [production.md](./production.md).
