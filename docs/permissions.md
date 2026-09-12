# Guía de permisos

Marca solo lo que tu app usa. Google Play puede rechazar permisos sensibles sin una justificación válida.

## Siempre incluidos

- `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`: conexión. Sin estos la app no carga nada.

## Notificaciones

- `POST_NOTIFICATIONS`, `VIBRATE`: avisos al abrir/cerrar o programados.

## Segundo plano (audio)

- `FOREGROUND_SERVICE` + `WAKE_LOCK`: mantiene el audio con la pantalla apagada. Ideal para radios.

## Cámara y micrófono

- `CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`: fotos, video y audio desde la web.

## Almacenamiento y medios

- `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`: leer galería y archivos en Android 13+.
- `READ_EXTERNAL_STORAGE`: compatibilidad con versiones anteriores.

## Ubicación

- `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`: GPS en primer plano.
- `ACCESS_BACKGROUND_LOCATION`: rastreo con la app cerrada. Play exige justificación con video.

## Conectividad

- `BLUETOOTH`, `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`: dispositivos cercanos.
- `NFC`: etiquetas y pagos por proximidad.
- `NEARBY_WIFI_DEVICES`: redes WiFi cercanas.

## Sensibles (Play Store estricto)

- `CALL_PHONE`, `READ_PHONE_STATE`, `READ_CALL_LOG`: solo apps de marcador/teléfono.
- `SEND_SMS`, `READ_SMS`: solo apps de SMS por defecto.
- `SYSTEM_ALERT_WINDOW`: superposición sobre otras apps.
- `REQUEST_INSTALL_PACKAGES`: instalar otros APKs.

Si tu app no es de esas categorías, **no los marques**: el build compila igual, pero Play lo rechazará al publicar.

## Sistema

- `SCHEDULE_EXACT_ALARM`: alarmas exactas y recordatorios.
- `USE_BIOMETRIC`: huella o rostro.
- `BODY_SENSORS`: sensores corporales.
