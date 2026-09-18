# Documentación InteeBuild

Guías completas, verificables contra el código generado. Empieza por [inicio rápido](./quickstart.md).

## Índice

| Guía | Para qué |
|---|---|
| [quickstart.md](./quickstart.md) | Tu primer APK en 5 minutos |
| [permissions.md](./permissions.md) | **Todos los permisos**: dónde se activan, qué generan, cómo probarlos |
| [foreground.md](./foreground.md) | **Plantilla Foreground**: radio que suena con pantalla apagada |
| [providers.md](./providers.md) | Motores WebView: Capacitor, Native, TWA, Gecko, Cordova |
| [analyzer.md](./analyzer.md) | Seguridad, errores, optimización y auto-fix |
| [api.md](./api.md) | Developer API, keys, builds, readiness, webhooks |
| [decompiler.md](./decompiler.md) | Recuperar código fuente de un APK |
| [production.md](./production.md) | Despliegue gratis y seguro en Render |
| [troubleshooting.md](./troubleshooting.md) | Errores comunes y cómo resolverlos |

## Convención

- `GENERATED OK` = existe en el ZIP que se compila (verificable en `POST /api/project`).
- `Audit` = `POST /api/permissions/audit` o botón `Ejecutar Audit` en el Studio.
- Flujo de pruebas: mínimo → un permiso por build → Android real.
