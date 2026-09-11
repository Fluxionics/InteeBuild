# InteeBuild

Convierte cualquier sitio web o codigo HTML en una aplicacion nativa de Android (APK y AAB). Sin registro, compilacion en la nube con GitHub Actions y control total sobre permisos, firma y personalizacion.

## Caracteristicas

- **Entrada flexible:** URL publica o codigo HTML directo.
- **18 permisos Android configurables:** notificaciones, foreground service (mediaPlayback para audio en segundo plano), camara y microfono, almacenamiento, GPS, Bluetooth, telefono, SMS, calendario, contactos, sensores, NFC, system alert, instalacion de paquetes, alarmas, WiFi cercano, vibracion, wake lock y biometria.
- **Icono e icono adaptativo:** PNG, JPG y WebP, generacion de `mipmap-anydpi-v26` con fondo y foreground.
- **Apariencia:** tema claro, oscuro o sistema, color de acento, status bar y navigation bar, edge-to-edge, splash screen con color y duracion, animacion de entrada y orientacion.
- **Analizador web:** verifica HTTPS, viewport movil, manifest, favicon, theme-color, service worker, recursos inseguros, errores HTML y detecta PWA y frameworks. Puntuacion 0-100 con recomendaciones automaticas.
- **Plantillas:** Web, PWA, Radio, Tienda, Blog, Juego, Educacion, Empresa, Comunidad, Streaming, Dashboard, AI, Maps, Finanzas y Eventos.
- **Plugins nativos:** camara, geolocalizacion, compartir, archivos, haptics, clipboard, notificaciones push y locales, biometria, Bluetooth LE, NFC y puente InteeBridge para llamar APIs nativas desde la web.
- **Salida:** APK para instalacion directa, AAB para Google Play o ambos, mas proyecto ZIP completo y firma personalizada por usuario con ofuscacion ProGuard.
- **Preview realista:** marco de telefono con status bar y navigation bar, rotacion, pantalla completa, simulacion de splash y modo claro u oscuro. Vista previa en vivo con iframe de la URL real.
- **Compilacion:** diagnostico en siete pasos con barra de progreso, consola de logs en vivo y descarga directa del APK y AAB sin pasar por GitHub.
- **Historial y estadisticas:** ultimos 30 builds con estado, tiempo y enlaces, y panel con totales, exitosos, fallidos y tiempo promedio.

## Requisitos

- Node.js 18 o superior
- Cuenta de GitHub y un repositorio vacio para los builds

## Instalacion local

```bash
git clone https://github.com/Fluxionics/InteeBuild.git
cd InteeBuild
npm install
cp .env.example .env
```

Edita `.env`:

```
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
INTEE_BUILDS_REPO=tu-usuario/inteebuild-builds
```

Crea el repositorio `inteebuild-builds` vacio en GitHub y genera un token clasico con permisos `repo` y `workflow`.

Inicia el servidor:

```bash
npm run dev
```

Abre `http://localhost:8787`.

## Despliegue en Render

1. Haz fork o sube este repositorio a tu cuenta de GitHub.
2. En Render crea un nuevo Web Service conectado al repositorio.
3. Configura las variables de entorno `GITHUB_TOKEN` y `INTEE_BUILDS_REPO`.
4. Render detecta `render.yaml` y despliega automaticamente.

Cualquier usuario puede clonar el proyecto y ejecutarlo localmente sin necesidad de Render.

## Uso

1. Elige una plantilla o configura manualmente.
2. Ingresa la URL o pega tu HTML y usa Analizar para ver la puntuacion y recomendaciones. Aplica el Autopilot si lo deseas.
3. Personaliza nombre, paquete, version, icono y colores.
4. Selecciona permisos y plugins nativos.
5. Ajusta SDK, orientacion, pantalla, deep links y notificaciones. Sube tu keystore si necesitas firma release.
6. Revisa el Preview, compila y descarga el APK, AAB o ZIP. El historial queda disponible en el ultimo paso.

## Audio en segundo plano

Para que el audio continue con la pantalla apagada activa Foreground Service y Wake Lock. El AndroidManifest declara `FOREGROUND_SERVICE_MEDIA_PLAYBACK` y un servicio `dataSync|mediaPlayback`. Tu pagina debe mantener el elemento `<audio>` sin pausarlo en `visibilitychange`.

## Seguridad

- Bloqueo de `localhost` y redes privadas (`127.`, `10.`, `192.168.`, `172.16-31.`, `169.254.`, metadata endpoints).
- Validacion de redirecciones y limite de tamano de HTML e iconos.
- CORS configurable con `CORS_ORIGIN` y limite de 10 builds por hora por IP.

## API

- `GET /api/health` — estado del servidor
- `GET /api/analyze?url=` — analisis web
- `POST /api/build` — iniciar compilacion
- `GET /api/build/:id` — estado del build
- `GET /api/build/:id/logs` — logs del runner
- `GET /api/download/:id` — descarga directa del APK
- `GET /api/download/:id/aab` — descarga directa del AAB
- `POST /api/project` — descarga del proyecto ZIP
- `GET /api/history` — ultimos builds
- `GET /api/stats` — estadisticas

## Estructura

```
InteeBuild/
  index.html
  css/style.css
  js/app.js
  js/inteebridge.js
  server/
    server.js
    generator.js
    github.js
  assets/icon.svg
  render.yaml
  package.json
```

## Licencia

MIT. Consulta el archivo LICENSE o la pagina de Licencia en la web para mas detalles.

## Soporte

Abre un issue en GitHub si encuentras un problema con algun toggle, permiso o compilacion. Incluye los logs del build y la configuracion usada.
