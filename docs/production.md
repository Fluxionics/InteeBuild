# Producción gratuita y segura

Todo InteeBuild funciona con servicios gratuitos. Esta guía explica cómo desplegarlo sin pagar y sin exponerte a hackeos.

## Despliegue 100% gratis

| Pieza | Servicio gratis | Límites a cuidar |
|---|---|---|
| Servidor | Render (plan free) | Se duerme sin tráfico; al despertar tarda ~1 min. El disco se borra al reiniciar (el historial local se vacía, es normal). |
| Compilación | GitHub Actions (cuenta free) | ~2000 min/mes. Cada APK consume ~3-6 min. Con uso normal sobra. |
| Repo de builds | GitHub (repo público o privado) | Sin costo. Se auto-limpia cada 30 min. |

## Checklist de seguridad antes de publicar

1. **Token con permisos mínimos.** Usa un fine-grained token SOLO sobre el repo de builds, con `Contents: Read/write` y `Actions: Read/write`. Nada más. Si se filtra, el daño queda contenido a ese repo.
2. **Nunca subas `.env` al repo.** Ya está en `.gitignore`. Las variables van en Render > Environment.
3. **`CORS_ORIGIN` configurado.** En `.env.example` está vacío (modo desarrollo). En producción pon tu dominio: `CORS_ORIGIN=https://tu-dominio.com`.
4. **Limpieza manual desactivada por defecto.** `/api/cleanup` responde 403 salvo que configures `CLEANUP_SECRET`. La limpieza automática interna sigue funcionando.
5. **Rate limit activo.** 10 builds/hora por IP. En Render free se reinicia con cada despertar; es aceptable para un servicio gratuito.
6. **Protección SSRF activa.** URLs a localhost, redes privadas y endpoints de metadatos cloud están bloqueadas en `/api/build`, `/api/project` y `/api/analyze`.
7. **Sin secretos en respuestas.** `/api/health` y `/api/diag` nunca devuelven el token.

## Si no compila: usa el diagnóstico

Abre `https://tu-dominio.com/api/diag` (también hay link "Diagnóstico" en el footer). Revisa en orden:

| Campo | Qué significa |
|---|---|
| `env.hasToken / hasRepo` en `false` | Faltan variables en Render > Environment. Haz redeploy después de agregarlas. |
| `token.hint: inválido` | El token expiró o se revocó. Genera uno nuevo. |
| `repo.hint: no existe o sin acceso` | Mal escrito `INTEE_BUILDS_REPO` (formato `usuario/repo`) o el token no tiene acceso a ese repo. |
| `branch.hint` | La rama base no coincide. Ajusta `INTEE_DEFAULT_BRANCH` al valor que indica el mensaje. |
| `workflow.hint: aún no hay` | Normal en instalación fresca: se crea solo con el primer build. |
| `ok: true` | Todo listo. Si el build falla después, abre los Logs del build (botón en el resultado). |

## Errores comunes al compilar

- **503 "GitHub no configurado"** → faltan variables de entorno.
- **429 "Límite alcanzado"** → espera a que pase la hora o compila menos seguido.
- **400 de validación** → el mensaje dice exactamente qué corregir (nombre, URL, package, versión, tamaños).
- **El build queda en "error" con mensaje de GitHub** → abre `/api/diag` primero; si sale `ok: true`, revisa los logs del run en GitHub Actions.

## Costo real: $0

No hay nada de pago en este proyecto: ni builds, ni firma debug, ni descargas, ni API. Si algún día agregas planes premium, hazlo en un fork separado para no complicar la versión gratuita.
