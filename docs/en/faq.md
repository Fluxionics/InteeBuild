# Frequently asked questions

Short answers to the most common questions. Each one points to the guide where it's checked against the code.

## Which provider should I pick?

`capacitor` if you have no reason to change: it's the only one with all the patches tested (runtime permissions, special accesses, native audio, Droncito Pack). `native` if you want the lightest APK; `gecko` if you need the Mozilla engine; `twa`, `cordova`, `flutter`, and `tauri` for those particular ecosystems. All of them build in CI today. Details and limits for each are in [providers.md](./providers.md).

## Do Flutter and Tauri really build?

Yes. `flutter` launches the `flutter-build` job (Ubuntu + `flutter create` + `flutter build apk`) and delivers a `-apk` artifact and, if you asked for it, `-aab`. `tauri` launches `tauri-build` (Windows + `cargo build --release`) and delivers `-exe`. The workflow receives the provider as an input and skips or enables each job as appropriate. See [outputs.md](./outputs.md).

## How many builds can I do?

10 per hour per IP, plus 10 decompilations per hour. The limit is enforced on the server against your IP; when it's hit, the API responds `429`.

## Where do I see the full build log?

On the build's page, the console shows the log of every job and step (up to 500 KB per build). Via API: `GET /api/build/:id/logs`. If you need the raw detail, GitHub Actions keeps the run for as long as the branch and the artifact live (30 minutes).

## Does the iOS build work?

Yes. The workflow uses `pod install` and builds against `App.xcworkspace` (not `App.xcodeproj`), which is what's needed with Capacitor's pods. Without certificates, the `ios-build` step builds for the simulator with signing disabled; with `.p12` and `.mobileprovision` in the signing step, it archives for device. See [outputs.md](./outputs.md).

## Why does the audio cut out with the screen off?

Almost always one of these three: the URL is `blob:` (hls.js, YouTube), your HTML pauses on `visibilitychange`, or the build doesn't ship `foreground` + `streamUrl`. The `gecko` provider will never hand off to native because GeckoView doesn't allow `addJavascriptInterface`. Full checklist in [foreground.md](./foreground.md).

## What does each Audit badge mean?

`GENERATED OK` = the element is in the ZIP that's going to be compiled. `SPEC ONLY, NOT GENERATED` = you asked for it but it wasn't generated. `NO GENERADO` = there's no implementation (it blocks the build, like `ads`). In the provider column: `OK (<provider>)`, `WARN (<provider> sin handler declarado...)`, or `WARN (<provider> compila APK en CI...)`. See [permissions.md](./permissions.md).

## How big is the app?

The server limits are 7 MB for the icon and 500 KB for the HTML. The `native` APK is the lightest because it doesn't drag the Capacitor runtime along; with `gecko` the build takes quite a bit longer because `patch-gecko-gradle.js` downloads the AAR from Mozilla's `maven.mozilla.org` on every compilation.

## Can I build without the studio?

Yes: `POST /api/project` returns the ZIP with everything (workflow included) and you can upload it to your own GitHub repo. The `build-app.yml` workflow is the same one the server uses; the inputs are `id`, `platform`, `outputs`, and `provider`. See [api.md](./api.md).

## Are artifacts kept forever?

No: they live in GitHub Actions for 30 minutes and the server cleans them up the same way. The local history (`GET /api/history`) keeps the metadata and the link for as long as the entry lasts; if it expired, build again.

## Does the app work offline?

The PWA does: with `pwaEnabled` (on by default) the ZIP includes `manifest.webmanifest` and `sw.js` with an offline cache of your HTML. The Android app shows your web inside its WebView; the service worker's offline cache depends on your HTML and your server's headers. See [outputs.md](./outputs.md).

## What does each appearance choice affect?

`accentColor` goes into the manifest and the native colors, `splashColor` into the launch screen, `orientation` into the manifest and into the desktop window. The detail is in [ui-ux.md](./ui-ux.md).

If something breaks, start with [troubleshooting.md](./troubleshooting.md).
