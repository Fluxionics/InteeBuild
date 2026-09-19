# Salidas multi-platform — todo gratis, sin pagos

Una sola configuración genera todas las salidas. Sin planes, sin monetización, sin API keys de IA.

## Qué sale de cada build

| Salida | Dónde | Costo |
|---|---|---|
| APK instalable | `GET /api/download/:id` | Gratis |
| AAB Play Store | `GET /api/download/:id/aab` (+ `outputType: both`) | Gratis |
| Proyecto ZIP (código nativo) | `POST /api/project` | Gratis |
| PWA (`manifest.webmanifest` + `sw.js`) | Dentro del ZIP en `www/` | Gratis, automático |
| Desktop (Electron) | Dentro del ZIP en `desktop/` si activas `desktopEnabled` | Gratis |
| TWA | `twa-manifest.json` + `assetlinks.json` si activas `twaEnabled` | Gratis |
| Ficha Play Store | `POST /api/listing` | Gratis |

## PWA automática

Cada proyecto incluye `www/manifest.webmanifest` (nombre, colores, icono) y `www/sw.js` (caché offline + fallback) con registro automático en `index.html`. No necesitas hosting de InteeBuild: sube la carpeta `www/` a tu hosting y ya es instalable.

Desactívala con `pwaEnabled: false` si tu web ya trae su propio manifest.

## Minify

Marca `Minificar HTML` (Ajustes de WebView) o envía `minify: true`. Quita comentarios HTML y espacios extra del código generado. Seguro por defecto (no toca tu JS).

## Ficha Play Store

```bash
curl -X POST /api/listing -H "Content-Type: application/json" \
  -d '{"appName":"Mi Radio","url":"https://mi-radio.com","packageName":"com.miempresa.radio","permissions":{"foreground":true}}'
```

Devuelve `title` (30 chars), `shortDescription` (80), `fullDescription` con features y permisos declarados, `keywords` y `version`. Cópialo a Play Console.

## Nota sobre IA

El Analyzer de InteeBuild es 100% local con reglas (sin Gemini, sin OpenAI, sin claves). No hay funciones que requieran pagar una API de IA.
