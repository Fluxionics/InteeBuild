# Interfaz y experiencia de la app

Esta guía cubre los campos de aspecto y comportamiento que controlas desde el paso de Ajustes del estudio. Todos ellos son configuración de generación: lo que marcas aquí termina en un manifiesto, un `capacitor.config.json`, un `colors.xml` o un script que se inyecta en tu HTML.

Para saber qué campo hace qué, la regla es sencilla: si no aparece en esta lista, o aparece marcado como sin efecto, compruébalo con `POST /api/project` y mira el ZIP antes de dar nada por hecho.

## Estilo y apariencia

**Tema (`appTheme`)** — `system` (por defecto), `light` o `dark`. Elige si la barra de estado se pone en estilo claro u oscuro: cuando está activo el plugin de StatusBar o el modo edge-to-edge, el `capacitor.config.json` sale con `StatusBar.style` en `DARK` si el tema es oscuro y en `LIGHT` en caso contrario. No altera los colores de tu propia web.

**Transición inicial (`entryAnimation`)** — `none` (por defecto), `fade` o `slide`. Se guarda en `build-config.json`, pero ningún parche del generador la aplica hoy: es un valor que queda registrado sin traducirse en código.

**Color de acento (`accentColor`)** — por defecto `#4f46e5`. Si lo cambias, el ZIP incluye `custom-colors.xml` con `colorPrimary` y `colorAccent`; ese fichero lo copia el workflow a `res/values/colors.xml`. El mismo color se usa como `theme_color` del manifest PWA y como acento del script inyectado.

**Color de barra de estado (`statusBarColor`)** — por defecto `#ffffff`. Va a `colorPrimaryDark` del mismo `custom-colors.xml` y a `StatusBar.backgroundColor` cuando el plugin de StatusBar está activo.

**Color de barra de navegación (`navigationBarColor`)** — por defecto `#ffffff`. Sirve para decidir si se genera el `custom-colors.xml`, pero no escribe ningún valor con ese color: el fichero sólo contiene `colorPrimary`, `colorPrimaryDark` y `colorAccent`.

Los tres colores sólo generan el fichero si alguno se aleja de su valor por defecto; con la configuración de fábrica no aparece en el ZIP.

**Diseño edge-to-edge (`edgeToEdge`)** — activa `overlaysWebView` en el plugin de StatusBar, de modo que tu contenido se dibuja por debajo de las barras del sistema. Combinado con `statusBarColor` decides qué color queda detrás.

## Comportamiento de pantalla

**Orientación (`orientation`)** — `any` (por defecto), `portrait`, `landscape` o `sensor`. Se escribe en el manifiesto como `screenOrientation`.

**Pantalla completa (`fullscreen`)** — oculta la barra de estado superior y hace que el splash sea inmersivo.

**Mantener pantalla encendida (`keepScreenOn`)** — añade `android:keepScreenOn="true"` a la actividad. Para video, juegos y streaming; lo trae `streaming`, `game`, `delivery`, `fitness` y `emergency`.

**Tráfico inseguro (`useCleartext`)** — activado por defecto. Pone `android:usesCleartextTraffic="true"` en el manifiesto y `server.cleartext` y `android.allowMixedContent` en `capacitor.config.json`, además de fijar `androidScheme` a `http` si tu URL es `http://`. Si lo desactivas y tu fuente es `http://`, la app no carga nada.

## Splash

`splashEnabled` escribe la configuración de `SplashScreen` en `capacitor.config.json` con `launchAutoHide: true`, la duración y el color de fondo. `splashDuration` se acepta entre 500 y 5000 ms y por defecto son 2000. `splashColor` se reutiliza además como `background_color` del manifest PWA.

No hay campo de imagen de splash: el fondo es plano y el icono lo pone el sistema. Las plantillas `radio` traen el splash desactivado para que la app abra directa.

## Enlaces profundos

`deepLinksEnabled` con `deepLinkDomain` añade un `intent-filter` con `autoVerify` al manifiesto, y el dominio se usa también para generar `assetlinks.json` y `.well-known/assetlinks.json`. `deepLinkPaths` admite hasta diez rutas. El archivo tiene que colgar de tu dominio para que App Links funcione: la huella de certificado que trae es de relleno y hay que sustituirla (más detalle en [providers.md](./providers.md)).

## Ajustes de la WebView

**Acción del botón Atrás (`backButtonBehavior`)** — `back` (por defecto) vuelve en el historial y sale si no hay más historial; `exit` llama a `finishAffinity()`; `confirm` muestra un diálogo "¿Deseas salir de la app?"; `none` no hace nada. El parche lo escribe sobre `MainActivity`.

**User-Agent personalizado (`userAgent`)** — el campo existe, pero si lo rellenas sólo se activa `webContentsDebuggingEnabled: false` en el `capacitor.config.json`. No cambia el UA de la WebView: no lo esperes para esconder tu app detrás de otro navegador.

**Modo de caché (`cacheMode`)** — `normal`, `no-cache` o `force-cache`. Se normaliza y se guarda, pero no llega a ningún generador: no cambia el comportamiento de la app.

**Cabeceras HTTP personalizadas (`customHeaders`)** — misma situación: se acepta y se recorta, sin efecto en la generación.

**Inyección de JavaScript (`jsInjection`) y de estilos (`cssInjection`)** — si los rellenas, el ZIP incluye `www/inject.js` y `www/inject.css` con ese contenido. No se añaden solos a tu HTML: tu página tiene que referenciarlos con `<script src="inject.js">` y `<link rel="stylesheet" href="inject.css">`.

**Minificar HTML (`minify`)** — quita comentarios y espacios sobrantes del HTML generado y comentarios de `catalog.js`. No toca tu JavaScript ni es un minificador de producción.

## Avisos programados

`notifyOnOpen`, `notifyOnClose` y `notifyDelayMinutes` con `notifyTitle` y `notifyText` generan un script que usa `LocalNotifications` para programar un aviso al abrir, al pasar a segundo plano o pasados los minutos indicados. Dos condiciones: sólo se inyecta si el origen es HTML, y necesita el plugin de notificaciones activado.

El bloque de "canales de notificación" (`notifChannel`, `notifImportance`, `notifSound`, `notifVibration`) tiene campos en el estudio, pero ninguno de esos cuatro valores se usa al generar: ni el canal de `RadioService` ni los avisos programados los leen. El canal del servicio de audio se llama `inteebuild_radio` con importancia baja, y es fijo.

## Funciones que se inyectan en tu web

El paso de Ajustes tiene un bloque de catálogo con funciones que se vuelcan en `catalog.js` y se ejecutan dentro de la WebView sobre tu propia página:

- **Pull-to-refresh** — deslizar hacia abajo con el scroll arriba recarga la página.
- **Offline screen** — capa fija con el `offlineMessage` (por defecto "Sin conexión. Revisa tu internet.") y un botón de reintento. Se activa con `offlineScreen`, que viene encendido salvo en `lab`.
- **Loading indicator** — `spinner` (capa centrada), `bar` (barra de 3 px arriba) o `none`.
- **Drawer lateral** (`drawerEnabled`) — botón fijo arriba a la izquierda que abre un panel con los `drawerItems`: hasta ocho objetos `{label, url, icon}` en JSON.
- **Bottom navigation** (`bottomNavEnabled`) — barra inferior con hasta cinco `{label, url, icon}` y `padding-bottom` automático en el body.
- **DownloadManager** — descargas nativas en vez de dejarlas en la WebView.
- **Bloqueo de selección** (`blockSelection`) — CSS de `user-select: none` (con excepción de campos de texto) y prevención del menú contextual.
- **Detección de root/jailbreak** (`rootDetection`) — parche `RootCheck` en `MainActivity`.
- **Encrypted Storage** — añade `capacitor-secure-storage-plugin` y el permiso `USE_BIOMETRIC`.

`flagSecure` no va por aquí: se aplica en Java, en `MainActivity`.

Si tu HTML es el que manda, acuérdate de que el script del catálogo se inyecta en el `</body>` después de tu código, y que el viewport y el charset sólo se aseguran cuando el origen es HTML. Si cargas una URL, es tu sitio el que tiene que traer su propio viewport.

## Accesibilidad y rendimiento

Nada de esto lo hace el generador por ti; es trabajo de tu HTML:

- El `meta viewport` se inyecta sólo en modo HTML. Si tu fuente es una URL, añádelo en tu sitio.
- Texto con contraste mínimo de 4.5:1, y 3:1 para texto grande.
- Objetivos táctiles de 48 dp o más.
- `alt` descriptivo en las imágenes. El Auto-Fix del analizador pone `alt=""`, que no sirve como descripción.
- Carga diferida de imágenes y recursos con `defer` o `async`. El analizador lo marca en `optimization`.

## Cómo comprobar lo que cambió

```bash
curl -X POST /api/project -H "Content-Type: application/json" -d '{"appName":"Mi App","url":"https://mi-web.com","accentColor":"#112233","entryAnimation":"fade","orientation":"portrait"}' -o proyecto.zip
unzip -p proyecto.zip capacitor.config.json
unzip -p proyecto.zip main-manifest.xml | grep -E "screenOrientation|keepScreenOn|cleartext"
unzip -p proyecto.zip www/index.html | tail -5
```

La última línea muestra el script del catálogo pegado al final de tu HTML. Si `entryAnimation` no aparece en ningún sitio, es porque no se aplica, y ahí lo tienes confirmado.

Más sobre permisos en [permissions.md](./permissions.md), sobre lo que compila cada build en [outputs.md](./outputs.md) y sobre el analizador en [analyzer.md](./analyzer.md).
