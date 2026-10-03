# Preguntas frecuentes

Respuestas cortas a lo que más se pregunta. Cada una apunta a la guía donde se comprueba contra el código.

## ¿Qué provider elijo?

`capacitor` si no tienes motivos para cambiar: es el único con todos los parches probados (permisos runtime, accesos especiales, audio nativo, Droncito Pack). `native` si quieres el APK más ligero; `gecko` si necesitas el motor Mozilla; `twa`, `cordova`, `flutter` y `tauri` para esos ecosistemas concretos. Todos compilan hoy en CI. Detalle y límites de cada uno en [providers.md](./providers.md).

## ¿Flutter y Tauri compilan de verdad?

Sí. `flutter` lanza el job `flutter-build` (Ubuntu + `flutter create` + `flutter build apk`) y entrega artefacto `-apk` y, si lo pediste, `-aab`. `tauri` lanza `tauri-build` (Windows + `cargo build --release`) y entrega `-exe`. El workflow recibe el provider como input y salta o activa cada job según corresponde. Ver [outputs.md](./outputs.md).

## ¿Cuántos builds puedo hacer?

10 por hora y por IP, más 10 decompilaciones por hora. El límite se aplica en el servidor sobre tu IP; cuando se cumple la API responde `429`.

## ¿Dónde veo el log completo del build?

En la ficha del build, la consola muestra el log de todos los jobs y pasos (hasta 500 KB por build). Por API: `GET /api/build/:id/logs`. Si necesitas el detalle crudo, GitHub Actions conserva el run mientras viva la rama y el artefacto (30 minutos).

## ¿El build de iOS funciona?

Sí. El workflow usa `pod install` y compila contra `App.xcworkspace` (no `App.xcodeproj`), que es lo que hace falta con los pods de Capacitor. Sin certificados, el paso `ios-build` compila en simulador con la firma desactivada; con `.p12` y `.mobileprovision` en el paso de firma, archiva para dispositivo. Ver [outputs.md](./outputs.md).

## ¿Por qué se corta el audio con la pantalla apagada?

Casi siempre una de estas tres: la URL es `blob:` (hls.js, YouTube), tu HTML pausa en `visibilitychange`, o el build no trae `foreground` + `streamUrl`. El provider `gecko` nunca tendrá traspaso a nativo porque GeckoView no permite `addJavascriptInterface`. Checklist completo en [foreground.md](./foreground.md).

## ¿Qué significa cada badge del Audit?

`GENERATED OK` = el elemento está en el ZIP que se va a compilar. `SPEC ONLY, NOT GENERATED` = lo pediste pero no se generó. `NO GENERADO` = no hay implementación (bloquea la build, como `ads`). En la columna de provider: `OK (<provider>)`, `WARN (<provider> sin handler declarado...)` o `WARN (<provider> compila APK en CI...)`. Ver [permissions.md](./permissions.md).

## ¿Cuánto pesa la app?

Los límites del servidor son 7 MB para el icono y 500 KB para el HTML. El APK de `native` es el más ligero porque no arrastra el runtime de Capacitor; con `gecko` el build tarda bastante más porque `patch-gecko-gradle.js` descarga el AAR de Mozilla desde `maven.mozilla.org` en cada compilación.

## ¿Puedo compilar sin el estudio?

Sí: `POST /api/project` devuelve el ZIP con todo (workflow incluido) y puedes subirlo a tu propio repo de GitHub. El workflow `build-app.yml` es el mismo que usa el servidor; los inputs son `id`, `platform`, `outputs` y `provider`. Ver [api.md](./api.md).

## ¿Los artefactos se guardan para siempre?

No: viven en GitHub Actions 30 minutos y el servidor los limpia igual. El historial local (`GET /api/history`) conserva los metadatos y el enlace mientras dure la entrada; si caducó, vuelve a compilar.

## ¿La app funciona offline?

La PWA sí: con `pwaEnabled` (viene activado) el ZIP incluye `manifest.webmanifest` y `sw.js` con caché offline de tu HTML. La app Android muestra tu web dentro de su WebView; la caché offline del service worker depende de tu HTML y de las cabeceras de tu servidor. Ver [outputs.md](./outputs.md).

## ¿Qué toca cada elección de apariencia?

`accentColor` entra en el manifiesto y los colores nativos, `splashColor` en la pantalla de arranque, `orientation` en el manifiesto y en la ventana de escritorio. El detalle está en [ui-ux.md](./ui-ux.md).

Si algo falla, empieza por [troubleshooting.md](./troubleshooting.md).
