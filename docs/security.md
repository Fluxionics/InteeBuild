# Seguridad

InteeBuild trabaja en dos frentes: lo que hace el servidor para no ser un vector de ataque, y lo que genera en el APK para que la app no filtre nada. Esta página describe lo que está implementado hoy, con sus límites.

## En el servidor

### URLs salientes

`isBlockedUrl` se aplica en `/api/build`, `/api/project`, `/api/analyze`, en las redirecciones que devuelve el analizador y en la descarga del manifest de PWA. Bloquea:

- Cualquier protocolo que no sea `http` o `https`, y las URLs que no se puedan parsear.
- Hosts privados o locales: `localhost`, `127.*`, `10.*`, `192.168.*`, `172.16-31.*`, `0.0.0.0`, `::1`, `fc00:*`, `fe80:*` y `169.254.*`.
- Endpoints de metadatos de cloud: `169.254.169.254`, `metadata.google.internal` y `100.100.100.200`.

Eso evita que un atacante convierta el analizador o el build en un proxy hacia la red interna del propio servidor. No protege contra destinos públicos: cualquier URL pública sigue siendo válida, porque para eso está el producto.

### Tamaños y rate limit

- HTML: 500.000 caracteres en `/api/analyze`, `/api/build` y `/api/project`; 600.000 en `/api/analyze/html`.
- Icono: 7 MB de base64 en `/api/build`.
- Cuerpos: `express.json` con 110 MB y `express.raw` con 100 MB.
- APK: 100 MB en el descompilador local, 60 MB en la nube, 30 MB en `/api/inspect`.
- Rate limit: 10 operaciones por hora por IP en `POST /api/build`, `POST /api/v1/build` y `POST /api/decompile/cloud`. El contador es único para los tres, así que usar uno consume el cupo de los otros.

El límite vive en memoria, por lo que se pierde al reiniciar el proceso.

### API keys

Se guardan sólo como hash sha256 (`keyHash`) y el prefijo de diez caracteres; el secreto no persiste. `GET /api/keys` devuelve el hash enmascarado, y `DELETE /api/keys/:id` hace borrado lógico con `revokedAt`, tras lo cual la key deja de autenticar. Se admiten `X-API-Key` y `Authorization: Bearer`.

Dos límites que conviene conocer: los `scopes` se guardan pero no se comprueban en ninguna ruta, y mientras no exista ninguna key la API entera está abierta. Crea la primera key antes de exponer el servidor.

### CORS y cabeceras

`CORS_ORIGIN` en el `.env` fija el origen permitido. Si está vacío se refleja cualquier origen, que es el modo desarrollo; en producción pon tu dominio.

Toda respuesta lleva `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

### Secretos en respuestas

`/api/health` sólo dice si GitHub está configurado. `/api/diag` comprueba token, repo, rama y workflow y devuelve indicaciones de texto, nunca el valor del token. El historial guarda la config de cada build, pero sin contraseñas: `iconBase64`, keystore e iOS se apartan antes de escribir la entrada.

### Webhooks

`webhookUrl` recibe un POST con JSON plano (`build.completed`, `build.failed`, `build.error`) y timeout de 8 segundos. No lleva firma HMAC: si tu receptor es sensible, exige un token propio en la URL o valida el origen.

## En la app generada

### FLAG_SECURE

La opción `flagSecure` añade la bandera `FLAG_SECURE` a la ventana de `MainActivity`, lo que impide capturas de pantalla y grabación de pantalla de esa actividad. Viene activada en las plantillas `empresa`, `dashboard`, `finanzas` y `banking`.

### Bloqueo de selección

`blockSelection` inyecta CSS en tu HTML (`user-select: none` sobre todo, salvo campos de texto) y también pasa por el script del catálogo. Está en `finanzas` y `banking`. Sirve para evitar copiar datos con un toque largo; no es criografía ni cifrado.

### Lo que no hace nada hoy

La plantilla `banking` trae `screenCaptureSecurity: true` y `emergency` trae `highPriority: true`, pero ninguno de los dos campos está en `normalizeConfig`, así que no llegan al manifiesto ni al código. El bloque de canales de notificación (`notifChannel`, `notifImportance`, `notifSound`, `notifVibration`) sí se normaliza, pero tampoco lo lee ningún generador hoy: no cambia la prioridad de nada.

### Permisos

El Permission Engine tiene 86 entradas y 52 de ellas son de ejecución en tiempo real. La idea es mínimo privilegio: `gps` y `gpsBackground` son permisos distintos con justificaciones distintas en Play Store, `bluetoothScan`, `bluetoothConnect` y `bluetoothAdvertise` se pueden pedir por separado, e `useExactAlarm` y `scheduleExactAlarm` también. El Audit revisa manifiesto, permisos en tiempo real, implementación nativa, puente JavaScript y compatibilidad con el provider, y devuelve `canBuild` sólo si todo encaja.

Un caso que bloquea a propósito: `ads` devuelve `NO GENERADO` porque el generador no escribe la inicialización de AdMob ni las vistas de anuncio, y el Audit lo trata como fallo.

### Firma

La firma propia es opcional y se configura con tu keystore (`useCustomSigning` sólo se activa si hay contraseña y alias). Los keystores no se comparten entre builds, la config de firma se aparta del historial, y la descarga del APK siempre va por tu servidor. Los builds de iOS sólo firman si mandas `.p12`, `.mobileprovision` y contraseña.

### Foreground service

El servicio de audio se declara con `android:exported="false"` y `foregroundServiceType="dataSync|mediaPlayback"` (más `location` si además hay `advGeo`), con los permisos `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC` y `FOREGROUND_SERVICE_MEDIA_PLAYBACK`. La notificación es permanente para que el sistema no mate el servicio. El detalle está en [foreground.md](./foreground.md).

## En GitHub Actions

Cada build sube a una rama `build-<id>` y corre en un runner efímero. La rama se borra alrededor de un minuto después de terminar, y el barrido automático de los 30 minutos se lleva ramas de más de 5 minutos y runs y artefactos de más de 30 minutos. Eso limita cuánto tiempo queda tu HTML y tu APK en el repo de builds.

El token que usa el servidor debe ser fine-grained, con `Contents: Read/write` y `Actions: Read/write` sólo sobre el repo de builds. El workflow en sí no usa secretos de GitHub: todo lo que necesita viaja en la rama de build. Si mandas un keystore propio, ese ZIP temporal incluye `user-keystore.jks` y `signing.properties` con las contraseñas en claro, y la rama se borra a los 60 segundos de terminar el run; el barrido de los 30 minutos limpia cualquier resto. Usa un keystore de release que puedas permitirte rotar si te preocupa ese hueco, y un repo de builds privado.

## Datos y privacidad

No hay base de datos: `data/builds.json`, `data/apikeys.json`, `data/git-integrations.json` y `data/versions.json` son ficheros locales. El código HTML que mandas se sube al repo de builds durante el build y se va con la rama. La política genérica que puedes enlazar en Play sale de `GET /api/privacy-policy` y está pensada para que la adaptes, no para que la publiques tal cual.

Para el usuario final, lo práctico es: concede sólo los permisos que la app pide, comprueba de dónde salió el APK y mantén actualizada la app. El detalle de qué permiso hace qué está en [permissions.md](./permissions.md).

## Cumplimiento con Play Store

Los permisos sensibles (`phone`, `sms`, `systemAlert`, `installPackages`, `gpsBackground`) requieren justificación en la ficha de Play. `ACCESS_BACKGROUND_LOCATION` tiene su propio formulario y aprobación. `USE_EXACT_ALARM` sólo se acepta para apps de reloj, calendario o alarma. `POST /api/security-audit` marca esos permisos y te devuelve los tres puntos de la lista de GDPR que dependen de ti: política enlazada, permisos innecesarios y keystore propio.

## Verificación manual

Después de un build, comprueba el ZIP en tu terminal:

```bash
unzip -p proyecto.zip main-manifest.xml | grep "uses-permission"
unzip -p proyecto.zip MainActivity.java | grep "NativePermissions"
unzip -p proyecto.zip main-manifest.xml | grep "RadioService"
```

Y con la API:

```bash
curl -X POST /api/manifest-diff -H "Content-Type: application/json" -d '{"url":"https://mi-web.com","permissions":{"gps":true}}'
curl -X POST /api/security-audit -H "Content-Type: application/json" -d '{"url":"https://mi-web.com","permissions":{"gps":true}}'
```

`manifest-diff` te dice qué pediste y qué apareció, con `missing` y `unexpected`. `security-audit` devuelve puntuación, incidencias y la lista GDPR.

## Responsabilidades

Del lado del desarrollador de la app: no meter secretos en el HTML, usar HTTPS, validar en el backend lo que tu web valide, y revisar el Audit antes de compilar cada vez que cambies permisos. Del lado de InteeBuild: generar el manifiesto y los handlers que pediste, validar entradas en el servidor y mantener los límites activos. Ninguno de los dos sustituye al otro.

Más en [permissions.md](./permissions.md), [foreground.md](./foreground.md) y [production.md](./production.md).
