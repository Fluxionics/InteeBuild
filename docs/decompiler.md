# Decompiler — recupera el código fuente de un APK

Sube un APK (máx 30MB) en el Studio (Paso 7 → Descompilador) o por API y obtén package, permisos, manifest y un ZIP con el código fuente.

## Qué devuelve

```json
{
  "meta": { "packageName": "com.example.app", "appName": "Mi App", "permissions": ["camera"], "hasDex": true, "hasIcon": true, "fileCount": 120, "versionName": "1.0.0" },
  "entries": ["AndroidManifest.xml", "classes.dex", "res/..."],
  "manifestPreview": "<manifest package=\"...\">...",
  "importConfig": { "appName": "...", "packageName": "...", "permissions": {} },
  "sourceZipBase64": "UEs...",
  "sourceZipSizeKB": 450
}
```

- APK de InteeBuild: recupera `build-config.json` al 100% + ZIP fuente listo.
- APK real: heurística sobre `AndroidManifest.xml` (texto o binario), `capacitor.config.json`, `www/index.html` y `classes.dex`. Revisa `package/permisos` antes de importar.
- ZIP genérico: lista archivos y empaqueta fuente.

## Cómo usarlo

1. Studio → Paso 7 → `Seleccionar APK` → `Descompilar`.
2. Revisa package, permisos y `Manifest preview`.
3. `Descargar ZIP fuente` para inspeccionar `manifest/dex/res/www`.
4. `Importar como proyecto` rellena el wizard (nombre, package, URL, permisos) → revisa el Audit → compila.

## Límites

- Solo ZIP/APK válidos (JSZip). Binarios ofuscados no se desofuscan.
- Archivos > 4MB dentro del ZIP se excluyen del `sourceZip` para no romper el navegador.
- El `importConfig` de APK externos usa `https://example.com` como URL: cámbiala por la real.
