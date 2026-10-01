# Salidas de una compilación

El `outputType` de una build sólo acepta tres valores: `apk`, `aab` y `both`. El workflow de GitHub Actions tiene pasos de Gradle condicionados a esos tres valores y no compila nada más. Si necesitas un binario de escritorio o un instalador de iOS, hoy tienes que compilarlo tú a partir del código que sí entrega el ZIP.

## Lo que descargas cuando el build termina

- **APK** — `GET /api/download/:id`. Instalable directamente en un dispositivo.
- **AAB** — `GET /api/download/:id/aab`. Lo que sube Play Console. Sólo aparece si `outputType` fue `aab` o `both`.
- **IPA** — `GET /api/download/:id/ipa`. Sólo existe si el build corrió en `macos-latest` con `.p12`, `.mobileprovision` y contraseña enviados en el paso de firma iOS. Si no, no hay artefacto y el endpoint devuelve error.

Los artefactos viven en GitHub Actions y caducan a los 30 minutos; el servidor los borra también en su limpieza automática. El historial (`GET /api/history`) conserva el enlace mientras dure la entrada local.

Además, el ZIP del proyecto está disponible sin compilar con `POST /api/project`, y con cualquier configuración: incluye `build-config.json`, `main-manifest.xml`, el código Java generado, los scripts de patch y el workflow.

## Lo que sólo es código fuente en el ZIP

- **Desktop** — si activas `desktopEnabled`, aparece `desktop/` con un proyecto Electron (`package.json`, `main.js`, README). El selector "Desktop .EXE/.APP" del estudio sólo escribe esa carpeta; no hay paso de CI que ejecute `electron-builder`, así que no sale ningún `.exe`, `.msi`, `.dmg` ni `.AppImage`. El campo `desktopPlatform` (`win`, `mac`, `both`) se valida y se guarda en `build-config.json`, pero ni el generador ni el workflow lo leen.
- **TWA** — `twa-manifest.json`, `assetlinks.json` y un README con el comando de bubblewrap. La Trusted Web Activity real se construye fuera, con tus herramientas.
- **Flutter** — `flutter/pubspec.yaml`, `flutter/lib/main.dart` y su manifiesto. El workflow lo ignora.
- **Tauri** — `tauri/Cargo.toml`, `tauri/tauri.conf.json`, `tauri/src-tauri/src/main.rs`. El workflow lo ignora.
- **`react-native` e `ionic`** — no generan nada más allá de `provider.json`.

## PWA dentro del proyecto

Con `pwaEnabled` activado (viene activado por defecto) el ZIP incluye `www/manifest.webmanifest` con nombre, colores e icono, y `www/sw.js` con caché offline y fallback a `index.html`. El registro del service worker y la etiqueta `manifest` se inyectan en tu `index.html` si no estaban.

No necesitas alojar nada en InteeBuild para esto: sube la carpeta `www/` a tu hosting y la web queda instalable como PWA por sí sola. Desactívalo con `pwaEnabled: false` si tu sitio ya trae su propio manifest.

## Ficha de Play Store

`POST /api/listing` devuelve texto listo para pegar en Play Console, generado con reglas locales y sin servicios externos:

```bash
curl -X POST /api/listing -H "Content-Type: application/json" \
  -d '{"appName":"Mi Radio","url":"https://mi-radio.com","packageName":"com.miempresa.radio","permissions":{"foreground":true}}'
```

La respuesta trae `title` (recortado a 30 caracteres), `shortDescription` (80), `fullDescription` (hasta 4000, con las características derivadas de tus permisos y flags de UI), `keywords` (100), `category` (`Herramientas`), `packageName` y `version`. Es un borrador: conviene reescribirlo antes de publicar.

También están `POST /api/security-audit` (puntuación textual con incidencias GDPR y de permisos) y `GET /api/privacy-policy?appName=&package=` (política genérica rellenada con tus datos).

## QR de descarga

`GET /api/qr/:id` devuelve una imagen PNG con el QR del enlace de descarga. La imagen la genera un servicio externo (`api.qrserver.com`); si no responde en 8 segundos, el endpoint devuelve `502` con el enlace de descarga en texto para que puedas mostrarlo tú.

## Minificado

La opción `minify` (o `minify: true` en la API) quita comentarios HTML y espacios sobrantes del código que se inyecta. No toca tu JavaScript y no es un minificador de producción: sirve para que el HTML embebido pese menos.

## Lo que no hay

No hay compilación de escritorio, no hay build de iOS sin certificados de Apple, no hay tienda ni distribución propia, ni ningún plan de pago detrás de todo esto. Lo que sí hay son límites de uso del servidor: 10 builds por hora por IP y los tamaños de entrada detallados en [production.md](./production.md).
