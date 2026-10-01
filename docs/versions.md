# Versiones, actualizaciones y CI/CD

Todo lo de esta página funciona en tu propio servidor y se guarda en ficheros locales (`data/versions.json` y `data/git-integrations.json`). No hay servicios externos ni cuentas añadidas: lo único que necesitas es GitHub, que ya lo usas para compilar.

## Versionado

Cada build lleva `versionName` y `versionCode`. La versión acepta de uno a cuatro bloques numéricos separados por puntos (`1`, `1.0`, `1.0.1`, `1.0.1.2`) y lo que no encaje se rechaza con un `400`. El `versionCode` es un entero que sube siempre: Play Store exige que crezca en cada publicación, y el servidor acepta cualquier número entero positivo.

En el estudio lo rellenas en el paso de Aplicación. Por API van en el cuerpo de `POST /api/build` como `versionName` y `versionCode`; en `POST /api/v1/build` también se admiten.

## Publicar y consultar versiones

```bash
curl -X POST /api/versions/publish -H "Content-Type: application/json" \
  -d '{"appId":"com.miempresa.miapp","version":"1.0.1","changelog":"Corrige audio en segundo plano"}'
# → {"ok":true,"appId":"com.miempresa.miapp","versions":[{"version":"1.0.1","changelog":"…","publishedAt":1712345678901}]}
```

Guarda hasta 20 entradas por `appId`, siempre con la más nueva al principio. Si no mandas `appId` o la versión no cumple el formato, devuelve `400`.

```bash
curl /api/versions/com.miempresa.miapp
# → {"appId":"com.miempresa.miapp","versions":[…]}
```

Devuelve la lista completa. Si nadie ha publicado para ese `appId`, responde con el objeto vacío (`versions: []`).

```bash
curl "/api/check-update?appId=com.miempresa.miapp&version=1.0.0"
# → {"updateAvailable":true,"latest":"1.0.1","changelog":"Corrige audio en segundo plano"}
```

Compara la versión que mandes con la última publicada, componente a componente. Si no hay nada publicado responde `{"updateAvailable":false}`.

Esto es un registro que puedes consultar: no hay cliente OTA dentro de la app generada, así que el banner de "nueva versión disponible" lo tienes que montar tú, en tu web o en tu HTML, llamando a este endpoint y enlazando a tu APK o AAB.

## Compilación automática en cada push

El flujo tiene cuatro pasos:

1. Conecta el repositorio: `POST /api/git/connect` con `{"repo":"usuario/mi-web","branch":"main"}`. Se guarda la integración y devuelve su `id`.
2. Genera el workflow: `POST /api/cicd` con `{"repo":"usuario/mi-web","branch":"main","baseUrl":"https://tu-dominio.com"}`. Devuelve el YAML completo y la ruta donde subirlo.
3. Sube ese YAML a `usuario/mi-web/.github/workflows/inteebuild-auto.yml`.
4. Cada push a esa rama dispara el `curl` del workflow contra `POST /api/git/webhook` de tu servidor.

El webhook acepta el formato nativo de GitHub (`{"repository":{"full_name":"usuario/mi-web"},"ref":"refs/heads/main"}`) y también un formato corto con `repo` y `branch`. Si no hay integración registrada para esa combinación responde `404`. Si el cuerpo trae un campo `config`, se usa como configuración de la build; si no, se construye una mínima con `url: https://usuario/mi-web` y el nombre del repositorio.

Las integraciones se listan con `GET /api/git/integrations` y se borran con `DELETE /api/git/:id`.

Un detalle a saber antes de mandar token: el campo `token` del `connect` se guarda entero en `data/git-integrations.json` (además de un resumen para el listado) y hoy nada lo lee. Como el webhook no lo usa, la recomendación es no enviarlo.

Como la limpieza automática borra ramas `build-*` en cuanto cumplen unos minutos, el repositorio de builds no se llena: cada push genera una rama nueva, un run y unos artefactos que viven poco tiempo.

Sobre los límites de los builds, en [production.md](./production.md). Sobre lo que sale de cada compilación, en [outputs.md](./outputs.md).
