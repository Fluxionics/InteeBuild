# Analyzer: security, errors, and optimization before you build

The analyzer audits your web app without compiling anything. It's triggered by the `Analizar salud web` button on the Application step or from the API with `GET /api/analyze?url=…`. If what you want to check is standalone HTML, `POST /api/analyze/html` does the same job without downloading anything.

It's not a certified security analyzer: these are local server rules, with no AI and no external services. They're there so you can see at a glance what you're missing before putting your web app inside a WebView.

## Base checks

It downloads the page with a 10-second timeout and checks a list of concrete things: that it uses HTTPS, that it responds, that it has `meta viewport`, manifest, favicon, theme-color, service worker, that no `src` or `href` points at `http://`, that the HTML has a doctype, and the presence of Open Graph and structured data. If it has a manifest, it tries to download it at `/manifest.json` or `/manifest.webmanifest` to return its content in `pwa`.

From that you get a `score` from 0 to 100 and a text diagnosis: `Listo para compilar` from 90, `Bueno, con mejoras menores` from 70, `Necesita ajustes` from 50, and `Requiere correcciones` below that. Each check adds or subtracts points: viewport and service worker weigh more than the favicon.

The request goes out with `redirect: manual`, so it doesn't follow redirects: if the response is 3xx, it only checks that the `Location` header doesn't point at a private URL and returns the status as-is.

## Security

The `security` module returns its own `score` (0-100), a `level` (`Excelente`, `Bueno`, `Riesgo medio`, `Crítico`), and a list of findings with severity and a proposed fix. It detects:

- Missing HTTPS (deducts 25).
- Absent Content-Security-Policy, both in the header and in `http-equiv`.
- Resources loaded with `http://` and external scripts over HTTP.
- `eval()` in the HTML.
- Unsanitized `innerHTML`.
- Cookies read without the `Secure` flag.
- jQuery 1.x or 2.x.
- Missing `X-Content-Type-Options: nosniff`.

All of this applies equally inside the WebView: mixed content and `eval()` are still a problem in a packaged app.

## Errors

`errors` returns two lists. `errors` is for what actually breaks: missing `<!DOCTYPE html>` and missing `<html>` tag. `warnings` is everything else, with `type`, message, and fix: duplicate IDs (the first three), possible mismatch of unclosed tags, images without `alt`, more than 15 inline styles, `var` instead of `let` or `const`, a possible assignment inside an `if`, and empty `#` links. The summary carries `total`, `altMissing`, and `duplicateIds`.

## Optimization

`optimization` returns `score`, `grade` (`A` from 85, `B` from 70, `C` from 50, `D` below), `sizeKB`, `images`, `scripts`, and a list of `tips` with impact `high`, `medium`, or `low`. It reviews the weight of the HTML, the number of images and how many lack `loading="lazy"`, the number of external scripts, render-blocking CSS, missing WebP, and repeated `<style>` blocks.

## Frameworks, Web APIs, and permissions

`frameworks` is a list of tags detected by regex: React, Vue, Angular, Next.js, Nuxt, Svelte, Astro, Vite, WordPress, Shopify, Webflow, Wix, Bubble, Lovable, Replit, Bootstrap, and Tailwind. If it recognizes nothing it returns `html`.

`detectedApis` lists the Web APIs present: geolocation, camera, microphone, Bluetooth, NFC, notifications, vibration, sharing, fullscreen, orientation, localStorage, indexedDB, service worker, WebGL, payments, clipboard, and wake lock. From that, `recommendations` translates into which permissions and plugins would be missing: for example, `geolocation` suggests the `gps` permission and the `geolocation` plugin.

That same chain is what the `Sugerir por Web API` button on the Permissions step uses, and also `POST /api/permissions/suggest`, which accepts HTML, a URL, or an already-detected list of APIs.

## Auto-fix

`autoFixHtml` does four things, and nothing else: swaps `http://` for `https://` in `src` and `href`, adds `loading="lazy"` to images that don't have it, injects the `meta viewport` if it's missing, and adds `alt=""` to images without `alt`. The result is compared with the original to report `autoFix.available`, and the first 8,000 characters go into `autoFix.preview`.

There are three ways to apply it:

- `POST /api/analyze/fix` returns `{fixed, originalLength, fixedLength}` with the full corrected HTML.
- `POST /api/analyze/html` returns `autoFix.full` in addition to `preview`.
- The `Aplicar Auto-Fix y previsualizar HTML optimizado` button in the studio puts the result in the editor for you to review.

It's heuristic. An empty `alt=""` is not an accessible description, and forcing `https://` on a resource that doesn't exist over HTTPS leaves the image broken. Review the diff before accepting the output.

## Recommended order of work

Analyze first with the URL, and if the score drops below 70 apply the fix and look at the optimization list. Then review `security`: an `eval()` or mixed content you overlook now will show up the same way in the build. Use `Sugerir por Web API` to tick only the permissions your web app really uses, check the result in the Audit on the Permissions step, and re-analyze whenever you change big things on your site.

Size limits are in [api.md](./api.md); what the Permission Engine does with that information is in [permissions.md](./permissions.md).
