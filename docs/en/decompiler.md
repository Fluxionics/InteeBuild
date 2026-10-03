# Decompiler: recover an APK's configuration

Upload an APK and pull out its package, permissions, manifest, and a ZIP with the contents. It's used from the studio's Build step (`Descompilador APK`) or via API. There are two modes with different scopes: the local one, which works on AXML and DEX in the browser and the server, and the cloud one, which runs jadx and apktool on GitHub Actions and returns real Java code.

The local one is instant and needs no GitHub. The cloud one takes one to three minutes and needs the same `GITHUB_TOKEN` and `INTEE_BUILDS_REPO` as builds.

## Local mode

```bash
curl -X POST /api/decompile -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
```

It also accepts the APK as an `application/octet-stream` body and the `buffer` field. The minimum is 100 bytes and the maximum 100 MB. Everything is processed on the server without the binary touching any external service.

The response is:

```json
{
  "ok": true,
  "meta": { "packageName": "com.example.app", "appName": "Mi App", "permissions": ["android.permission.CAMERA"], "hasIcon": true, "hasDex": true, "fileCount": 120, "versionName": "1.0.0", "sizeKB": 2048 },
  "axml": { "binary": true, "package": "com.example.app", "permissions": [], "minSdk": 23, "targetSdk": 35 },
  "dex": { "classCount": 900, "methodCount": 5200, "libs": ["capacitor"], "hasCapacitor": true },
  "entries": ["AndroidManifest.xml", "classes.dex", "res/…"],
  "manifestPreview": "<manifest …>…",
  "importConfig": { "appName": "…", "packageName": "…", "url": "https://example.com", "permissions": {} },
  "sourceZipBase64": "UEs…",
  "sourceZipSizeKB": 450,
  "note": "APK real: AXML decodificado (9 permisos) + DEX (900 clases, libs: capacitor) + importConfig con keys reales + ZIP fuente"
}
```

`note` explains in text what could be recovered, and it changes depending on the case:

- InteeBuild APK: finds `build-config.json` inside and returns it as-is as `importConfig`. This is the case that recovers 100%.
- Normal APK: decodes the AXML manifest, reads `capacitor.config.json`, `www/index.html`, or `assets/www/index.html` if they exist, and parses up to five `classes*.dex` files to detect libraries (Capacitor, Droncito, ARCore, MLKit, web3j, MQTT, GVR, Firebase, AdMob). The `importConfig` is assembled from whatever could be read, and the URL is filled in with `https://example.com`.
- Generic ZIP: lists the files and packages whatever is there.

Inside the source ZIP go files under 4 MB, plus `DECODED-AndroidManifest.xml` and the JSON files `decompiler-axml.json` and `decompiler-dex.json` with what was extracted. If a file weighs more, it's left out so as not to break the browser.

`manifestPreview` carries the first 8,000 characters; if the manifest is binary and has no readable strings, it returns a notice and the data sits in `axml.permissions`.

## Cloud mode (jadx + apktool)

```bash
curl -X POST /api/decompile/cloud -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
# → 202 {"ok":true,"id":"ab12cd34","branch":"decompile-ab12cd34","tools":"jadx 1.5.1 + apktool 2.9.3","statusUrl":"…","downloadUrl":"…"}
```

The APK is uploaded as `input/app.apk` to an ephemeral `decompile-<id>` branch of the builds repo, with the `decompile-app.yml` workflow. That workflow runs jadx 1.5.1 for Java sources and apktool 2.9.3 for manifest, resources, and smali, and uploads the result as an artifact with `retention-days: 7`. The branch holding the APK is deleted after 20 minutes.

The status:

```bash
curl /api/decompile/cloud/ab12cd34/status
# → {"id":"…","branch":"…","status":"completed","conclusion":"success","runUrl":"…","artifacts":[{"name":"inteebuild-decompile-ab12cd34","id":1,"sizeKB":812}],"ready":true}
```

`ready` is `true` only when the run finished successfully and there are artifacts. While the run doesn't exist yet it returns `status: "queued"`. The studio polls every 5 seconds with a 5-minute cap.

```bash
curl -L -o fuentes.zip /api/decompile/cloud/ab12cd34/download
```

The ZIP brings `output/sources/**/*.java`, `output/resources/**` with res, smali, and manifest, `output/AndroidManifest-decoded.xml`, and `output/REPORT.txt`. If the workflow is still running the endpoint responds `409`; if it finished without an artifact, `404` with a link to the logs.

Cloud mode limits: 60 MB (git blobs allow that), the same rate limit of 10 builds per hour per IP as the rest of the compilations, and artifacts expire after 7 days. It fails on APKs obfuscated with commercial obfuscators.

## Workflow in the studio

1. In the Build step, inside `Descompilador APK`, choose the file and press `Descompilar`.
2. Review `packageName`, permissions, `Manifest preview`, and the notes on what could be read.
3. Press the import button on the result: it fills the wizard with name, package, URL, and permissions.
4. Go through the Audit on the Permissions step before building.
5. If you need the real Java code, press `Decompilar en la nube (jadx + apktool)` and download the sources ZIP.

The same path works via API: `POST /api/decompile`, `importConfig`, `POST /api/build` with those fields, and build.

## What it doesn't do

- It doesn't deobfuscate code. Commercial obfuscators produce code that jadx returns as unreadable or incomplete.
- It doesn't extract keys, certificates, or obfuscated resources.
- The `importConfig` of someone else's APK uses `https://example.com` as the URL: change it for the real one before building.
- It doesn't turn an APK into a full Gradle project: it returns the manifest, config, and a ZIP with the contents so you can reimport it into InteeBuild.

If what you want is to inspect an APK without reimporting it, `POST /api/inspect` returns a technical sheet and a `security.score` with a lower limit of 30 MB. The limits and rate-limit details are in [api.md](./api.md).
