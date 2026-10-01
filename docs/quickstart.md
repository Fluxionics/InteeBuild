# Inicio rápido

Esta guía lleva de una web a un APK instalable usando el estudio en `index.html`. Tarda unos minutos en configurarse; la espera real es la de GitHub Actions, entre tres y seis minutos por build en un runner gratuito.

## 1. Preparar la fuente

El estudio acepta dos entradas en el paso **Aplicación**:

- **URL**: debe empezar por `http://` o `https://` y ser pública. localhost, IPs privadas y los endpoints de metadatos de la nube están bloqueados por seguridad (`isBlockedUrl` en `server/url-guard.js`), y esa misma regla se aplica en `/api/build` y `/api/project`.
- **HTML directo**: pega tu código. El límite es de 500.000 caracteres; si tu página es más grande, minifícala antes de pegarla.

Antes de seguir, pulsa **Analizar salud web**. Devuelve una puntuación de 0 a 100 con las incidencias concretas (HTTPS, viewport, favicon, recursos `http://`). No es un requisito para compilar, pero casi todos los problemas de "pantalla en blanco" empiezan ahí. El detalle está en [analyzer.md](./analyzer.md).

## 2. Plantilla o permisos a mano

Si no sabes qué permisos necesita tu app, elige una plantilla (hay 29, ver [templates.md](./templates.md)): sólo precarga permisos, orientación y flags de UI, nunca toca tu HTML.

Si los marcas a mano, sólo marca lo que tu web use de verdad. Google Play rechaza permisos sensibles sin justificación (SMS, teléfono, superposición) y el Audit te avisará de incoherencias como `gpsBackground` sin `gps`.

## 3. Personalizar

Los campos con validación estricta, porque suelen ser el motivo de un 400:

- **Nombre**: letras, números, espacios, guiones y puntos, de 2 a 40 caracteres. Ejemplo: `Mi Tienda`.
- **Package ID**: minúsculas, números y guion bajo, con al menos un punto. Ejemplo: `com.miempresa.miapp`. Si lo dejas vacío se genera `com.inteebuild.<slug>`.
- **Versión**: números separados por puntos, hasta cuatro componentes. Ejemplo: `1.0.0`.
- **Salida**: `apk`, `aab` o `both`. No hay otras: no se generan binarios de escritorio ni de iOS salvo lo que se indique abajo.
- **Icono**: PNG, JPG o WebP en data URL. El límite son 7 * 1024 * 1024 caracteres de base64.

El resto (orientación, splash, colores, drawer, inyección de JS) está documentado en [ui-ux.md](./ui-ux.md).

## 4. Revisar y compilar

En el paso **QA** aparece el Audit y el readiness. Si el botón de compilación se queja, el motivo es uno de estos:

- `Falta URL o HTML` — vuelve al paso 1.
- `Audio nativo activo pero sin URL del stream` — la plantilla Radio trae `nativeAudio: true` con `streamUrl` vacío a propósito; pega tu stream en el paso Ajustes (ver [foreground.md](./foreground.md)).
- Un permiso en `fail` del Audit — corrígelo en vez de forzar el build.

Al compilar, el servidor sube el proyecto a una rama `build-<id>` de tu repo y despacha el workflow. El progreso se consulta cada 6 segundos (hasta 200 intentos) y los logs quedan en `GET /api/build/:id/logs` y en el enlace a GitHub Actions.

Cuando termina, descarga el APK desde el resultado. Para instalarlo en Android hay que permitir "instalar apps desconocidas" para el navegador o gestor que use.

## Límites que vas a encontrar

- 10 builds por hora por IP. Si llegas al 429, espera a que venza la ventana.
- Las ramas de build se borran al terminar el run (un minuto después) y los artefactos de GitHub caducan a los 30 minutos: si el enlace de descarga expiró, vuelve a compilar.
- El historial se guarda en disco local (`data/history.json`), 50 entradas, y `GET /api/history` devuelve las 30 últimas. En Render free el disco se borra al reiniciar.

## Siguiente paso

- Si algo falla: [troubleshooting.md](./troubleshooting.md).
- Permisos con pruebas reales: [permissions.md](./permissions.md).
- Radios y podcasts: [foreground.md](./foreground.md).
- Automatización desde tu backend: [api.md](./api.md) y el panel `developer.html`.
- El botón **JSON** del historial guarda tu configuración para reutilizarla.
