# InteeBuild

Convierte cualquier pagina web o codigo HTML en un **APK o AAB nativo de Android** con 18 permisos configurables, splash screen, historial de builds y configuracion Android completa.

- Sin registro ni cuentas.
- El APK/AAB se compila en la nube con **GitHub Actions** (gratis).
- Open source.

## Como funciona

1. El usuario configura su app en 4 pasos: URL/HTML, permisos, configuracion Android, compilar.
2. El backend genera un proyecto **Capacitor** completo.
3. El proyecto se sube a un repo de builds y se dispara GitHub Actions.
4. El usuario recibe el APK/AAB para descargar.
5. El historial de builds queda guardado para referencia.

## Caracteristicas

### Entrada flexible
- **URL**: cualquier pagina web (http/https).
- **HTML directo**: pega tu codigo HTML y genera la app sin hosting.

### 18 Permisos Android
- Notificaciones (POST_NOTIFICATIONS, VIBRATE)
- Foreground Service (FOREGROUND_SERVICE, DATA_SYNC)
- Camara y microfono (CAMERA, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS)
- Almacenamiento (READ_MEDIA_*, READ_EXTERNAL_STORAGE)
- GPS (ACCESS_FINE/COARSE/BACKGROUND_LOCATION)
- Bluetooth (BLUETOOTH, BLUETOOTH_ADMIN, CONNECT, SCAN)
- Telefono (CALL_PHONE, READ_PHONE_STATE, READ_CALL_LOG)
- SMS (SEND_SMS, READ_SMS)
- Calendario (READ_CALENDAR, WRITE_CALENDAR)
- Contactos (READ_CONTACTS, WRITE_CONTACTS)
- Sensores (BODY_SENSORS)
- NFC
- Alerta del sistema (SYSTEM_ALERT_WINDOW)
- Instalar paquetes (REQUEST_INSTALL_PACKAGES)
- Alarmas (SCHEDULE_EXACT_ALARM)
- Cercanos WiFi (NEARBY_WIFI_DEVICES)
- Bloqueo de pantalla (WAKE_LOCK)

### Salida
- **APK**: para instalar directamente.
- **AAB**: para Google Play.
- **APK + AAB**: ambos.

### Configuracion Android
- compileSdk 33-36, targetSdk 27-36, minSdk 23-29
- Orientacion: automatica, vertical, horizontal, sensor
- Pantalla completa y mantener pantalla activa
- Trafico HTTP configurable (cleartext)
- Splash screen con color y duracion
- Iconos: PNG, JPG, WebP (hasta 5MB)

### Historial
- Guarda los ultimos 30 builds.
- Muestra estado, nombre, fecha, ID.
- Links directos a APK y logs.

## Arrancar localmente

```bash
npm install
cp .env.example .env    # rellena GITHUB_TOKEN y INTEE_BUILDS_REPO
npm run dev
```

## Variables de entorno

| Variable | Descripcion |
|---|---|
| `GITHUB_TOKEN` | Token con permisos Contents y Actions |
| `INTEE_BUILDS_REPO` | Repo de builds (ej: `usuario/inteebuild-builds`) |
| `INTEE_DEFAULT_BRANCH` | Rama por defecto (default: `main`) |
| `PORT` | Puerto del servidor (default: 8787) |
| `CORS_ORIGIN` | Origen permitido para CORS (default: todos) |
| `CLEANUP_SECRET` | Secreto para proteger `/api/cleanup` |

## API

| Endpoint | Metodo | Descripcion |
|---|---|---|
| `/api/health` | GET | Estado del servidor |
| `/api/build` | POST | Iniciar un build |
| `/api/build/:id` | GET | Consultar estado |
| `/api/project` | POST | Descargar proyecto .zip |
| `/api/history` | GET | Historial de builds |
| `/api/cleanup` | GET | Limpiar ramas/artifacts (protegido) |

## Desplegar en Render

1. Crea un repo en GitHub con el codigo.
2. En Render, crea un **New Web Service** desde el repo.
3. En **Environment**, agrega `GITHUB_TOKEN` e `INTEE_BUILDS_REPO`.
4. Render usa `render.yaml` automaticamente.

## Licencia

MIT
