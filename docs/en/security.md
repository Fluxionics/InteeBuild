# Security

InteeBuild works on two fronts: what the server does to avoid being an attack vector, and what it generates into the APK so the app doesn't leak anything. This page describes what's implemented today, along with its limits.

## On the server

### Outgoing URLs

`isBlockedUrl` is applied on `/api/build`, `/api/project`, `/api/analyze`, on the redirects returned by the analyzer and on the PWA manifest download. It blocks:

- Any protocol other than `http` or `https`, and URLs that can't be parsed.
- Private or local hosts: `localhost`, `127.*`, `10.*`, `192.168.*`, `172.16-31.*`, `0.0.0.0`, `::1`, `fc00:*`, `fe80:*` and `169.254.*`.
- Cloud metadata endpoints: `169.254.169.254`, `metadata.google.internal` and `100.100.100.200`.

That stops an attacker from turning the analyzer or the build into a proxy to the server's own internal network. It doesn't protect against public destinations: any public URL stays valid, because that's what the product is for.

### Sizes and rate limit

- HTML: 500,000 characters on `/api/analyze`, `/api/build` and `/api/project`; 600,000 on `/api/analyze/html`.
- Icon: 7 MB of base64 on `/api/build`.
- Bodies: `express.json` at 110 MB and `express.raw` at 100 MB.
- APK: 100 MB in the local decompiler, 60 MB in the cloud, 30 MB in `/api/inspect`.
- Rate limit: 10 operations per hour per IP on `POST /api/build`, `POST /api/v1/build` and `POST /api/decompile/cloud`. The counter is shared across all three, so using one consumes the quota for the others.

The limit lives in memory, so it's lost when the process restarts.

### API keys

They're stored only as a sha256 hash (`keyHash`) plus the ten-character prefix; the secret isn't persisted. `GET /api/keys` returns the masked hash, and `DELETE /api/keys/:id` performs a logical delete with `revokedAt`, after which the key stops authenticating. Both `X-API-Key` and `Authorization: Bearer` are accepted.

Two limits worth knowing: `scopes` are stored but not checked on any route, and as long as no key exists the entire API is open. Create the first key before exposing the server.

### CORS and headers

`CORS_ORIGIN` in the `.env` sets the allowed origin. If it's empty any origin is reflected, which is the development mode; in production set your domain.

Every response carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin` and `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

### Secrets in responses

`/api/health` only says whether GitHub is configured. `/api/diag` checks token, repo, branch and workflow and returns text guidance, never the token's value. The history stores each build's config, but without passwords: `iconBase64`, keystore and iOS are stripped before the entry is written.

### Webhooks

`webhookUrl` receives a POST with flat JSON (`build.completed`, `build.failed`, `build.error`) and an 8-second timeout. It carries no HMAC signature: if your receiver is sensitive, require your own token in the URL or validate the origin.

## In the generated app

### FLAG_SECURE

The `flagSecure` option adds the `FLAG_SECURE` flag to `MainActivity`'s window, which blocks screenshots and screen recording of that activity. It comes enabled in the `empresa`, `dashboard`, `finanzas` and `banking` templates.

### Selection blocking

`blockSelection` injects CSS into your HTML (`user-select: none` mostly, except for text fields) and also goes through the catalog script. It's in `finanzas` and `banking`. It prevents copying data with a long press; it's not cryptography or encryption.

### What does nothing today

The `banking` template ships with `screenCaptureSecurity: true` and `emergency` ships with `highPriority: true`, but neither field is in `normalizeConfig`, so they never reach the manifest or the code. The notification channels block (`notifChannel`, `notifImportance`, `notifSound`, `notifVibration`) is normalized, but no generator reads it today either: it doesn't change the priority of anything.

### Permissions

The Permission Engine has 86 entries and 52 of them are runtime ones. The idea is least privilege: `gps` and `gpsBackground` are different permissions with different Play Store justifications, `bluetoothScan`, `bluetoothConnect` and `bluetoothAdvertise` can be requested separately, and so can `useExactAlarm` and `scheduleExactAlarm`. The Audit checks the manifest, runtime permissions, native implementation, JavaScript bridge and provider compatibility, and returns `canBuild` only if everything fits.

One case that blocks on purpose: `ads` returns `NO GENERADO` because the generator doesn't write the AdMob initialization or the ad views, and the Audit treats it as a failure.

### Signing

Your own signing is optional and configured with your keystore (`useCustomSigning` only activates if there's a password and an alias). Keystores aren't shared between builds, the signing config is stripped from the history, and the APK download always goes through your server. iOS builds only sign if you send `.p12`, `.mobileprovision` and a password.

### Foreground service

The audio service is declared with `android:exported="false"` and `foregroundServiceType="dataSync|mediaPlayback"` (plus `location` if `advGeo` is also present), with the `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC` and `FOREGROUND_SERVICE_MEDIA_PLAYBACK` permissions. The notification is permanent so the system doesn't kill the service. Details are in [foreground.md](./foreground.md).

## On GitHub Actions

Each build pushes to a `build-<id>` branch and runs on an ephemeral runner. The branch is deleted about a minute after finishing, and the automatic 30-minute sweep removes branches older than 5 minutes and runs and artifacts older than 30 minutes. That limits how long your HTML and your APK stay in the builds repo.

The token the server uses must be fine-grained, with `Contents: Read/write` and `Actions: Read/write` scoped only to the builds repo. The workflow itself doesn't use GitHub secrets: everything it needs travels in the build branch. If you send your own keystore, that temporary ZIP includes `user-keystore.jks` and `signing.properties` with passwords in plain text, and the branch is deleted 60 seconds after the run finishes; the 30-minute sweep cleans up any leftovers. Use a release keystore you can afford to rotate if that gap worries you, and a private builds repo.

## Data and privacy

There's no database: `data/builds.json`, `data/apikeys.json`, `data/git-integrations.json` and `data/versions.json` are local files. The HTML code you send is uploaded to the builds repo during the build and leaves with the branch. The generic policy you can link on Play comes from `GET /api/privacy-policy` and is meant for you to adapt, not to publish as-is.

For the end user, the practical advice is: grant only the permissions the app requests, check where the APK came from and keep the app updated. Which permission does what is detailed in [permissions.md](./permissions.md).

## Play Store compliance

Sensitive permissions (`phone`, `sms`, `systemAlert`, `installPackages`, `gpsBackground`) require justification on the Play listing. `ACCESS_BACKGROUND_LOCATION` has its own form and approval. `USE_EXACT_ALARM` is only accepted for clock, calendar or alarm apps. `POST /api/security-audit` flags those permissions and returns the three GDPR checklist items that depend on you: linked policy, unnecessary permissions and your own keystore.

## Manual verification

After a build, check the ZIP in your terminal:

```bash
unzip -p proyecto.zip main-manifest.xml | grep "uses-permission"
unzip -p proyecto.zip MainActivity.java | grep "NativePermissions"
unzip -p proyecto.zip main-manifest.xml | grep "RadioService"
```

And with the API:

```bash
curl -X POST /api/manifest-diff -H "Content-Type: application/json" -d '{"url":"https://mi-web.com","permissions":{"gps":true}}'
curl -X POST /api/security-audit -H "Content-Type: application/json" -d '{"url":"https://mi-web.com","permissions":{"gps":true}}'
```

`manifest-diff` tells you what you requested and what showed up, with `missing` and `unexpected`. `security-audit` returns a score, issues and the GDPR list.

## Responsibilities

On the app developer's side: don't put secrets in the HTML, use HTTPS, validate on the backend whatever your web app validates, and review the Audit before every build whenever you change permissions. On InteeBuild's side: generate the manifest and the handlers you requested, validate inputs on the server and keep the limits active. Neither replaces the other.

More in [permissions.md](./permissions.md), [foreground.md](./foreground.md) and [production.md](./production.md).
