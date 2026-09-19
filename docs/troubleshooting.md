# Solución de problemas

## El APK no se descarga

1. Verifica que la compilación terminó en estado **Completado**.
2. El botón de descarga usa `/api/download/<id>`. Si el historial se limpió en el servidor, el enlace expira: compila de nuevo.
3. Las ramas y artefactos se borran a los 30 minutos automáticamente.

## GitHub Actions falló

1. En el resultado del build pulsa **Logs** para abrir la ejecución en GitHub.
2. Errores comunes:
   - **Workflow sin trigger**: espera unos segundos y reintenta. El servidor reintenta solo hasta 6 veces.
   - **Fallo en Gradle**: suele ser un SDK incompatible. Prueba compileSdk 35 + targetSdk 35.
   - **Sin artefacto**: la compilación no generó APK/AAB. Revisa que el tipo de salida coincida con lo compilado.

## La app no abre / pantalla en blanco

1. Si tu URL es `http://` (sin S), activa **Tráfico HTTP** en Ajustes.
2. Verifica que tu sitio no bloquee ser embebido (cabeceras `X-Frame-Options` o CSP `frame-ancestors`). La app usa WebView: si tu servidor lo prohíbe, verás blanco.
3. Abre la consola del navegador en tu sitio y corrige errores de JavaScript: rompen igual dentro de la app.

## El analizador da puntuación baja

- **Sin HTTPS**: consigue un certificado (Let's Encrypt es gratis).
- **Sin viewport**: agrega `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- **Sin favicon**: agrega un icono; también úsalo como icono de la app.
- **Recursos inseguros**: cambia los `http://` por `https://` en imágenes y scripts.

## Error de validación del formulario

- **Nombre**: solo letras, números, espacios, guiones y puntos (2-40). Ejemplo: `Mi Tienda`.
- **Package ID**: minúsculas, números y puntos, con al menos un punto. Ejemplo: `com.miempresa.miapp`.
- **Versión**: números con puntos. Ejemplo: `1.0.0`.
- **HTML vacío**: pega tu código o usa el ejemplo incluido.

## Límite de compilaciones

Máximo 10 compilaciones por hora e IP. Si lo alcanzas, espera y reintenta.

## El botón Compilar no hace nada o dice qué corregir

Desde esta versión el botón primero consulta `POST /api/build-readiness` y te muestra el motivo exacto en rojo. Los más comunes:

- `Audio nativo activo pero sin URL del stream` → pega tu servidor en Paso 4 → tarjeta `Audio 100% nativo`.
- `Falta URL o HTML` → vuelve al Paso 1 y pon tu fuente.
- `X requiere Android N+` → sube `targetSdk` o quita ese permiso.
- Si el botón se ve opaco, igual haz clic: te dirá qué falta (ya no se bloquea en silencio).

## Consola del navegador: qué ignorar y qué no

- `ERR_BLOCKED_BY_CLIENT (invoke.js)` → era tu adblocker contra el dominio de ads. Desde esta versión los ads se sirven first-party (`/api/ads`), así que si aún lo ves haz **recarga dura** (Ctrl+Shift+R) o espera el redeploy en Render.
- `cdn.tailwindcss.com should not be used in production` → aviso amarillo de Tailwind, tu app funciona igual. Solo optimiza si quieres arranque más rápido.
- `No label associated with a form field` → aviso de accesibilidad ya corregido (los labels de pasos ahora son `span`). No bloquea nada.
- `Uncaught SyntaxError: Invalid or unexpected token` en `index.html` → era el visor de Developer Mode, ya corregido. Si lo ves, recarga dura.

## Permission Audit failed / Readiness bajo

1. Pulsa `Ejecutar Audit` en el Paso 2. Lee cada fila: `GENERATED OK` vs `SPEC ONLY`.
2. `gpsBackground sin gps` → marca también `Ubicación precisa`.
3. `Bluetooth legacy en target 35` → usa `Scan + Connect`.
4. `Alarmas` → elige `SCHEDULE` o `USE`, no ambas.
5. Si el botón Generar está deshabilitado, el Audit tiene un `fail`: corrígelo, no lo fuerces.

## Provider no disponible

- `Flutter / Tauri` muestran `PLANNED`: solo generan README, no APK. Usa `Capacitor` o `Native`.
- `TWA` requiere Chrome + `assetlinks.json` en tu dominio. Sin eso, la app abre en blanco.

## Permiso denegado en Android

1. Verifica en el ZIP (`POST /api/project`) que `main-manifest.xml` tenga la línea.
2. En Android: Ajustes → Apps → tu app → Permisos → concede manualmente una vez.
3. Si tu web pide cámara y no marcaste `cameraMic`, el WebView responde `deny()` a propósito. Marca el permiso y recompila.
