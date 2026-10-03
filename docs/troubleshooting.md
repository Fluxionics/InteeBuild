# Solución de problemas

Los casos de este listado son los que más se repiten. Empieza por leer el mensaje completo: la mayoría dice exactamente qué falta.

## El botón Compilar no avanza

Antes de lanzar nada, el estudio llama a `POST /api/build-readiness` y, si `canBuild` es `false`, muestra los `warnings` en rojo y no compila. Los avisos más habituales:

- `Audio nativo activo pero sin URL del stream: pon tu servidor en Audio nativo` — la plantilla de radio o streaming trae `nativeAudio` activado y el campo del stream vacío. Rellénalo en el paso de Ajustes, tarjeta de audio nativo.
- `streamUrl debe empezar con http:// o https://` — te falta el esquema en la URL del stream.
- `Falta URL o HTML` — no hay fuente en el paso 1.
- `X requiere Android N+` — un permiso pide un `targetSdk` más alto. Sube el SDK o quita el permiso.

Si el chequeo de readiness no responde, el estudio intenta compilar igual y te muestra el error real del servidor.

En el paso de QA también hay una lista de puntos que se pone en rojo. Con uno fallado, o sin aceptar los términos, el botón de avance queda deshabilitado: es intencional, pero el mensaje de arriba te dice qué corregir.

## El build ni siquiera arranca

- `503 "GitHub no configurado..."` — faltan `GITHUB_TOKEN` o `INTEE_BUILDS_REPO`. Mira `/api/diag`.
- `429` con `Limite de builds alcanzado (10 por hora)` — el contador es por IP y lo comparten `/api/build`, `/api/v1/build` y `/api/decompile/cloud`. Espera a que venza la hora.
- `400` con mensaje de validación — el texto lo explica: nombre de app, package ID, versión, URL bloqueada, HTML de más de 500.000 caracteres o icono de más de 7 MB.
- `401` en `/api/v1/build` — ya existe al menos una API key y no estás enviando ninguna. Crea una con `POST /api/keys`.

## GitHub Actions falló

Abre el enlace del run desde el resultado del build o desde `/api/build/:id`. Errores frecuentes:

- **`422 No workflow found with any ref`** — el workflow todavía no está registrado en la rama base. El servidor reintenta solo, hasta seis veces con espera creciente; si sigue fallando, espera unos segundos y vuelve a lanzar.
- **Fallo de Gradle** — casi siempre SDK o dependencia. Prueba `compileSdk` y `targetSdk` 35, que son los valores con los que está probado el generador. Los pasos del run se llaman `Compile APK`, `Compile Release APK`, `Compile AAB` y `Compile Release AAB`.
- **`package org.mozilla.geckoview does not exist`** — el paso `Apply GeckoView dependencies` no corrió o su patch falló: en el log debe salir `geckoview` tras `grep -c geckoview android/app/build.gradle`. Si el ZIP es de una versión anterior del generador, regenera el proyecto; si sigue sin estar, cambia a `capacitor` o `native`.
- **El workflow termina sin artefacto** — la salida pedida (`apk`, `aab` o `both`) no coincide con lo que se compiló, o Gradle no llegó a empaquetar. Mira los pasos `Compile APK` y `Compile AAB` del run.

## El APK no se descarga

1. Comprueba que la build llegó a `success`.
2. `/api/download/:id` necesita que la build siga en memoria del servidor: si el proceso se reinició, responde `404` aunque el artefacto exista en GitHub.
3. Las ramas se borran alrededor de un minuto tras completar, y el barrido automático de cada 30 minutos elimina runs y artefactos con más de 30 minutos. Si caducó, vuelve a compilar.
4. `404 "AAB no encontrado"` significa que pediste APK; `IPA no encontrado (firma iOS requerida)` significa que no hubo certificados de Apple.

## La app se abre en blanco

- Si desactivaste la opción de tráfico HTTP (cleartext), el manifiesto sale con `android:usesCleartextTraffic="false"` y una URL `http://` no carga: verás blanco. Actívala de nuevo o usa HTTPS. Por defecto el manifiesto sí permite cleartext.
- Comprueba que tu sitio permita ser embebido: cabeceras `X-Frame-Options` o `Content-Security-Policy: frame-ancestors` en tu servidor bloquean el WebView y ves una pantalla vacía.
- Revisa la consola de tu sitio con la app abierta: los errores de JavaScript son los mismos que en el navegador.
- Con provider `flutter` el APK viene del job `flutter-build` (mira sus pasos `Build APK`/`Build App Bundle`), no de `Compile APK`. Con provider `cordova` viene del job `cordova-build` (pasos `Compile Cordova APK`). Con provider `tauri` el APK sigue siendo el de Capacitor y además hay un `.exe` del job `tauri-build`. El provider `gecko` sí compila un APK distinto: la `MainActivity` es GeckoView.

## Permiso denegado en Android

1. Descarga el proyecto con `POST /api/project` y comprueba que `main-manifest.xml` incluye el permiso.
2. Concede el permiso manualmente desde Ajustes de Android la primera vez.
3. Si tu web pide cámara y no marcaste `cameraMic`, el `WebChromeClient` generado no incluye ese recurso en la lista permitida y responde `deny()`. Marca el permiso y vuelve a compilar.
4. Los permisos con `minSdk` alto dan un `warn` en el Audit si tu `targetSdk` es inferior; sube el SDK.

## Audit y readiness en rojo

- `gpsBackground sin gps` — activa también la ubicación precisa.
- `SPEC ONLY, NOT GENERATED` en una fila — el permiso está en el spec pero no llegó al manifiesto generado; suele ser un caso que necesita otro permiso base.
- `NO GENERADO` — no hay implementación para ese elemento (es lo que pasa con `ads`). El Audit lo trata como fallo y bloquea la build.
- Fila con `REQUIRES ANDROID N+` — sube `targetSdk` o quita el permiso.
- Si el botón de avance está deshabilitado, hay un `fail` en el Audit: corrígelo en lugar de forzarlo.

## Analizador con puntuación baja

- Sin HTTPS: el analizador resta 10 puntos y el módulo de seguridad descuenta 25 sobre su propia puntuación. Lo primero que hay que arreglar.
- Sin `viewport`: resta 10 (con él suma 20); añade `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- Sin service worker ni manifest: no llegan los 15 y 10 puntos que sumarían, y `checks.pwa` queda en `false`.
- Recursos con `http://`: resta 2 por recurso, con un tope de 20. El módulo de seguridad los cuenta aparte.
- Si el score es bajo, aplica el Auto-Fix y revisa el diff: el arreglo es heurístico y puede dejar `alt=""` vacío o forzar `https://` en un recurso que no exista.

## Errores en la consola del navegador

- `ERR_BLOCKED_BY_CLIENT` contra un dominio de anuncios — era un adblocker. Los anuncios ya se sirven desde tu propio dominio con `/api/ads/:slot`; si aún aparece, recarga con caché dura o despliega de nuevo.
- `cdn.tailwindcss.com should not be used in production` — aviso de Tailwind, no rompe nada.
- `No label associated with a form field` — aviso de accesibilidad, no bloquea nada.
- `Uncaught SyntaxError` al cargar el editor — recarga con caché dura.

## Validaciones del formulario

- Nombre: letras, números, espacios, guiones y puntos, de 2 a 40 caracteres.
- Package ID: minúsculas, números y guion bajo, con al menos un punto (`com.miempresa.miapp`).
- Versión: números con puntos (`1.0.0`).
- SDK: si el valor no está en la lista de válidos, el servidor lo sustituye por uno válido en lugar de rechazarlo.
- HTML vacío con origen HTML: se rechaza; pega tu código o usa la cara de una plantilla.

## Descompilador

- `413` o "APK demasiado grande" en la nube: 60 MB es el tope; el local llega a 100 MB.
- `Rate limit: 10/h por IP`: es el mismo contador que los builds.
- `409 Workflow todavía corriendo`: espera y reintenta la descarga.
- `404 El workflow terminó sin artefacto`: mira los logs del run; los APK ofuscados suelen fallar aquí.
- `500 Configura GITHUB_TOKEN...`: falta la misma configuración que para compilar.

## Diagnóstico del servidor

`/api/diag` recorre token, repo, rama y workflow y se detiene en el primero que falla, con un `hint` que dice qué cambiar. Si devuelve `ok: true` y el build sigue fallando, el problema está en el run de GitHub: abre sus logs. El detalle de cada campo está en [production.md](./production.md).

Si el problema es de permisos, la referencia está en [permissions.md](./permissions.md); si es de audio en segundo plano, en [foreground.md](./foreground.md).
