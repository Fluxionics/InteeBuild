# Quickstart

This guide takes you from a web page to an installable APK using the studio in `index.html`. It takes a few minutes to set up; the real wait is GitHub Actions, between three and six minutes per build on a free runner.

## 1. Prepare your source

The studio accepts two inputs in the **Application** step:

- **URL**: must start with `http://` or `https://` and be public. localhost, private IPs and cloud metadata endpoints are blocked for security (`isBlockedUrl` in `server/url-guard.js`), and that same rule is applied on `/api/build` and `/api/project`.
- **Direct HTML**: paste your code. The limit is 500,000 characters; if your page is bigger, minify it before pasting.

Before moving on, hit **Analyze web health**. It returns a score from 0 to 100 along with the specific issues (HTTPS, viewport, favicon, `http://` resources). It's not a requirement to build, but almost every "blank screen" problem starts there. Details are in [analyzer.md](./analyzer.md).

## 2. Template or permissions by hand

If you don't know what permissions your app needs, pick a template (there are 29, see [templates.md](./templates.md)): it only preloads permissions, orientation and UI flags — it never touches your HTML.

If you check them by hand, only check what your web app actually uses. Google Play rejects sensitive permissions without a justification (SMS, phone, overlay) and the Audit will flag inconsistencies like `gpsBackground` without `gps`.

## 3. Customize

Fields with strict validation, because they're usually the cause of a 400:

- **Name**: letters, numbers, spaces, hyphens and dots, from 2 to 40 characters. Example: `Mi Tienda`.
- **Package ID**: lowercase, numbers and underscores, with at least one dot. Example: `com.miempresa.miapp`. If you leave it empty, `com.inteebuild.<slug>` is generated.
- **Version**: numbers separated by dots, up to four components. Example: `1.0.0`.
- **Output**: `apk`, `aab` or `both`. There are no others: no desktop or iOS binaries are generated except what's noted below.
- **Icon**: PNG, JPG or WebP as a data URL. The limit is 7 * 1024 * 1024 base64 characters.

The rest (orientation, splash, colors, drawer, JS injection) is documented in [ui-ux.md](./ui-ux.md).

## 4. Review and build

In the **QA** step you'll see the Audit and readiness. If the build button complains, the reason is one of these:

- `Falta URL o HTML` — go back to step 1.
- `Audio nativo activo pero sin URL del stream` — the Radio template ships with `nativeAudio: true` and an empty `streamUrl` on purpose; paste your stream in the Settings step (see [foreground.md](./foreground.md)).
- A permission in `fail` in the Audit — fix it instead of forcing the build.

When building, the server uploads the project to a `build-<id>` branch in your repo and dispatches the workflow. Progress is polled every 6 seconds (up to 200 attempts) and the logs are kept at `GET /api/build/:id/logs` and at the GitHub Actions link.

When it finishes, download the APK from the result. To install it on Android you need to allow "install unknown apps" for the browser or file manager you use.

## Limits you'll run into

- 10 builds per hour per IP. If you hit 429, wait for the window to expire.
- Build branches are deleted when the run finishes (one minute later) and GitHub artifacts expire after 30 minutes: if the download link expired, build again.
- History is stored on local disk (`data/history.json`), 50 entries, and `GET /api/history` returns the last 30. On Render free the disk is wiped on restart.

## Next steps

- If something fails: [troubleshooting.md](./troubleshooting.md).
- Permissions with real tests: [permissions.md](./permissions.md).
- Radios and podcasts: [foreground.md](./foreground.md).
- Automation from your backend: [api.md](./api.md) and the `developer.html` panel.
- The **JSON** button in the history saves your configuration for reuse.
