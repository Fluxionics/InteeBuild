# App interface and experience

This guide covers the appearance and behavior fields you control from the studio's Settings step. All of them are generation configuration: what you check here ends up in a manifest, a `capacitor.config.json`, a `colors.xml` or a script injected into your HTML.

To know which field does what, the rule is simple: if it doesn't appear in this list, or appears marked as having no effect, verify it with `POST /api/project` and look at the ZIP before taking anything for granted.

## Style and appearance

**Theme (`appTheme`)** — `system` (default), `light` or `dark`. Chooses whether the status bar goes light or dark: when the StatusBar plugin or edge-to-edge mode is active, `capacitor.config.json` comes out with `StatusBar.style` set to `DARK` if the theme is dark and `LIGHT` otherwise. It doesn't alter your own site's colors.

**Entry animation (`entryAnimation`)** — `none` (default), `fade` or `slide`. It's stored in `build-config.json`, but no generator patch applies it today: it's a value that gets recorded without ever translating into code.

**Accent color (`accentColor`)** — defaults to `#4f46e5`. If you change it, the ZIP includes `custom-colors.xml` with `colorPrimary` and `colorAccent`; the workflow copies that file to `res/values/colors.xml`. The same color is used as the PWA manifest's `theme_color` and as the accent of the injected script.

**Status bar color (`statusBarColor`)** — defaults to `#ffffff`. Goes to `colorPrimaryDark` of the same `custom-colors.xml` and to `StatusBar.backgroundColor` when the StatusBar plugin is active.

**Navigation bar color (`navigationBarColor`)** — defaults to `#ffffff`. It decides whether `custom-colors.xml` gets generated, but doesn't write any value with that color: the file only contains `colorPrimary`, `colorPrimaryDark` and `colorAccent`.

The three colors only generate the file if any of them differs from its default; with factory settings it doesn't appear in the ZIP.

**Edge-to-edge design (`edgeToEdge`)** — enables `overlaysWebView` in the StatusBar plugin, so your content draws underneath the system bars. Combined with `statusBarColor` you decide what color shows behind them.

## Screen behavior

**Orientation (`orientation`)** — `any` (default), `portrait`, `landscape` or `sensor`. Written to the manifest as `screenOrientation`.

**Fullscreen (`fullscreen`)** — hides the top status bar and makes the splash immersive.

**Keep screen on (`keepScreenOn`)** — adds `android:keepScreenOn="true"` to the activity. For video, games and streaming; comes with `streaming`, `game`, `delivery`, `fitness` and `emergency`.

**Cleartext traffic (`useCleartext`)** — enabled by default. Sets `android:usesCleartextTraffic="true"` in the manifest and `server.cleartext` and `android.allowMixedContent` in `capacitor.config.json`, plus pinning `androidScheme` to `http` if your URL is `http://`. If you disable it and your source is `http://`, the app loads nothing.

## Splash

`splashEnabled` writes the `SplashScreen` configuration into `capacitor.config.json` with `launchAutoHide: true`, the duration and the background color. `splashDuration` accepts between 500 and 5000 ms and defaults to 2000. `splashColor` is also reused as the PWA manifest's `background_color`.

There's no splash image field: the background is flat and the system supplies the icon. The `radio` templates ship with the splash disabled so the app opens straight away.

## Deep links

`deepLinksEnabled` with `deepLinkDomain` adds an `intent-filter` with `autoVerify` to the manifest, and the domain is also used to generate `assetlinks.json` and `.well-known/assetlinks.json`. `deepLinkPaths` accepts up to ten paths. The file has to hang off your domain for App Links to work: the certificate fingerprint it ships with is a placeholder and has to be replaced (more detail in [providers.md](./providers.md)).

## WebView settings

**Back button action (`backButtonBehavior`)** — `back` (default) goes back in history and exits when there's no more history; `exit` calls `finishAffinity()`; `confirm` shows a "Do you want to exit the app?" dialog; `none` does nothing. The patch writes it over `MainActivity`.

**Custom User-Agent (`userAgent`)** — the field exists, but if you fill it in only `webContentsDebuggingEnabled: false` gets enabled in `capacitor.config.json`. It doesn't change the WebView's UA: don't count on it to hide your app behind another browser.

**Cache mode (`cacheMode`)** — `normal`, `no-cache` or `force-cache`. It's normalized and stored, but never reaches any generator: it doesn't change the app's behavior.

**Custom HTTP headers (`customHeaders`)** — same situation: accepted and trimmed, with no effect on generation.

**JavaScript injection (`jsInjection`) and style injection (`cssInjection`)** — if you fill them in, the ZIP includes `www/inject.js` and `www/inject.css` with that content. They aren't added to your HTML on their own: your page has to reference them with `<script src="inject.js">` and `<link rel="stylesheet" href="inject.css">`.

**Minify HTML (`minify`)** — strips comments and extra whitespace from the generated HTML and comments from `catalog.js`. It doesn't touch your JavaScript and isn't a production minifier.

## Scheduled alerts

`notifyOnOpen`, `notifyOnClose` and `notifyDelayMinutes` with `notifyTitle` and `notifyText` generate a script that uses `LocalNotifications` to schedule an alert on open, on going to the background, or after the specified minutes. Two conditions: it's only injected if the source is HTML, and it needs the notifications plugin enabled.

The "notification channels" block (`notifChannel`, `notifImportance`, `notifSound`, `notifVibration`) has fields in the studio, but none of those four values are used at generation time: neither `RadioService`'s channel nor the scheduled alerts read them. The audio service's channel is called `inteebuild_radio` with low importance, and it's fixed.

## Features injected into your site

The Settings step has a catalog block with functions that get dumped into `catalog.js` and run inside the WebView on your own page:

- **Pull-to-refresh** — swiping down with the scroll at the top reloads the page.
- **Offline screen** — a fixed layer with the `offlineMessage` (default "No connection. Check your internet.") and a retry button. Enabled with `offlineScreen`, which comes on except in `lab`.
- **Loading indicator** — `spinner` (centered layer), `bar` (3 px bar at the top) or `none`.
- **Side drawer** (`drawerEnabled`) — a fixed button at the top left that opens a panel with the `drawerItems`: up to eight `{label, url, icon}` objects in JSON.
- **Bottom navigation** (`bottomNavEnabled`) — a bottom bar with up to five `{label, url, icon}` entries and automatic `padding-bottom` on the body.
- **DownloadManager** — native downloads instead of leaving them in the WebView.
- **Selection blocking** (`blockSelection`) — `user-select: none` CSS (except for text fields) and context menu prevention.
- **Root/jailbreak detection** (`rootDetection`) — a `RootCheck` patch in `MainActivity`.
- **Encrypted Storage** — adds `capacitor-secure-storage-plugin` and the `USE_BIOMETRIC` permission.

`flagSecure` doesn't go through here: it's applied in Java, in `MainActivity`.

If your HTML is the one in charge, remember that the catalog script is injected at the `</body>` after your code, and that the viewport and charset are only guaranteed when the source is HTML. If you load a URL, it's your site that has to bring its own viewport.

## Accessibility and performance

None of this is done by the generator for you; it's your HTML's job:

- The `meta viewport` is only injected in HTML mode. If your source is a URL, add it on your site.
- Text with a minimum contrast of 4.5:1, and 3:1 for large text.
- Touch targets of 48 dp or more.
- Descriptive `alt` on images. The analyzer's Auto-Fix puts `alt=""`, which doesn't work as a description.
- Lazy loading of images and resources with `defer` or `async`. The analyzer flags it under `optimization`.

## How to verify what changed

```bash
curl -X POST /api/project -H "Content-Type: application/json" -d '{"appName":"Mi App","url":"https://mi-web.com","accentColor":"#112233","entryAnimation":"fade","orientation":"portrait"}' -o proyecto.zip
unzip -p proyecto.zip capacitor.config.json
unzip -p proyecto.zip main-manifest.xml | grep -E "screenOrientation|keepScreenOn|cleartext"
unzip -p proyecto.zip www/index.html | tail -5
```

The last line shows the catalog script stuck at the end of your HTML. If `entryAnimation` doesn't appear anywhere, it's because it isn't applied — and there you have it confirmed.

More about permissions in [permissions.md](./permissions.md), about what each build compiles in [outputs.md](./outputs.md) and about the analyzer in [analyzer.md](./analyzer.md).
