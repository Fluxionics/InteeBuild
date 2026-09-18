# Developer API — automatiza InteeBuild

Panel visual: `developer.html`. Base URL: tu dominio o `http://localhost:8787`.

## Autenticación

Sin keys la API es pública (desarrollo). Al crear la primera key, `POST /api/v1/build` exige:

```
X-API-Key: ib_...
# o
Authorization: Bearer ib_...
```

Las keys se guardan con `sha256(keyHash) + prefix + scopes + revokedAt`. El listado nunca expone el secreto. `DELETE /api/keys/:id` revoca (soft-delete).

```bash
curl -X POST /api/keys -H "Content-Type: application/json" -d '{"name":"ci"}'
# → {"id":"...","key":"ib_...","keyHash":"...","prefix":"ib_...","scopes":["build","decompile","analyze"]}
```

## Compilar

```bash
curl -X POST /api/v1/build \
  -H "Content-Type: application/json" -H "X-API-Key: ib_..." \
  -d '{"url":"https://mi-tienda.com","name":"Mi Tienda","package":"com.miempresa.miapp","permissions":{"gps":true,"cameraMic":true}}'
# → {"buildId":"abc123","status":"queued","branch":"build-abc123"}
```

Campos: `url | htmlCode + inputType, name/appName, package/packageName, outputType (apk/aab/both), platform, permissions{}, plugins{}, provider, webhookUrl`.

Polling cada 3s:

```bash
curl /api/v1/build/abc123
# → {"buildId":"abc123","status":"building","step":"Compilando APK","runUrl":"https://github.com/..."}
# → {"buildId":"abc123","status":"success","apkUrl":"/api/download/abc123"}
```

Descargas: `GET /api/download/:id`, `/api/download/:id/aab`, `/api/download/:id/ipa`. Proyecto sin compilar: `POST /api/project` → ZIP.

## Permisos y readiness

```bash
curl /api/permissions/spec
curl -X POST /api/permissions/audit -H "Content-Type: application/json" -d '{"appName":"Mi Tienda","url":"https://mi-tienda.com","permissions":{"cameraMic":true}}'
curl -X POST /api/permissions/suggest -H "Content-Type: application/json" -d '{"url":"https://mi-tienda.com"}'
curl -X POST /api/build-readiness -H "Content-Type: application/json" -d '{"appName":"Mi Tienda","url":"https://mi-tienda.com","permissions":{"gps":true}}'
```

`suggest` acepta `{html}`, `{url}` o `{detectedApis}`. Devuelve `gps/cameraMic/...` con spec.

## Análisis y decompiler

```bash
curl "/api/analyze?url=https://mi-tienda.com"
curl -X POST /api/analyze/html -H "Content-Type: application/json" -d '{"html":"<html>...</html>"}'
curl -X POST /api/decompile -H "Content-Type: application/json" -d '{"apkBase64":"data:application/vnd.android.package-archive;base64,UEs..."}'
# → {meta:{packageName, permissions, hasDex}, importConfig, sourceZipBase64, manifestPreview}
```

Límites: HTML 500KB, icono 7MB, APK decompile 30MB, 10 builds/hora por IP.

## Ejemplos

Node.js y Python completos en `developer.html` (sección Ejemplos). Webhook: configura `webhookUrl` y recibe `build.completed / build.failed`.
