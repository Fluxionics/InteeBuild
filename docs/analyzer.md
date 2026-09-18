# Analyzer — seguridad, errores y optimización antes de compilar

Botón `Analizar salud web` (Paso 1) o API. No compila nada, solo audita tu web.

## Qué analiza

| Módulo | Qué detecta | Score |
|---|---|---|
| Checks base | HTTPS, viewport, manifest, favicon, theme-color, service worker, recursos `http://`, HTML válido, PWA | 0-100 |
| Seguridad | Sin CSP, `eval()`, `innerHTML` sin sanitizar, cookies sin `Secure`, scripts `http://`, jQuery 1.x/2.x, falta `nosniff` | 0-100 + nivel |
| Errores | IDs duplicados, etiquetas sin cerrar, imágenes sin `alt`, estilos inline excesivos, `var` legacy, enlaces `#` vacíos, falta `DOCTYPE` | lista |
| Optimización | HTML pesado, imágenes sin `lazy`, scripts bloqueantes, CSS bloqueante, sin WebP | A/B/C/D |
| Frameworks | React, Vue, Angular, Next, WordPress, Shopify... | etiquetas |
| Web APIs | geolocation, camera, bluetooth, NFC, notifications... → sugiere permisos | autopilot |

## Auto-fix

`POST /api/analyze/fix` o botón `Aplicar Auto-Fix`: convierte `http://` → `https://`, agrega `loading="lazy"` y `alt` a `<img>`, inyecta `viewport` si falta. Revisa el diff antes de compilar: el fix es heurístico.

## Cómo usarlo bien

1. Analiza tu URL. Si el score < 70, aplica el fix y los tips de optimización.
2. Revisa `Seguridad`: un `eval()` o mixed-content rompe igual dentro del WebView.
3. Usa `Sugerir por Web API` (Permission Engine) para marcar solo los permisos que tu web realmente usa.
4. Vuelve a analizar tras cada cambio mayor de tu sitio.
