# API de desarrollador

Toda la API vive bajo `/api` en el mismo servidor que la interfaz. La base URL es tu dominio o `http://localhost:8787`. Todo es JSON salvo los endpoints que devuelven ZIP, texto plano o PNG.

Si necesitas una vista navegable de los mismos endpoints, está `developer.html`. `GET /api/docs` devuelve un resumen en JSON de la API con la versión del servidor.

## Autenticación

Las API keys no son obligatorias: mientras no exista ninguna, la API está abierta. En cuanto creas la primera, `POST /api/v1/build` pasa a exigirla.

```bash
curl -X POST /api/keys -H "Content-Type: application/json" -d '{"name":"ci"}'
# → {"id":"…","key":"ib_…","keyHash":"…","prefix":"ib_…","scopes":["build","decompile","analyze"]}
```

La key se devuelve una sola vez, en esa respuesta. En disco sólo queda su hash sha256 (`keyHash`) y el prefijo (los diez primeros caracteres), nunca el secreto. `GET /api/keys` devuelve el enmascarado (`ib_1a2b3c4…` más las últimas cuatro del hash), uso, última llamada y estado; `DELETE /api/keys/:id` hace borrado lógico marcando `revokedAt`, y esa key deja de servir. El límite son 10 keys activas.

Se acepta de dos formas: `X-API-Key: ib_…` o `Authorization: Bearer ib_…`.

Un detalle que conviene saber: los `scopes` se guardan y se pueden limitar al crear la key, pero no se comprueban en ninguna ruta. El permiso real es "la key existe y no está revocada".

También tienes `GET /api/keys` para el listado y la revocación desde tu propio cliente.

## Compilar

Hay dos entradas. La del estudio no pide key y responde con `id`; la de versionado sí puede pedirla y responde `buildId`.

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

`POST /api/build` acepta la configuración completa: `url` o `htmlCode` con `inputType`, `appName`, `packageName`, `outputType` (`apk`/`aab`/`both`), `outputs` (lista de formatos: `apk`, `aab`, `xapk`, `apks`, `ipa`, `exe`, `msi`, `dmg`, `appimage`), `platform` (`android`/`ios`/`both`), `permissions`, `plugins`, `provider`, `template`, `streamUrl`, `nativeAudio`, `nativeAutoplay`, `orientation`, `iconBase64`, firma de keystore e iOS, `webhookUrl`, `desktopEnabled` y el resto de campos que normalizan los SDK.

`POST /api/v1/build` es deliberadamente más estrecho: sólo reconoce `url`, `name`/`appName`, `package`/`packageName`, `output`/`outputType`, `outputs`, `platform`, `inputType` + `htmlCode`, `versionName`, `versionCode`, `compileSdk`, `targetSdk`, `minSdk`, `permissions`, `plugins`, `provider`, `template`, `streamUrl`, `nativeAudio`, `nativeAutoplay` y `webhookUrl`. El icono y las banderas de UI no se pasan por ahí; usa `/api/build` si los necesitas.

Errores que vas a ver antes de que se lance nada: GitHub sin configurar devuelve `503` con el aviso de `.env`; la URL bloqueada por seguridad devuelve `400`; HTML por encima de 500.000 caracteres devuelve `400`; un icono mayor de 7 MB devuelve `400`; y el límite de 10 builds por hora por IP devuelve `429`. Ese contador es el mismo que usa la descompilación en la nube, así que una pasada de descompilados consume también tu cupo de builds.

Durante la compilación los pasos van por `Enviando proyecto a GitHub`, `Sincronizando workflow`, `Subiendo proyecto`, `Lanzando compilacion en GitHub Actions`, `En cola en GitHub Actions` y `Compilando APK`, y terminan en `Build completado` o `Build fallido`.

## Consultar estado y descargar

El estudio consulta cada 3 segundos. Tú puedes hacerlo con la frecuencia que quieras.

```bash
curl /api/build/abc123
# → {"id":"abc123","status":"building","step":"Compilando APK","runUrl":"https://github.com/…","apkUrl":null,"outputType":"apk"}
```

`status` pasa por `queued` → `building` → `success` o `failed`. Si la build ya no está en memoria, el endpoint mira en el historial y devuelve la entrada con `fromHistory: true`; si no aparece, `404`.

`GET /api/v1/build/:id` devuelve lo mismo con otra forma: `apkUrl`, `aabUrl` y `ipaUrl` relativos a la API (o `null` si ese artefacto no se generó), más `outputs` (lo que pediste) y `formats` (lo que el artefacto en GitHub Actions confirma que existe).

```bash
curl /api/v1/build/abc123
# → {"buildId":"abc123","status":"success","apkUrl":"/api/download/abc123","aabUrl":null,"ipaUrl":null,"outputs":["apk"],"formats":["apk"]}
```

Descargas:

- `GET /api/download/:id` — APK.
- `GET /api/download/:id/aab` — AAB.
- `GET /api/download/:id/ipa` — IPA, sólo si hubo firma Apple.

Los tres funcionan igual: buscan el artefacto del run, abren el ZIP que subió GitHub Actions y devuelven el binario suelto con su extensión (si no encuentran el binario, devuelven el ZIP entero). Si la build sigue en progreso responden `404` con "Build aun en progreso".

Hay una condición que conviene recordar: la descarga necesita que la build esté en memoria del servidor. Si el proceso se reinició, el endpoint responde `404` aunque el artefacto exista en GitHub. El historial sirve para consultar estado y configuración, no para descargar.

Los artefactos se sirven desde GitHub Actions y caducan a los 30 minutos. `GET /api/apk-info/:id` devuelve ficha del artefacto (nombre, tamaño en MB, enlaces de cada uno) sólo cuando la build ya terminó. `GET /api/build/:id/logs` devuelve el log del run truncado a 80.000 caracteres, y sólo si la build ya tiene `runId`.

El servidor consulta GitHub cada 6 segundos y hace 200 intentos: si se agotan, la build pasa a `failed` con "Tiempo de espera agotado consultando GitHub" y la rama se borra a los 60 segundos.

Para pedir el proyecto sin compilar:

```bash
curl -X POST /api/project -H "Content-Type: application/json" -d '{"url":"https://mi-tienda.com","template":"ecommerce"}' -o proyecto.zip
```

## Plantillas

```bash
curl /api/templates
curl /api/templates/radio
curl /api/templates/radio/native
```

La lista trae `id`, `name`, `description`, `hasFace` y el audit resumido (`ok`, `total`, `readiness`, `canBuild`). El detalle incluye `config` y `faceHtml`. El tercero genera en memoria el manifiesto, los ficheros Java/XML y el audit sin compilar. El detalle de cada plantilla está en [templates.md](./templates.md).

## Permisos y readiness

```bash
curl /api/permissions/spec
curl -X POST /api/permissions/audit -H "Content-Type: application/json" -d '{"appName":"Mi Tienda","url":"https://mi-tienda.com","permissions":{"cameraMic":true}}'
curl -X POST /api/permissions/suggest -H "Content-Type: application/json" -d '{"url":"https://mi-tienda.com"}'
curl -X POST /api/build-readiness -H "Content-Type: application/json" -d '{"appName":"Mi Tienda","url":"https://mi-tienda.com","permissions":{"gps":true}}'
```

`spec` devuelve las entradas del Permission Engine (86 en la versión actual). `audit` devuelve una fila por permiso con `status` (`ok`/`warn`/`fail`), `minSdk`, implementación nativa y si el provider lo soporta, más `ok`, `total`, `canBuild`, `verifiedAll` y `readiness`. `suggest` acepta `{html}`, `{url}` o `{detectedApis}` y responde `{detected, suggested, count}`.

`build-readiness` es el que usa el paso de Compilar. Devuelve `readiness` (0-100), `checks`, `audit`, `warnings` y `canBuild`. `canBuild` sólo es `true` si el audit pasa, hay URL o HTML, y el audio nativo tiene su stream. Un aviso típico es "Audio nativo activo pero sin URL del stream: pon tu servidor en Audio nativo", que bloquea la radio hasta que escribas `streamUrl`.

**Foreground + WifiLock**: si `permissions.foreground` está activado, el generador incluye ahora `WifiLock` (`WIFI_MODE_FULL_HIGH_PERF`, con `try/catch`) para evitar que el audio se corte cuando la pantalla se apaga por ahorro de energía del WiFi. El `WakeLock` (PARTIAL) sigue activo también. Véase `foreground.md` para los detalles del servicio en segundo plano.

El campo `provider` en la configuración ahora se propaga correctamente a `build-config.json` (antes se perdía con escapes rotos en el workflow) y el pipeline usa ese valor para decidir si inyectar `MainActivity` nativo/gecko o el puente de Capacitor.

`POST /api/manifest-diff` compara lo que pediste con lo que se genera: devuelve `requested`, `generated`, `missing`, `unexpected` y `rows` con estado `MATCH` o `MISSING` por permiso. Sirve para detectar permisos que se quedaron fuera del manifiesto antes de compilar.

## Análisis de web

```bash
curl "/api/analyze?url=https://mi-tienda.com"
curl -X POST /api/analyze/html -H "Content-Type: application/json" -d '{"html":"<html>…</html>"}'
curl -X POST /api/analyze/fix -H "Content-Type: application/json" -d '{"html":"<html>…</html>"}'
```

`GET /api/analyze` descarga la página con un timeout de 10 segundos, comprueba HTTPS, viewport, manifest, favicon, theme-color, service worker, recursos con `http://`, Open Graph y datos estructurados, y devuelve `score` de 0 a 100 con su diagnóstico. Junto a eso entrega `frameworks`, `detectedApis`, `recommendations`, `security` (puntuación con incidencias), `errors`, `optimization` y `autoFix.preview` con los primeros 8.000 caracteres corregidos. Si la página trae manifest, intenta descargarlo para devolver `pwa`. Rechaza HTML de más de 500.000 caracteres y URLs bloqueadas.

`POST /api/analyze/html` hace el mismo análisis sobre HTML enviado, con el límite en 600.000 caracteres, y devuelve además `autoFix.full`. `POST /api/analyze/fix` devuelve `{fixed, originalLength, fixedLength}` sin diagnóstico.

## Inspector, descompilador

```bash
curl -X POST /api/inspect -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
curl -X POST /api/decompile -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
curl -X POST /api/decompile/cloud -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
curl /api/decompile/cloud/abc123/status
curl -L -o salida.zip /api/decompile/cloud/abc123/download
```

`/api/inspect` devuelve ficha técnica (`packageName`, versión, tamaño, número de ficheros, `.dex`, `.so`, iconos), permisos detectados, `riskyPermissions`, `findings` y un `security.score`. Acepta hasta 30 MB y como mínimo 100 bytes.

`/api/decompile` trabaja en local: acepta `apkBase64` (con o sin prefijo `data:`) o cuerpo `application/octet-stream`, hasta 100 MB. Devuelve `meta`, `importConfig`, `sourceZipBase64` y `manifestPreview`.

`/api/decompile/cloud` sube el APK a una rama `decompile-<id>` y lanza un workflow con `jadx 1.5.1 + apktool 2.9.3`. Responde `202` con `statusUrl`, `downloadUrl` y el aviso de que el APK se borra de la rama a los 20 minutos. El límite es 60 MB y comparte el rate limit de 10/h por IP. El estado devuelve `status`, `conclusion`, `runUrl`, `artifacts` y `ready`; el cliente espera con polling de 5 segundos y un tope de 5 minutos. El ZIP descargado trae `output/sources` (Java), `output/resources` (res y smali), `AndroidManifest-decoded.xml` y `REPORT.txt`.

## Ficha, seguridad y privacidad

```bash
curl -X POST /api/listing -H "Content-Type: application/json" -d '{"appName":"Mi Radio","packageName":"com.miempresa.radio","template":"radio"}'
curl -X POST /api/security-audit -H "Content-Type: application/json" -d '{"appName":"Mi App","url":"https://mi-web.com","permissions":{"cameraMic":true}}'
curl "/api/privacy-policy?appName=Mi%20App&package=com.miempresa.miapp"
```

`/api/listing` devuelve `{ok, listing}` con `title`, `shortDescription`, `fullDescription`, `keywords`, `category` y `packageName`, con los límites que impone Play Console.

`/api/security-audit` devuelve `score`, `level`, el `audit` de permisos, `issues` (permisos sensibles, cleartext) y una lista `gdpr` de tres comprobaciones: política de privacidad enlazada, permisos sensibles innecesarios y keystore propio. La puntuación descuenta 20 puntos por permiso en `fail`, 5 por `warn` y 5 por incidencia alta.

`/api/privacy-policy` devuelve texto plano con los datos que le pases. Es una base para rellenar, no un documento legal terminado.

## Versiones y CI/CD

```bash
curl -X POST /api/versions/publish -H "Content-Type: application/json" -d '{"appId":"com.miempresa.miapp","version":"1.0.1","changelog":"fix"}'
curl "/api/check-update?appId=com.miempresa.miapp&version=1.0.0"
curl "/api/versions/com.miempresa.miapp"
curl -X POST /api/cicd -H "Content-Type: application/json" -d '{"repo":"usuario/mi-web","branch":"main","baseUrl":"https://tu-dominio.com"}'
```

`versions/publish` guarda hasta 20 entradas por `appId` con `version` (formato `1.0.1`), `changelog` y fecha. `check-update` compara con la última publicada y responde `{updateAvailable, latest, changelog}`. No hay cliente OTA embebido en la app: es un registro que puedes consultar desde donde quieras.

`cicd` devuelve el contenido de `.github/workflows/inteebuild-auto.yml` para que lo subas a tu repo, con el `curl` que dispara el webhook. La integración real es `POST /api/git/connect` con `{repo, branch, token, webhookUrl}`, que guarda el token con hash; luego `POST /api/git/webhook` con `{"repository":{"full_name":"usuario/repo"},"ref":"refs/heads/main"}` arranca una build con la config que mandes o con una mínima derivada del repo. `GET /api/git/integrations` lista y `DELETE /api/git/:id` borra.

## Webhooks

`webhookUrl` recibe POST con JSON. Los eventos son `build.completed`, `build.failed` y `build.error` (error al enviar el proyecto a GitHub, antes de que corra nada).

## Utilidades varias

- `GET /api/health` — `{ok, service, version, githubReady}`.
- `GET /api/diag` — comprueba token, repo, rama y workflow en GitHub y devuelve un `hint` por paso para saber qué falta en `.env`.
- `GET /api/history`, `GET /api/history/:id`, `DELETE /api/history/:id` — historial local. El listado devuelve las 30 primeras entradas del archivo, que a su vez guarda como máximo 50; `:id` devuelve la entrada completa con la config que se usó.
- `GET /api/stats` — totales por estado y por `outputType`, más duración media de las builds terminadas.
- `GET /api/qr/:id` — PNG del enlace de descarga.
- `GET /api/cleanup?secret=…` — fuerza la limpieza de artefactos caducados. Requiere `CLEANUP_SECRET` en el entorno; sin ella el endpoint devuelve `403`.
- `GET /api/ads/:slot` y `GET /api/ad-proxy?u=` — red de anuncios propia, con caché y proxy del creativo (`u` es la URL a descargar).

Más sobre límites y despliegue en [production.md](./production.md); sobre lo que sale de cada build, en [outputs.md](./outputs.md).
