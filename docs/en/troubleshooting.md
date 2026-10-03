# Troubleshooting

The cases in this list are the ones that come up most often. Start by reading the full message: most of them say exactly what's missing.

## The Build button doesn't go anywhere

Before launching anything, the studio calls `POST /api/build-readiness` and, if `canBuild` is `false`, shows the `warnings` in red and doesn't build. The most common warnings:

- `Audio nativo activo pero sin URL del stream: pon tu servidor en Audio nativo` — the radio or streaming template ships with `nativeAudio` enabled and the stream field empty. Fill it in on the Settings step, native audio card.
- `streamUrl debe empezar con http:// o https://` — the URL is missing its scheme.
- `Falta URL o HTML` — there's no source in step 1.
- `X requiere Android N+` — a permission requires a higher `targetSdk`. Bump the SDK or drop the permission.

If the readiness check doesn't respond, the studio tries to build anyway and shows you the server's real error.

On the QA step there's also a list of points that turns red. With one failing, or without accepting the terms, the continue button stays disabled: that's intentional, but the message above tells you what to fix.

## The build doesn't even start

- `503 "GitHub no configurado..."` — `GITHUB_TOKEN` or `INTEE_BUILDS_REPO` missing. Check `/api/diag`.
- `429` with `Limite de builds alcanzado (10 por hora)` — the counter is per IP and is shared by `/api/build`, `/api/v1/build`, and `/api/decompile/cloud`. Wait for the hour to pass.
- `400` with a validation message — the text explains it: app name, package ID, version, blocked URL, HTML over 500,000 characters, or an icon over 7 MB.
- `401` on `/api/v1/build` — at least one API key already exists and you're not sending any. Create one with `POST /api/keys`.

## GitHub Actions failed

Open the run link from the build result or from `/api/build/:id`. Common errors:

- **`422 No workflow found with any ref`** — the workflow isn't registered on the base branch yet. The server retries on its own, up to six times with increasing backoff; if it keeps failing, wait a few seconds and launch again.
- **Gradle failure** — almost always the SDK or a dependency. Try `compileSdk` and `targetSdk` 35, which are the values the generator is tested with. The run's steps are named `Compile APK`, `Compile Release APK`, `Compile AAB`, and `Compile Release AAB`.
- **`package org.mozilla.geckoview does not exist`** — the `Apply GeckoView dependencies` step didn't run or its patch failed: the log should show `geckoview` after `grep -c geckoview android/app/build.gradle`. If the ZIP came from an older version of the generator, regenerate the project; if it's still missing, switch to `capacitor` or `native`.
- **The workflow finishes with no artifact** — the requested output (`apk`, `aab`, or `both`) doesn't match what was compiled, or Gradle never got to package. Look at the run's `Compile APK` and `Compile AAB` steps.

## The APK won't download

1. Check that the build reached `success`.
2. `/api/download/:id` needs the build to still be in the server's memory: if the process restarted, it responds `404` even though the artifact exists on GitHub.
3. Branches are deleted about a minute after completion, and the automatic sweep every 30 minutes removes runs and artifacts older than 30 minutes. If it expired, build again.
4. `404 "AAB no encontrado"` means you asked for APK; `IPA no encontrado (firma iOS requerida)` means there were no Apple certificates.

## The app opens blank

- If you turned off the HTTP (cleartext) traffic option, the manifest ships with `android:usesCleartextTraffic="false"` and an `http://` URL won't load: you'll see white. Turn it back on or use HTTPS. By default the manifest does allow cleartext.
- Check that your site allows embedding: `X-Frame-Options` or `Content-Security-Policy: frame-ancestors` headers on your server block the WebView and you see an empty screen.
- Check your site's console with the app open: the JavaScript errors are the same ones you'd get in the browser.
- With the `flutter` provider the APK comes from the `flutter-build` job (see its `Build APK`/`Build App Bundle` steps), not from `Compile APK`. With the `cordova` provider it comes from the `cordova-build` job (`Compile Cordova APK` steps). With the `tauri` provider the APK is still the Capacitor one and there's also a `.exe` from the `tauri-build` job. The `gecko` provider does compile a different APK: the `MainActivity` is GeckoView.

## Permission denied on Android

1. Download the project with `POST /api/project` and check that `main-manifest.xml` includes the permission.
2. Grant the permission manually from Android Settings the first time.
3. If your web app asks for the camera and you didn't tick `cameraMic`, the generated `WebChromeClient` doesn't include that resource in the allowed list and responds `deny()`. Tick the permission and rebuild.
4. Permissions with a high `minSdk` give a `warn` in the Audit if your `targetSdk` is lower; bump the SDK.

## Audit and readiness in red

- `gpsBackground sin gps` — also enable precise location.
- `SPEC ONLY, NOT GENERATED` on a row — the permission is in the spec but didn't make it into the generated manifest; usually a case that needs another base permission.
- `NO GENERADO` — there's no implementation for that element (that's what happens with `ads`). The Audit treats it as a failure and blocks the build.
- Row with `REQUIRES ANDROID N+` — raise `targetSdk` or drop the permission.
- If the continue button is disabled, there's a `fail` in the Audit: fix it rather than forcing it.

## Analyzer with a low score

- No HTTPS: the analyzer deducts 10 points and the security module takes 25 off its own score. The first thing to fix.
- No `viewport`: deducts 10 (with it you gain 20); add `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- No service worker or manifest: you don't get the 15 and 10 points they would have added, and `checks.pwa` stays `false`.
- Resources using `http://`: deducts 2 per resource, capped at 20. The security module counts those separately.
- If the score is low, apply the Auto-Fix and review the diff: the fix is heuristic and may leave an empty `alt=""` or force `https://` on a resource that doesn't exist.

## Errors in the browser console

- `ERR_BLOCKED_BY_CLIENT` against an ad domain — it was an adblocker. Ads are now served from your own domain via `/api/ads/:slot`; if it still appears, hard-reload or redeploy.
- `cdn.tailwindcss.com should not be used in production` — a Tailwind warning, breaks nothing.
- `No label associated with a form field` — accessibility warning, blocks nothing.
- `Uncaught SyntaxError` when loading the editor — hard-reload.

## Form validation

- Name: letters, numbers, spaces, hyphens, and dots, from 2 to 40 characters.
- Package ID: lowercase, numbers, and underscore, with at least one dot (`com.miempresa.miapp`).
- Version: numbers with dots (`1.0.0`).
- SDK: if the value isn't in the list of valid ones, the server substitutes a valid one instead of rejecting it.
- Empty HTML with HTML as the source: rejected; paste your code or use a template's face.

## Decompiler

- `413` or "APK demasiado grande" in cloud mode: 60 MB is the cap; the local one goes up to 100 MB.
- `Rate limit: 10/h por IP`: it's the same counter as builds.
- `409 Workflow todavía corriendo`: wait and retry the download.
- `404 El workflow terminó sin artefacto`: look at the run's logs; obfuscated APKs usually fail here.
- `500 Configura GITHUB_TOKEN...`: the same setup you need for building is missing.

## Server diagnostics

`/api/diag` walks token, repo, branch, and workflow and stops at the first one that fails, with a `hint` saying what to change. If it returns `ok: true` and the build still fails, the problem is in the GitHub run: open its logs. The detail of each field is in [production.md](./production.md).

If the problem is permissions, the reference is [permissions.md](./permissions.md); if it's background audio, [foreground.md](./foreground.md).
