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
