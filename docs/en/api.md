# Developer API

The whole API lives under `/api` on the same server as the interface. The base URL is your domain or `http://localhost:8787`. Everything is JSON except the endpoints that return a ZIP, plain text, or PNG.

If you need a browsable view of the same endpoints, there's `developer.html`. `GET /api/docs` returns a JSON summary of the API along with the server version.

## Authentication

API keys aren't mandatory: as long as none exist, the API is open. Once you create the first one, `POST /api/v1/build` starts requiring it.

```bash
curl -X POST /api/keys -H "Content-Type: application/json" -d '{"name":"ci"}'
# → {"id":"…","key":"ib_…","keyHash":"…","prefix":"ib_…","scopes":["build","decompile","analyze"]}
```

The key is returned only once, in that response. On disk only its sha256 hash (`keyHash`) and the prefix (the first ten characters) remain, never the secret. `GET /api/keys` returns the masked form (`ib_1a2b3c4…` plus the last four of the hash), usage, last call, and status; `DELETE /api/keys/:id` performs a logical deletion by setting `revokedAt`, and that key stops working. The limit is 10 active keys.

It's accepted in two forms: `X-API-Key: ib_…` or `Authorization: Bearer ib_…`.

One detail worth knowing: the `scopes` are stored and can be limited when you create the key, but they aren't checked on any route. The real permission is "the key exists and isn't revoked".

You also have `GET /api/keys` for listing and revoking from your own client.

## Building

There are two entry points. The studio's doesn't ask for a key and responds with `id`; the versioned one may ask for it and responds with `buildId`.

```bash
curl -X POST /api/build -H "Content-Type: application/json" \
  -d '{"url":"https://mi-tienda.com","appName":"Mi Tienda","packageName":"com.miempresa.miapp","permissions":{"gps":true,"cameraMic":true}}'
# → 202 {"id":"abc123","branch":"build-abc123","status":"queued"}
```

```bash
curl -X POST /api/v1/build -H "Content-Type: application/json" -H "X-API-Key: ib_…" \
  -d '{"url":"https://mi-tienda.com","name":"Mi Tienda","package":"com.miempresa.miapp","output":"apk","template":"ecommerce"}'
# → 202 {"buildId":"abc123","status":"queued","branch":"build-abc123"}
```

`POST /api/build` accepts the full configuration: `url` or `htmlCode` with `inputType`, `appName`, `packageName`, `outputType` (`apk`/`aab`/`both`), `outputs` (list of formats: `apk`, `aab`, `xapk`, `apks`, `ipa`, `exe`, `msi`, `dmg`, `appimage`), `platform` (`android`/`ios`/`both`), `permissions`, `plugins`, `provider`, `template`, `streamUrl`, `nativeAudio`, `nativeAutoplay`, `orientation`, `iconBase64`, keystore and iOS signing, `webhookUrl`, `desktopEnabled`, and the rest of the fields the SDKs normalize.

`POST /api/v1/build` is deliberately narrower: it only recognizes `url`, `name`/`appName`, `package`/`packageName`, `output`/`outputType`, `outputs`, `platform`, `inputType` + `htmlCode`, `versionName`, `versionCode`, `compileSdk`, `targetSdk`, `minSdk`, `permissions`, `plugins`, `provider`, `template`, `streamUrl`, `nativeAudio`, `nativeAutoplay`, and `webhookUrl`. The icon and the UI flags don't go through there; use `/api/build` if you need them.

Errors you'll see before anything is launched: GitHub not configured returns `503` with the `.env` notice; a URL blocked by security returns `400`; HTML over 500,000 characters returns `400`; an icon over 7 MB returns `400`; and the limit of 10 builds per hour per IP returns `429`. That counter is the same one cloud decompilation uses, so a round of decompilations also eats into your build quota.

During the build the steps go through `Enviando proyecto a GitHub`, `Sincronizando workflow`, `Subiendo proyecto`, `Lanzando compilacion en GitHub Actions`, `En cola en GitHub Actions`, and `Compilando APK`, and they end in `Build completado` or `Build fallido`.

## Checking status and downloading

The studio polls every 3 seconds. You can do it as often as you like.

```bash
curl /api/build/abc123
# → {"id":"abc123","status":"building","step":"Compilando APK","runUrl":"https://github.com/…","apkUrl":null,"outputType":"apk"}
```

`status` goes `queued` → `building` → `success` or `failed`. If the build is no longer in memory, the endpoint checks the history and returns the entry with `fromHistory: true`; if it doesn't appear, `404`.

`GET /api/v1/build/:id` returns the same thing in a different shape: `apkUrl`, `aabUrl`, and `ipaUrl` relative to the API (or `null` if that artifact wasn't generated), plus `outputs` (what you asked for) and `formats` (what the artifact in GitHub Actions confirms exists).

```bash
curl /api/v1/build/abc123
# → {"buildId":"abc123","status":"success","apkUrl":"/api/download/abc123","aabUrl":null,"ipaUrl":null,"outputs":["apk"],"formats":["apk"]}
```

Downloads:

- `GET /api/download/:id` — APK.
- `GET /api/download/:id/aab` — AAB.
- `GET /api/download/:id/ipa` — IPA, only if there was Apple signing.

All three work the same way: they look up the run's artifact, open the ZIP that GitHub Actions uploaded, and return the loose binary with its extension (if they can't find the binary, they return the whole ZIP). If the build is still in progress they respond `404` with "Build aun en progreso".

There's one condition worth remembering: the download needs the build to be in the server's memory. If the process restarted, the endpoint responds `404` even though the artifact exists on GitHub. History is for querying status and configuration, not for downloading.

Artifacts are served from GitHub Actions and expire after 30 minutes. `GET /api/apk-info/:id` returns an artifact sheet (name, size in MB, links for each) only once the build has finished. `GET /api/build/:id/logs` returns the run log truncated to 80,000 characters, and only if the build already has a `runId`.

The server polls GitHub every 6 seconds and makes 200 attempts: if they run out, the build moves to `failed` with "Tiempo de espera agotado consultando GitHub" and the branch is deleted after 60 seconds.

To request the project uncompiled:

```bash
curl -X POST /api/project -H "Content-Type: application/json" -d '{"url":"https://mi-tienda.com","template":"ecommerce"}' -o proyecto.zip
```

## Templates

```bash
curl /api/templates
curl /api/templates/radio
curl /api/templates/radio/native
```

The list brings `id`, `name`, `description`, `hasFace`, and the summarized audit (`ok`, `total`, `readiness`, `canBuild`). The detail includes `config` and `faceHtml`. The third generates the manifest, the Java/XML files, and the audit in memory without compiling. Details for each template are in [templates.md](./templates.md).

## Permissions and readiness

```bash
curl /api/permissions/spec
curl -X POST /api/permissions/audit -H "Content-Type: application/json" -d '{"appName":"Mi Tienda","url":"https://mi-tienda.com","permissions":{"cameraMic":true}}'
curl -X POST /api/permissions/suggest -H "Content-Type: application/json" -d '{"url":"https://mi-tienda.com"}'
curl -X POST /api/build-readiness -H "Content-Type: application/json" -d '{"appName":"Mi Tienda","url":"https://mi-tienda.com","permissions":{"gps":true}}'
```

`spec` returns the Permission Engine entries (86 in the current version). `audit` returns one row per permission with `status` (`ok`/`warn`/`fail`), `minSdk`, the native implementation, and whether the provider supports it, plus `ok`, `total`, `canBuild`, `verifiedAll`, and `readiness`. `suggest` accepts `{html}`, `{url}`, or `{detectedApis}` and responds `{detected, suggested, count}`.

`build-readiness` is the one the Build step uses. It returns `readiness` (0-100), `checks`, `audit`, `warnings`, and `canBuild`. `canBuild` is only `true` if the audit passes, there's a URL or HTML, and native audio has its stream. A typical warning is "Audio nativo activo pero sin URL del stream: pon tu servidor en Audio nativo", which blocks the radio until you fill in `streamUrl`.

**Foreground + WifiLock**: if `permissions.foreground` is enabled, the generator now includes `WifiLock` (`WIFI_MODE_FULL_HIGH_PERF`, wrapped in `try/catch`) to stop the audio from cutting out when the screen turns off because of WiFi power saving. The `WakeLock` (PARTIAL) also stays active. See `foreground.md` for the details of the background service.

The `provider` field in the configuration now propagates correctly to `build-config.json` (it used to get lost with broken escapes in the workflow) and the pipeline uses that value to decide whether to inject the native/gecko `MainActivity` or the Capacitor bridge.

`POST /api/manifest-diff` compares what you asked for with what gets generated: it returns `requested`, `generated`, `missing`, `unexpected`, and `rows` with `MATCH` or `MISSING` status per permission. It's for catching permissions that never made it into the manifest before you build.

## Web analysis

```bash
curl "/api/analyze?url=https://mi-tienda.com"
curl -X POST /api/analyze/html -H "Content-Type: application/json" -d '{"html":"<html>…</html>"}'
curl -X POST /api/analyze/fix -H "Content-Type: application/json" -d '{"html":"<html>…</html>"}'
```

`GET /api/analyze` downloads the page with a 10-second timeout, checks HTTPS, viewport, manifest, favicon, theme-color, service worker, resources using `http://`, Open Graph, and structured data, and returns a `score` from 0 to 100 with its diagnosis. Alongside that it delivers `frameworks`, `detectedApis`, `recommendations`, `security` (score with findings), `errors`, `optimization`, and `autoFix.preview` with the first 8,000 corrected characters. If the page has a manifest, it tries to download it to return `pwa`. It rejects HTML over 500,000 characters and blocked URLs.

`POST /api/analyze/html` does the same analysis on submitted HTML, with the limit at 600,000 characters, and additionally returns `autoFix.full`. `POST /api/analyze/fix` returns `{fixed, originalLength, fixedLength}` with no diagnosis.

## Inspector, decompiler

```bash
curl -X POST /api/inspect -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
curl -X POST /api/decompile -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
curl -X POST /api/decompile/cloud -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
curl /api/decompile/cloud/abc123/status
curl -L -o salida.zip /api/decompile/cloud/abc123/download
```

`/api/inspect` returns a technical sheet (`packageName`, version, size, file count, `.dex`, `.so`, icons), detected permissions, `riskyPermissions`, `findings`, and a `security.score`. Accepts up to 30 MB and at least 100 bytes.

`/api/decompile` works locally: it accepts `apkBase64` (with or without the `data:` prefix) or an `application/octet-stream` body, up to 100 MB. It returns `meta`, `importConfig`, `sourceZipBase64`, and `manifestPreview`.

`/api/decompile/cloud` uploads the APK to a `decompile-<id>` branch and launches a workflow with `jadx 1.5.1 + apktool 2.9.3`. It responds `202` with `statusUrl`, `downloadUrl`, and a notice that the APK is deleted from the branch after 20 minutes. The limit is 60 MB and it shares the rate limit of 10/hour per IP. The status returns `status`, `conclusion`, `runUrl`, `artifacts`, and `ready`; the client waits with 5-second polling and a 5-minute cap. The downloaded ZIP brings `output/sources` (Java), `output/resources` (res and smali), `AndroidManifest-decoded.xml`, and `REPORT.txt`.

## Listing, security, and privacy

```bash
curl -X POST /api/listing -H "Content-Type: application/json" -d '{"appName":"Mi Radio","packageName":"com.miempresa.radio","template":"radio"}'
curl -X POST /api/security-audit -H "Content-Type: application/json" -d '{"appName":"Mi App","url":"https://mi-web.com","permissions":{"cameraMic":true}}'
curl "/api/privacy-policy?appName=Mi%20App&package=com.miempresa.miapp"
```

`/api/listing` returns `{ok, listing}` with `title`, `shortDescription`, `fullDescription`, `keywords`, `category`, and `packageName`, within the limits Play Console imposes.

`/api/security-audit` returns `score`, `level`, the permission `audit`, `issues` (sensitive permissions, cleartext), and a `gdpr` list of three checks: linked privacy policy, unnecessary sensitive permissions, and your own keystore. The score deducts 20 points per permission in `fail`, 5 per `warn`, and 5 per high-severity finding.

`/api/privacy-policy` returns plain text with the data you pass it. It's a base to fill in, not a finished legal document.

## Versions and CI/CD

```bash
curl -X POST /api/versions/publish -H "Content-Type: application/json" -d '{"appId":"com.miempresa.miapp","version":"1.0.1","changelog":"fix"}'
curl "/api/check-update?appId=com.miempresa.miapp&version=1.0.0"
curl "/api/versions/com.miempresa.miapp"
curl -X POST /api/cicd -H "Content-Type: application/json" -d '{"repo":"usuario/mi-web","branch":"main","baseUrl":"https://tu-dominio.com"}'
```

`versions/publish` stores up to 20 entries per `appId` with `version` (format `1.0.1`), `changelog`, and a date. `check-update` compares against the latest published and responds `{updateAvailable, latest, changelog}`. There's no OTA client embedded in the app: it's a registry you can query from wherever you like.

`cicd` returns the content of `.github/workflows/inteebuild-auto.yml` for you to upload to your repo, along with the `curl` that triggers the webhook. The real integration is `POST /api/git/connect` with `{repo, branch, token, webhookUrl}`, which stores the token hashed; then `POST /api/git/webhook` with `{"repository":{"full_name":"usuario/repo"},"ref":"refs/heads/main"}` starts a build with the config you send or a minimal one derived from the repo. `GET /api/git/integrations` lists and `DELETE /api/git/:id` deletes.

## Webhooks

`webhookUrl` receives POST with JSON. The events are `build.completed`, `build.failed`, and `build.error` (an error sending the project to GitHub, before anything runs).

## Assorted utilities

- `GET /api/health` — `{ok, service, version, githubReady}`.
- `GET /api/diag` — checks token, repo, branch, and workflow on GitHub and returns a `hint` per step so you know what's missing in `.env`.
- `GET /api/history`, `GET /api/history/:id`, `DELETE /api/history/:id` — local history. The listing returns the first 30 entries of the file, which itself stores at most 50; `:id` returns the full entry with the config that was used.
- `GET /api/stats` — totals by status and by `outputType`, plus the average duration of finished builds.
- `GET /api/qr/:id` — PNG of the download link.
- `GET /api/cleanup?secret=…` — forces cleanup of expired artifacts. Requires `CLEANUP_SECRET` in the environment; without it the endpoint returns `403`.
- `GET /api/ads/:slot` and `GET /api/ad-proxy?u=` — your own ad network, with caching and a creative proxy (`u` is the URL to download).

More on limits and deployment in [production.md](./production.md); on what comes out of each build, in [outputs.md](./outputs.md).
