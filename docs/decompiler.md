# Decompiler: recupera la configuración de un APK

Sube un APK y sacas de él paquete, permisos, manifiesto y un ZIP con el contenido. Se usa desde el paso de Compilar del estudio (`Descompilador APK`) o por API. Hay dos modos con alcances distintos: el local, que trabaja sobre AXML y DEX en el navegador y el servidor, y el en la nube, que corre jadx y apktool en GitHub Actions y devuelve código Java real.

El local es instantáneo y no necesita GitHub. El en la nube tarda uno o tres minutos y necesita el mismo `GITHUB_TOKEN` e `INTEE_BUILDS_REPO` que los builds.

## Modo local

```bash
curl -X POST /api/decompile -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
```

También acepta el APK como cuerpo `application/octet-stream` y el campo `buffer`. El mínimo son 100 bytes y el máximo 100 MB. Todo se procesa en el servidor sin que el binario toque un servicio externo.

La respuesta es:

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

`note` explica en texto qué se pudo recuperar, y cambia según el caso:

- APK de InteeBuild: encuentra `build-config.json` dentro y lo devuelve tal cual como `importConfig`. Es el caso que se recupera al 100%.
- APK normal: decodifica el manifiesto AXML, lee `capacitor.config.json`, `www/index.html` o `assets/www/index.html` si existen, y parsea hasta cinco ficheros `classes*.dex` para detectar librerías (Capacitor, Droncito, ARCore, MLKit, web3j, MQTT, GVR, Firebase, AdMob). El `importConfig` se arma con lo que se pudo leer y la URL se rellena con `https://example.com`.
- ZIP genérico: lista archivos y empaqueta lo que haya.

Dentro del ZIP fuente van los ficheros de menos de 4 MB, más `DECODED-AndroidManifest.xml` y los JSON `decompiler-axml.json` y `decompiler-dex.json` con lo que se extrajo. Si un archivo pesa más queda fuera para no romper el navegador.

`manifestPreview` lleva los primeros 8.000 caracteres; si el manifiesto es binario y no tiene strings legibles, devuelve un aviso y los datos están en `axml.permissions`.

## Modo en la nube (jadx + apktool)

```bash
curl -X POST /api/decompile/cloud -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
# → 202 {"ok":true,"id":"ab12cd34","branch":"decompile-ab12cd34","tools":"jadx 1.5.1 + apktool 2.9.3","statusUrl":"…","downloadUrl":"…"}
```

El APK sube como `input/app.apk` a una rama efímera `decompile-<id>` del repo de builds, con el workflow `decompile-app.yml`. Ese workflow corre jadx 1.5.1 para fuentes Java y apktool 2.9.3 para manifiesto, recursos y smali, y sube el resultado como artefacto con `retention-days: 7`. La rama con el APK se borra a los 20 minutos.

El estado:

```bash
curl /api/decompile/cloud/ab12cd34/status
# → {"id":"…","branch":"…","status":"completed","conclusion":"success","runUrl":"…","artifacts":[{"name":"inteebuild-decompile-ab12cd34","id":1,"sizeKB":812}],"ready":true}
```

`ready` es `true` sólo cuando el run terminó con éxito y hay artefactos. Mientras no exista el run devuelve `status: "queued"`. El estudio consulta cada 5 segundos con un tope de 5 minutos.

```bash
curl -L -o fuentes.zip /api/decompile/cloud/ab12cd34/download
```

El ZIP trae `output/sources/**/*.java`, `output/resources/**` con res, smali y manifest, `output/AndroidManifest-decoded.xml` y `output/REPORT.txt`. Si el workflow sigue corriendo el endpoint responde `409`; si terminó sin artefacto, `404` con el enlace a los logs.

Límites del modo en la nube: 60 MB (los blobs de git lo permiten), el mismo rate limit de 10 builds por hora por IP que el resto de compilaciones, y los artefactos caducan a los 7 días. Falla con APKs ofuscados con ofuscadores comerciales.

## Flujo de trabajo en el estudio

1. En el paso de Compilar, dentro de `Descompilador APK`, elige el archivo y pulsa `Descompilar`.
2. Revisa `packageName`, permisos, `Manifest preview` y las notas de lo que se pudo leer.
3. Pulsa el botón de importar del resultado: rellena el wizard con nombre, paquete, URL y permisos.
4. Pasa por el Audit del paso de Permisos antes de compilar.
5. Si necesitas el código Java de verdad, pulsa `Decompilar en la nube (jadx + apktool)` y descarga el ZIP de fuentes.

La misma ruta vale por API: `POST /api/decompile`, `importConfig`, `POST /api/build` con esos campos y a compilar.

## Qué no hace

- No desofusca código. Los ofuscadores comerciales producen código que jadx devuelve ilegible o incompleto.
- No extrae claves, certificados ni recursos ofuscados.
- El `importConfig` de un APK ajeno usa `https://example.com` como URL: cámbiala por la real antes de compilar.
- No convierte un APK en un proyecto Gradle completo: devuelve manifiesto, config y un ZIP con el contenido para que lo reimportes en InteeBuild.

Si lo que quieres es inspeccionar un APK sin reimportarlo, `POST /api/inspect` devuelve ficha técnica y un `security.score` con un límite más bajo de 30 MB. Los detalles de límites y rate limit están en [api.md](./api.md).
