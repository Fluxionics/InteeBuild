# Plantillas

InteeBuild trae 29 plantillas. No son presets decorativos: cada una define una configuración completa y verificada que permite compilar a la primera. Están repartidas en `server/templates/` por familia (`core`, `media`, `commerce`, `location`, `social`, `wellness`, `secure`) y se ensamblan en `server/templates/index.js`.

Una plantilla sólo aporta valores por defecto. El Permission Engine autocompleta los plugins que los permisos necesitan y el Audit tiene que dar `canBuild: true` para que la build se lance.

## Cómo se aplica una plantilla

`applyTemplate` fusiona la configuración de la plantilla como base y pone los valores del usuario encima: lo que escribas tú gana. Los objetos `permissions` y `plugins` se fusionan permiso a permiso, así que puedes marcar uno extra sin perder los que trae la plantilla.

Ese mismo merge sucede cuando envías `template` a `POST /api/build` o a `POST /api/v1/build`. Si no envías plantilla, la configuración sale limpiamente de lo que mandes en `normalizeConfig`.

## Contenido de cada familia

**`core`** — web, pwa, blog, portafolio, news, dashboard, empresa, edu.

- `web` es la base mínima: sin permisos, sólo INTERNET, con pull-to-refresh, pantalla offline y descargas.
- `pwa` añade `notifications` y `storage`, y activa `webManifest` y `serviceWorker` para que salga una PWA instalable.
- `blog` y `portafolio` añaden avisos y lectura; `news` además restringe orientación a vertical.
- `dashboard` deja sólo notificaciones; `empresa` añade biometría, `flagSecure` y `outputType: aab` para Play Store; `edu` añade cámara y micrófono.

**`media`** — radio, streaming, podcast, ai, game.

- `radio` activa `nativeAudio`, `nativeAutoplay`, `mediaSession` y `audioFocus`, con permisos `foreground`, `wakeLock` y `notifications`, y la pantalla offline con el mensaje "Sin conexión. El stream necesita internet."
- `streaming` usa `nativeAudio` con orientación por sensor y `keepScreenOn`.
- `podcast` suma `storage` para descargas y `mediaSession` para controles de medios.
- `ai` habilita micrófono y cámara para reconocimiento de voz.
- `game` es horizontal, a pantalla completa, con vibración, `wakeLock` y `keepScreenOn`.

**`commerce`** — ecommerce, marketplace, food, realestate. Todos llevan cámara para fotos de producto, GPS y almacenamiento; `marketplace` y `food` añaden notificaciones, `realestate` añade `phone` para llamadas directas.

**`location`** — maps, travel, delivery, eventos.

- `maps` es el mínimo viable con GPS en primer plano y nada más.
- `travel` combina GPS, cámara, almacenamiento y avisos de viaje.
- `delivery` añade `gpsBackground`, `keepScreenOn` y cámara para evidencias de entrega.
- `eventos` cubre cámara para escanear QR y GPS para localizar el recinto.

**`social`** — comunidad y social. Ambas piden cámara, almacenamiento y notificaciones; `social` suma GPS para geolocalizar publicaciones.

**`wellness`** — salud y fitness. Ambas usan `sensors` y `activityRecognition`; `fitness` añade GPS, `wakeLock` y `keepScreenOn`.

**`secure`** — finanzas, banking, emergency, lab.

- `finanzas` y `banking` comparten `biometric` + `notifications`, `flagSecure`, `blockSelection` y `outputType: aab`; `banking` añade `screenCaptureSecurity`.
- `emergency` trae GPS con segundo plano, `phone` para llamada automática, cámara y `highPriority` para los avisos.
- `lab` (Permission Test Lab) pide diez permisos a la vez y su cara de ejemplo ejecuta cada prueba en el dispositivo y reporta el resultado real.

Los tres casos que llevan `outputType: aab` son `empresa`, `finanzas` y `banking`, pensados para subir directo a Play Console. El resto genera APK.

## Caras de ejemplo

Cada plantilla puede traer una `faceHtml`, una página de ejemplo en HTML. La de radio, por ejemplo, tiene dos botones que llaman a `InteeAudio.play()` y `InteeAudio.pause()` y caen a un `<audio>` del navegador si el puente nativo no está. La cara no se guarda aparte: al aplicar la plantilla el estudio la escribe en el campo de HTML y cambia el origen a HTML. Si el editor estaba vacío lo hace solo; si ya tenías tu propio código, pregunta antes de reemplazarlo (y puedes volver a la cara cuando quieras con el botón de cara del editor). Si prefieres tu URL, deja la cara sin tocar y vuelve a elegir el origen por URL después.

Puedes ver la cara por API:

```bash
curl /api/templates            # lista con id, name, description y audit resumido
curl /api/templates/radio      # config completa + faceHtml
```

El listado de `/api/templates` ejecuta el Audit de cada plantilla con un nombre seguro y `https://example.com`, y devuelve `ok`, `total`, `readiness` y `canBuild`. Si alguna plantilla empieza a dar `canBuild: false`, ahí lo verás sin compilar nada.

## Comprobación nativa

`GET /api/templates/:id/native` genera los archivos reales de la plantilla en memoria y responde con el manifiesto, la lista de ficheros, los `.java` y `.xml` incluidos, si está `NativePermissions.java`, si está `RadioService.java`, si está el patch del catálogo, el `provider.json` y el audit. El campo `native100` es `true` cuando el audit verifica todo y permite compilar. Es la forma rápida de ver qué va a producir cada plantilla sin pedir un build.

## Foreground service y audio

Sólo tres plantillas piden `foreground`: `radio`, `streaming` y `podcast`. `wakeLock` aparecen esas mismas tres más `game` y `fitness`, y `keepScreenOn` aparece en `streaming`, `game`, `delivery`, `fitness` y `emergency`. `delivery` no pide `foreground`: su segundo plano lo resuelve con `gpsBackground`, que es otro permiso con otro manifiesto. El detalle de por qué existe ese código y cómo probarlo está en [foreground.md](./foreground.md).

## Personalización

Después de cargar una plantilla puedes cambiar lo que quieras en modo avanzado: permisos individuales, plugins, SDK, orientación, colores, splash y deep links. Si sólo cambias dos o tres cosas, manda los campos encima con `template: "radio"` y ya está: no hace falta que repitas lo que ya trae.

Las configuraciones reales de cada plantilla viven en `server/templates/*.js`, así que si te falta un caso de uso puedes añadirlo ahí con el mismo formato y aparecerá en `GET /api/templates`.
