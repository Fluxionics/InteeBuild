# InteeBuild — Web a APK/AAB nativo

Convierte cualquier web o HTML en **APK** (instalación directa) o **AAB** (Google Play) con 18 permisos, firma personalizada, icono adaptativo y ofuscación.

**v4.1.0** — Tester 92/100, preview realista, historial y estadisticas.

## 🚀 Como usar (cualquiera, en local)

```bash
git clone https://github.com/Fluxionics/InteeBuild.git
cd InteeBuild
npm install
cp .env.example .env
# edita .env con tu token
npm run dev
# abre http://localhost:8787
```

### .env necesario
```
GITHUB_TOKEN=ghp_xxx  # token con Contents + Actions en tu repo builds
INTEE_BUILDS_REPO=tu-usuario/inteebuild-builds  # repo donde compila (crealo vacio)
```

Cualquiera puede correrlo local sin Render. En Render, pon esas 2 vars en Environment y redeploya.

## 📱 Flujo
**Tu web → Análisis (92/100) → Personaliza (nombre/icono/tema) → Permisos → Preview (rotar/fullscreen/splash/live URL) → Compilar (diagnóstico 7 pasos) → APK/AAB**

- **Plantillas:** Web, PWA, Radio, Tienda, Blog, Game, Educación, Empresa, Comunidad, Streaming, Dashboard, AI, Maps, Finanzas, Eventos — auto-configura permisos.
- **Analizador:** `GET /api/analyze?url=https://...` chequea HTTPS, viewport, manifest, favicon, theme-color, serviceWorker, recursos `http://`, errores HTML, PWA score y sugiere plugins.
- **Preview:** teléfono con status bar (hora real), notch, navigation bar, rotación, fullscreen, splash, dark/light y **Live URL** (iframe real de tu web).

## 🔐 Permisos (18)
Notificaciones, Foreground (ahora con `FOREGROUND_SERVICE_MEDIA_PLAYBACK` para **audio en segundo plano** — activa también `WAKE_LOCK`), Cámara/mic, Almacenamiento, GPS, Bluetooth, Teléfono, SMS, Calendario, Contactos, Sensores, NFC, System Alert, Instalar paquetes, Alarmas, Nearby WiFi, Vibration, Wake Lock, Biometría.

> **Audio en segundo plano:** activa **Foreground Service + Wake Lock**. El manifest declara `<service android:foregroundServiceType="dataSync|mediaPlayback">`. Tu web debe usar `<audio>` con `autoplay` y el sistema mantendrá el audio. Si falla, revisa que tu HTML no pause el audio en `visibilitychange`.

## 🎨 Personalización
Icono PNG/JPG/WebP, **icono adaptativo** (foreground + background color → `mipmap-anydpi-v26`), colores `accent/statusBar/navigationBar`, tema claro/oscuro/sistema, edge-to-edge, splash (color/duración), orientación, pantalla completa, deep links (`https://tu-dominio/*`), notificaciones (canal/importancia), firma `.jks` por usuario (temporal, 60 min), JS/CSS injection, User-Agent, cache, back button.

## 🔑 Firma por usuario
En **Config → Firma**, sube tu `.jks` + password + alias. Solo vive en ese build (rama `build-xxxx` + `signing.properties`), se auto-borra a los 60 min. Si no subes, firma `debug`.

## 📦 Salida
Elige **APK**, **AAB** o **APK+AAB**. La descarga es directa (`/api/download/:id` extrae `.apk` del ZIP de GitHub, no `.zip` dentro de `.zip`). También puedes descargar **Proyecto .zip** (Capacitor + Android).

## 📊 Historial y Estadísticas
Paso **Historial** muestra últimos 30 builds (nombre, estado, hace X tiempo, APK/Logs). Si no ves historial, es porque `data/builds.json` es efímero en Render free — en local sí persiste. Estadísticas arriba: total, exitosos, fallidos, APK/AAB/ambos, tiempo promedio.

## 🛡️ Seguridad
Bloquea `localhost`, `127.`, `10.`, `192.168.`, `172.16-31.`, `169.254.`, metadata endpoints, redirects a IPs privadas, HTML >500KB, icono >5MB, rate limit 10/h por IP, CORS via `CORS_ORIGIN`.

## 💰 Ads
Solo 2 banners: 300×250 arriba y 320×50 abajo (`highrevenueformat.com`). Son iframes externos, no tocan tu token ni keys. Para uso local sin ads, pon `ADS_ENABLED=false` o comenta los `<script>` en `index.html`.

## 🧭 InteeBridge
Si activas **InteeBridge**, tu web puede llamar `Intee.location()`, `Intee.camera()`, `Intee.share()`, etc. El archivo `js/inteebridge.js` se inyecta en `android/app/src/main/assets/public`.

## 📄 Licencia
MIT — úsalo local o despliega donde quieras.
