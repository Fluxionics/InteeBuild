# Guía de Seguridad

InteeBuild incluye múltiples capas de seguridad para proteger tu aplicación y los datos de tus usuarios.

## Seguridad en el Servidor

### Validación de Entrada
- Bloqueo de `localhost` y redes privadas (`127.`, `10.`, `192.168.`, `172.16-31.`, `169.254.`)
- Validación de redirecciones HTTP
- Límite de tamaño de HTML (1MB) e iconos (5MB)
- Rate limiting: 10 builds por hora por IP

### Gestión de API Keys
- Hash SHA256 de keys (nunca se almacenan en texto plano)
- Scopes configurables por key
- Revocación instantánea de keys
- Validación de `X-API-Key` y `Authorization: Bearer`

### CORS Configurable
- `CORS_ORIGIN` en `.env` para controlar orígenes permitidos
- Validación de origin en todas las solicitudes

## Seguridad en la Aplicación Generada

### FLAG_SECURE
Disponible en plantillas **Empresa**, **Dashboard**, **Finanzas**, **Banking**:
- Bloquea capturas de pantalla
- Bloquea grabación de pantalla
- Evita filtración de datos sensibles

### Bloqueo de Selección
Disponible en plantillas **Finanzas**, **Banking**:
- Evita copiado de texto sensible
- Protege datos financieros

### Protección de Captura de Pantalla
Disponible en plantillas **Banking**:
- Detección de intentos de captura
- Bloqueo automático de contenido sensible

## Permisos Granulares

### Principio de Mínimo Privilegio
InteeBuild usa 27 permisos granulares en lugar de permisos generales:
- `GPS preciso` vs `GPS en segundo plano` (separados)
- `Bluetooth Scan` vs `Bluetooth Connect` vs `Bluetooth Advertise` (separados)
- `Alarmas Schedule` vs `Alarmas Use` (separados)

### Audit de Permisos
El Permission Engine audita:
- Manifest XML generado
- Runtime permissions (NativePermissions.java)
- Native implementations
- Bridge implementations
- Provider compatibility

### Build Readiness
El sistema bloquea builds cuando:
- Falta `streamUrl` con `nativeAudio: true`
- `gpsBackground` sin `gps` habilitado
- Permisos incompatibles con el provider seleccionado
- Configuración inválida de SDK

## Seguridad en Foreground Service

### Tipo de Servicio Correcto
Para audio en segundo plano, InteeBuild genera:
```xml
<service android:name=".RadioService" 
         android:exported="false" 
         android:foregroundServiceType="dataSync|mediaPlayback" />
```

### Permisos Específicos
```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
```

### Notificación Ongoing
La notificación no se puede descartar (`setOngoing(true)`) para asegurar que el servicio no sea eliminado por el usuario.

## Datos y Privacidad

### Limpieza Automática
- Ramas de GitHub se borran después del build
- Artefactos de GitHub Actions se auto-limpian
- Runs de workflow se eliminan después de 90 días

### Sin Almacenamiento de Código
Tu código HTML no queda en el repositorio después del build. Solo la configuración temporal.

### Política de Privacidad
Ver [privacy.html](../privacy.html) para detalles completos sobre manejo de datos.

## Seguridad en GitHub Actions

### Secrets del Workflow
- `GITHUB_TOKEN` se usa para interactuar con la API
- Tokens tienen permisos mínimos necesarios (`repo`, `workflow`)
- Los secrets no se exponen en los logs

### Aislamiento de Builds
- Cada build usa una rama temporal
- No hay interferencia entre builds concurrentes
- El workflow se ejecuta en runners aislados

## Recomendaciones para Usuarios

### Para Desarrolladores
1. **Nunca commits con secrets:** Usa variables de entorno en `.env`
2. **Revisa el audit:** Verifica que todos los permisos sean necesarios
3. **Usa FLAG_SECURE:** Para apps con datos sensibles
4. **Firma con keystore propio:** No uses keystores compartidos

### Para Usuarios Finales
1. **Revisa permisos:** Solo concede permisos que la app realmente necesita
2. **Verifica fuente:** Descarga apps solo de fuentes confiables
3. **Actualiza:** Mantén tu app actualizada con los últimos parches de seguridad
4. **Reporta:** Si encuentras una vulnerabilidad, repórtala al desarrollador

## Cumplimiento

### Google Play Store
- Permisos sensibles requieren justificación
- `ACCESS_BACKGROUND_LOCATION` necesita aprobación especial
- `USE_EXACT_ALARM` solo para reloj/calendario/alarma
- `phone`, `sms`, `installPackages` están restringidos

### GDPR y Privacidad
- Política de privacidad clara en la app
- Consentimiento explícito para permisos sensibles
- Derecho a revocar permisos
- Sin recopilación de datos no necesarios

## Auditoría y Verificación

### Verificar Manifest
Después del build, verifica en el ZIP:
```bash
unzip -p project.zip main-manifest.xml | grep -E "uses-permission|service"
```

### Verificar Permisos Runtime
```bash
unzip -p project.zip MainActivity.java | grep "NativePermissions"
```

### Verificar Foreground Service
```bash
unzip -p project.zip main-manifest.xml | grep "RadioService"
unzip -p project.zip RadioService.java | head -20
```

## Responsabilidades

### Del Desarrollador
- Implementar seguridad adecuada en el HTML/JS
- No almacenar secrets en el código
- Usar HTTPS para todas las conexiones
- Implementar validación en el backend

### De InteeBuild
- Proporcionar permisos granulares correctos
- Generar código nativo seguro
- Implementar validaciones en el servidor
- Mantener el sistema actualizado

## Recursos Adicionales

- [Guía de permisos](./permissions.md)
- [Foreground Service](./foreground.md)
- [Producción](./production.md)
- [Solución de problemas](./troubleshooting.md)