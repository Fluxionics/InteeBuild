# Documentación de InteeBuild

Esta carpeta es la documentación que carga `docs.html` en el navegador. Todas las guías están escritas para poder verificarse contra el código del repositorio: si una afirmación no se puede comprobar en `server/`, no debería estar aquí.

Si es tu primera vez, empieza por el [inicio rápido](./quickstart.md).

## Guías

- [quickstart.md](./quickstart.md) — de cero al primer APK con el estudio.
- [permissions.md](./permissions.md) — los 86 permisos granulares: qué genera cada uno, cómo probarlo y qué devuelve el Audit.
- [foreground.md](./foreground.md) — audio en segundo plano con `RadioService`, `MediaSession` y `WakeLock`.
- [templates.md](./templates.md) — las 29 plantillas y qué precarga cada una.
- [providers.md](./providers.md) — motores WebView: cuáles compilan y cuáles sólo generan código.
- [ui-ux.md](./ui-ux.md) — campos de apariencia y comportamiento que acepta el generador.
- [outputs.md](./outputs.md) — qué sale de cada build (APK, AAB, ZIP, PWA, ficha de Play Store).
- [api.md](./api.md) — API REST, API Keys, webhooks y ejemplos de `curl`.
- [analyzer.md](./analyzer.md) — analizador de salud web, puntuación y auto-fix.
- [decompiler.md](./decompiler.md) — descompilación local y en la nube.
- [versions.md](./versions.md) — versiones, comprobación de updates y auto-build en cada push.
- [security.md](./security.md) — límites del servidor, SSRF, API Keys y lo que la app generada expone.
- [production.md](./production.md) — despliegue en Render, entorno y diagnóstico.
- [troubleshooting.md](./troubleshooting.md) — errores frecuentes y su causa.
- [faq.md](./faq.md) — preguntas frecuentes: providers, límites, logs, iOS, audio.

## Convención de evidencia

- `GENERATED OK` significa que el elemento existe en el ZIP que se va a compilar, no en la definición. Puedes descargarlo con `POST /api/project` y buscarlo a mano.
- `SPEC ONLY, NOT GENERATED` significa que lo pediste pero no se generó: no lo despliegues.
- El Audit se ejecuta con `POST /api/permissions/audit` o con el botón de QA en el estudio.
- El orden de pruebas útil es uno: mínimo, un permiso por build, dispositivo real.
