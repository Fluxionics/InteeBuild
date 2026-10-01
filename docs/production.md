# Puesta en producción

Esta guía cubre cómo desplegar InteeBuild en servicios gratuitos y qué comprobar antes de exponerlo. Todo lo que hace el proyecto funciona sin planes de pago: los builds corren en GitHub Actions, el servidor cabe en el plan gratuito de Render y no hay ni una API de pago detrás.

## Despliegue gratuito

`render.yaml` define el servicio con `plan: free`, `npm install` como build, `node server/server.js` como arranque y `/api/health` como health check. En Render > Environment van `GITHUB_TOKEN`, `INTEE_BUILDS_REPO`, `INTEE_DEFAULT_BRANCH` y, si quieres, `CORS_ORIGIN` y `CLEANUP_SECRET`.

Tres cosas que conviene tener presentes del plan gratuito:

- **El disco se borra al reiniciar.** Todo lo que el servidor escribe en `data/` (historial de builds, API keys, integraciones git y versiones) vive en el disco efímero de Render y desaparece con cada reinicio o despliegue. Es esperable: no guardes ahí nada que no puedas perder.
- **El servicio se duerme sin tráfico** y tarda alrededor de un minuto en despertar. La primera petición tras la inactividad es lenta.
- **GitHub Actions cobra minutos a los repos privados.** En la cuenta gratuita hay una asignación mensual de unos 2000 minutos en runners Linux, y cada build ocupa un runner varios minutos. Los repos públicos no consumen esa asignación. Si te quedas corto, usa un repo de builds público o revisa el panel de billing de GitHub.

El repo de builds no cuesta nada y se auto-limpia: cada 30 minutos el servidor borra ramas `build-*` y `decompile-*` con más de 5 minutos, y runs y artefactos con más de 30 minutos. Por eso los enlaces de descarga caducan pronto.

## Seguridad antes de publicar

1. **Token con permisos mínimos.** Un fine-grained token sólo sobre el repo de builds, con `Contents: Read/write` y `Actions: Read/write`. Nada más. Si se filtra, el daño queda contenido a ese repo.
2. **Nunca subas `.env` al repo.** Está en `.gitignore`. Las variables van en Render > Environment.
3. **`CORS_ORIGIN` configurado.** En `.env.example` viene vacío, que es el modo desarrollo (cualquier origen). En producción, `CORS_ORIGIN=https://tu-dominio.com`.
4. **Limpieza manual desactivada por defecto.** `/api/cleanup` devuelve `403` salvo que pongas `CLEANUP_SECRET` y pases `?secret=…`. La limpieza automática de cada 30 minutos no depende de eso.
5. **Rate limit activo.** 10 builds por hora por IP, compartidos con la descompilación en la nube. En Render el contador se pierde al reiniciar, que es un efecto lateral del disco efímero.
6. **Protección SSRF activa.** Las URLs a localhost, redes privadas y endpoints de metadatos cloud quedan bloqueadas en `/api/build`, `/api/project` y `/api/analyze`, y también en las redirecciones que devuelva el analizador.
7. **Sin secretos en las respuestas.** `/api/health` y `/api/diag` confirman que el token existe y si es válido, pero nunca lo devuelven. El listado de API keys devuelve el hash enmascarado, no la key.

## Diagnóstico

Abre `/api/diag` en tu dominio (también hay enlace "Diagnóstico" en el footer). Recorre cinco pasos y se detiene en el primero que falla:

- `env.hasToken` o `env.hasRepo` en `false`: faltan variables en Render > Environment. Añádelas y haz redeploy.
- `token.hint` con "inválido": el token expiró o fue revocado; genera uno nuevo.
- `repo.hint` con "no existe o sin acceso": `INTEE_BUILDS_REPO` está mal escrito (formato `usuario/repo`) o el token no llega a ese repo.
- `branch.hint` con la rama por defecto de GitHub distinta a la que usas: ajusta `INTEE_DEFAULT_BRANCH` al valor que indica el mensaje.
- `workflow.hint` con "aún no hay workflow": normal en instalación fresca, el archivo se crea solo en el primer build.
- `ok: true`: todo encaja. Si el build falla después, abre los logs del run desde el botón del resultado.

## Errores habituales

- `503 "GitHub no configurado"` — faltan `GITHUB_TOKEN` o `INTEE_BUILDS_REPO`.
- `429` con `Limite de builds alcanzado (10 por hora)` — 10 por hora por IP; espera a que venza la ventana.
- `400` de validación — el mensaje indica qué corregir: nombre, URL bloqueada, package, versión, HTML de más de 500.000 caracteres o icono de más de 7 MB.
- Build en `failed` con error de GitHub — abre `/api/diag` y, si da `ok: true`, revisa el log del run.
- Build en `failed` con "Tiempo de espera agotado consultando GitHub" — el servidor agotó sus 200 consultas de 6 segundos (unos 20 minutos); el runner tardó más de lo previsto o GitHub estuvo lento.

## Costo

$0 en licencias y servicios: builds, firma debug, descargas y API no cuestan nada. Lo único que puede consumir dinero es tu propia cuenta de GitHub o Render si te pasas de la asignación gratuita, y eso se ve en sus paneles de facturación. Si en algún momento añades planes de pago, hazlo en un fork separado para no complicar esta versión.

Sobre límites concretos de la API, en [api.md](./api.md). Sobre seguridad de los builds y del servidor, en [security.md](./security.md).
