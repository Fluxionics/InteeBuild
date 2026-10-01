# Analyzer: seguridad, errores y optimización antes de compilar

El analyzer audita tu web sin compilar nada. Se dispara con el botón `Analizar salud web` del paso de Aplicación o desde la API con `GET /api/analyze?url=…`. Si lo que quieres revisar es HTML suelto, `POST /api/analyze/html` hace el mismo trabajo sin descargar nada.

No es un analizador de seguridad certificado: son reglas locales del servidor, sin IA ni servicios externos. Sirven para ver de golpe qué te falta antes de meter tu web en un WebView.

## Comprobaciones base

Descarga la página con un timeout de 10 segundos y comprueba una lista de cosas concretas: que use HTTPS, que responda, que tenga `meta viewport`, manifest, favicon, theme-color, service worker, que ningún `src` ni `href` apunte a `http://`, que el HTML tenga doctype, y presencia de Open Graph y datos estructurados. Si trae manifest, intenta descargarlo en `/manifest.json` o `/manifest.webmanifest` para devolver su contenido en `pwa`.

De ahí sale un `score` de 0 a 100 y un diagnóstico en texto: `Listo para compilar` a partir de 90, `Bueno, con mejoras menores` desde 70, `Necesita ajustes` desde 50 y `Requiere correcciones` por debajo. Cada comprobación suma o resta puntos: viewport y service worker pesan más que el favicon.

La petición va con `redirect: manual`, así que no sigue redirecciones: si la respuesta es 3xx, sólo se comprueba que la cabecera `Location` no apunte a una URL privada y se devuelve el estado tal cual.

## Seguridad

El módulo `security` devuelve su propio `score` (0-100), un `level` (`Excelente`, `Bueno`, `Riesgo medio`, `Crítico`) y una lista de incidencias con severidad y arreglo propuesto. Detecta:

- Falta de HTTPS (resta 25).
- Ausencia de Content-Security-Policy, tanto en cabecera como en `http-equiv`.
- Recursos cargados con `http://` y scripts externos por HTTP.
- `eval()` en el HTML.
- `innerHTML` sin sanitizar.
- Cookies leídas sin flag `Secure`.
- jQuery 1.x o 2.x.
- Falta de `X-Content-Type-Options: nosniff`.

Todo esto aplica igual dentro del WebView: mixed content y `eval()` siguen siendo un problema en una app empaquetada.

## Errores

`errors` devuelve dos listas. `errors` es para lo que rompe de verdad: falta de `<!DOCTYPE html>` y falta de la etiqueta `<html>`. `warnings` es lo demás, con `type`, mensaje y arreglo: IDs duplicados (con los tres primeros), posible desajuste de etiquetas sin cerrar, imágenes sin `alt`, más de 15 estilos inline, `var` en lugar de `let` o `const`, posible asignación dentro de un `if`, y enlaces `#` vacíos. El resumen lleva `total`, `altMissing` y `duplicateIds`.

## Optimización

`optimization` devuelve `score`, `grade` (`A` desde 85, `B` desde 70, `C` desde 50, `D` por debajo), `sizeKB`, `images`, `scripts` y una lista de `tips` con impacto `high`, `medium` o `low`. Revisa peso del HTML, cantidad de imágenes y cuántas van sin `loading="lazy"`, número de scripts externos, CSS bloqueante, ausencia de WebP y bloques `<style>` repetidos.

## Frameworks, Web APIs y permisos

`frameworks` es una lista de etiquetas detectadas por regex: React, Vue, Angular, Next.js, Nuxt, Svelte, Astro, Vite, WordPress, Shopify, Webflow, Wix, Bubble, Lovable, Replit, Bootstrap y Tailwind. Si no reconoce nada devuelve `html`.

`detectedApis` lista las Web APIs presentes: geolocalización, cámara, micrófono, Bluetooth, NFC, notificaciones, vibración, compartir, pantalla completa, orientación, localStorage, indexedDB, service worker, WebGL, pagos, portapapeles y wake lock. Con eso `recommendations` traduce a qué permisos y plugins faltarían: por ejemplo, `geolocation` sugiere el permiso `gps` y el plugin `geolocation`.

Esa misma cadena es la que usa el botón `Sugerir por Web API` del paso de Permisos, y también `POST /api/permissions/suggest`, que acepta HTML, URL o la lista de APIs ya detectada.

## Auto-fix

`autoFixHtml` hace cuatro cosas, y nada más: cambia `http://` por `https://` en `src` y `href`, añade `loading="lazy"` a las imágenes que no lo tengan, inyecta el `meta viewport` si falta, y añade `alt=""` a las imágenes sin `alt`. El resultado se compara con el original para decir `autoFix.available`, y los primeros 8.000 caracteres van en `autoFix.preview`.

Hay tres formas de aplicarlo:

- `POST /api/analyze/fix` devuelve `{fixed, originalLength, fixedLength}` con el HTML completo corregido.
- `POST /api/analyze/html` devuelve `autoFix.full` además de `preview`.
- El botón `Aplicar Auto-Fix y previsualizar HTML optimizado` del estudio pone el resultado en el editor para que lo revises.

Es heurístico. `alt=""` vacío no es una descripción accesible, y forzar `https://` en un recurso que no existe en HTTPS deja la imagen rota. Revisa el diff antes de dar por buena la salida.

## Orden de trabajo recomendado

Analiza primero con la URL, y si el score baja de 70 aplica el fix y mira la lista de optimización. Después revisa `security`: un `eval()` o mixed content que pases por alto ahora aparece igual en el build. Usa `Sugerir por Web API` para marcar sólo los permisos que tu web usa de verdad, comprueba el resultado en el Audit del paso de Permisos, y vuelve a analizar cuando cambies cosas grandes de tu sitio.

Los límites de tamaño están en [api.md](./api.md); lo que hace el Permission Engine con esa información, en [permissions.md](./permissions.md).
