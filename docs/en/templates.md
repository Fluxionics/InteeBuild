# Templates

InteeBuild ships with 29 templates. They aren't decorative presets: each one defines a complete, verified configuration that lets you build on the first try. They live in `server/templates/` grouped by family (`core`, `media`, `commerce`, `location`, `social`, `wellness`, `secure`) and are assembled in `server/templates/index.js`.

A template only contributes default values. The Permission Engine auto-fills the plugins that the permissions need, and the Audit has to return `canBuild: true` for the build to be dispatched.

## How a template is applied

`applyTemplate` merges the template configuration as the base and layers the user's values on top: whatever you type wins. The `permissions` and `plugins` objects are merged permission by permission, so you can check one extra without losing the ones the template brings.

The same merge happens when you send `template` to `POST /api/build` or `POST /api/v1/build`. If you don't send a template, the configuration comes cleanly from whatever you pass in `normalizeConfig`.

## What each family contains

**`core`** — web, pwa, blog, portafolio, news, dashboard, empresa, edu.

- `web` is the minimal base: no permissions, only INTERNET, with pull-to-refresh, offline screen and downloads.
- `pwa` adds `notifications` and `storage`, and enables `webManifest` and `serviceWorker` so you get an installable PWA.
- `blog` and `portafolio` add banners and reading; `news` additionally restricts orientation to portrait.
- `dashboard` leaves only notifications; `empresa` adds biometrics, `flagSecure` and `outputType: aab` for the Play Store; `edu` adds camera and microphone.

**`media`** — radio, streaming, podcast, ai, game.

- `radio` enables `nativeAudio`, `nativeAutoplay`, `mediaSession` and `audioFocus`, with the `foreground`, `wakeLock` and `notifications` permissions, plus the offline screen with the message "No connection. The stream needs internet."
- `streaming` uses `nativeAudio` with sensor-based orientation and `keepScreenOn`.
- `podcast` adds `storage` for downloads and `mediaSession` for media controls.
- `ai` enables the microphone and camera for voice recognition.
- `game` is landscape, full screen, with vibration, `wakeLock` and `keepScreenOn`.

**`commerce`** — ecommerce, marketplace, food, realestate. All of them include the camera for product photos, GPS and storage; `marketplace` and `food` add notifications, `realestate` adds `phone` for direct calls.

**`location`** — maps, travel, delivery, eventos.

- `maps` is the minimum viable option with foreground GPS and nothing else.
- `travel` combines GPS, camera, storage and travel alerts.
- `delivery` adds `gpsBackground`, `keepScreenOn` and the camera for delivery proof.
- `eventos` covers the camera for scanning QR codes and GPS for locating the venue.

**`social`** — comunidad and social. Both request camera, storage and notifications; `social` adds GPS to geolocate posts.

**`wellness`** — salud and fitness. Both use `sensors` and `activityRecognition`; `fitness` adds GPS, `wakeLock` and `keepScreenOn`.

**`secure`** — finanzas, banking, emergency, lab.

- `finanzas` and `banking` share `biometric` + `notifications`, `flagSecure`, `blockSelection` and `outputType: aab`; `banking` adds `screenCaptureSecurity`.
- `emergency` comes with background GPS, `phone` for automatic calls, the camera and `highPriority` for alerts.
- `lab` (Permission Test Lab) requests ten permissions at once and its sample face runs each test on the device and reports the real result.

The three cases with `outputType: aab` are `empresa`, `finanzas` and `banking`, designed to upload straight to Play Console. The rest generate an APK.

## Sample faces

Each template can ship a `faceHtml`, a sample HTML page. The radio one, for example, has two buttons that call `InteeAudio.play()` and `InteeAudio.pause()` and fall back to the browser's `<audio>` if the native bridge isn't there. The face isn't stored separately: when you apply the template, the studio writes it into the HTML field and switches the source to HTML. If the editor was empty it does this automatically; if you already had your own code, it asks before replacing it (and you can go back to the face any time with the editor's face button). If you prefer your URL, leave the face untouched and re-select the URL source afterwards.

You can view the face via the API:

```bash
curl /api/templates            # lista con id, name, description y audit resumido
curl /api/templates/radio      # config completa + faceHtml
```

The `/api/templates` listing runs each template's Audit with a safe name and `https://example.com`, and returns `ok`, `total`, `readiness` and `canBuild`. If any template starts returning `canBuild: false`, you'll see it there without building anything.

## Native check

`GET /api/templates/:id/native` generates the template's real files in memory and responds with the manifest, the file list, the included `.java` and `.xml` files, whether `NativePermissions.java` is present, whether `RadioService.java` is present, whether the catalog patch is present, the `provider.json` and the audit. The `native100` field is `true` when the audit verifies everything and allows building. It's the quick way to see what each template will produce without requesting a build.

## Foreground service and audio

Only three templates request `foreground`: `radio`, `streaming` and `podcast`. `wakeLock` appears in those same three plus `game` and `fitness`, and `keepScreenOn` appears in `streaming`, `game`, `delivery`, `fitness` and `emergency`. `delivery` doesn't request `foreground`: it handles background with `gpsBackground`, which is a different permission with a different manifest. **Additionally, the `wifiLock` (`WIFI_MODE_FULL_HIGH_PERF`) is generated automatically for `radio`, `streaming` and `podcast` when `foreground` is present, preventing audio from being cut off by WiFi power saving with the screen off.** The details of why this code exists and how to test it are in [foreground.md](./foreground.md).

## Customization

After loading a template you can change anything in advanced mode: individual permissions, plugins, SDK, orientation, colors, splash and deep links. If you're only changing two or three things, send those fields on top of `template: "radio"` and you're done: you don't need to repeat what the template already brings.

Each template's actual configuration lives in `server/templates/*.js`, so if you're missing a use case you can add it there in the same format and it will show up in `GET /api/templates`.
