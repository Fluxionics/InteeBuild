# Auto-Build al hacer Push

InteeBuild puede compilar tu app automáticamente cada vez que haces `push` a una rama configurada en tu repositorio GitHub.

---

## 1. Requisitos previos

- Un repositorio en GitHub (público o privado).
- Una **Personal Access Token (PAT)** de GitHub con permisos `repo`, `workflow`, `admin:repo_hook`.
- El servidor InteeBuild configurado con `GITHUB_TOKEN` e `INTEE_BUILDS_REPO` en `.env`.

---

## 2. Configuración en el repositorio (`.inteebuild/config.json`)

Crea un archivo `.inteebuild/config.json` en la raíz de tu repositorio. Este archivo define cómo se compila tu app.

```json
{
  "url": "https://tusitio.com",
  "appName": "MiApp",
  "packageName": "com.miempresa.miapp",
  "outputType": "apk",
  "platform": "android",
  "provider": "capacitor",
  "versionName": "1.0.0",
  "versionCode": 1,
  "compileSdk": 35,
  "targetSdk": 35,
  "minSdk": 23,
  "permissions": {
    "INTERNET": true,
    "CAMERA": false
  },
  "iconBase64": "",
  "keystoreBase64": "",
  "keystorePassword": "",
  "keyPassword": "",
  "outputs": ["apk"]
}
```

> **Nota**: Todos los campos son opcionales salvo `url` y `appName`. Si omites `packageName`, se genera uno automático. Los permisos se mapean a los granulares de InteeBuild.

---

## 3. Conectar el repositorio en InteeBuild

### Opción A: Desde la UI (Studio)

1. Abre InteeBuild Studio (`index.html`).
2. Ve a **Cuenta → Integraciones Git**.
3. Pulsa **Conectar repositorio**.
4. Rellena:
   - **Repo**: `usuario/repo` (ej. `miusuario/miapp`).
   - **Rama**: `main` (o la que uses para producción).
   - **Token**: Tu PAT de GitHub.
   - **Webhook URL**: Se autocompleta con la URL de tu instancia InteeBuild + `/api/git/webhook`.
5. Pulsa **Guardar**.

### Opción B: Via API

```bash
curl -X POST https://tu-inteeBuild.com/api/git/connect \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "usuario/repo",
    "branch": "main",
    "token": "ghp_xxxxxxxxxxxx",
    "webhookUrl": "https://tu-inteeBuild.com/api/git/webhook"
  }'
```

---

## 4. Cómo funciona el webhook

Al guardar la integración, InteeBuild registra la configuración. **No crea el webhook en GitHub automáticamente** (por limitaciones de permisos de la PAT). Debes crear el webhook manualmente en GitHub:

1. En tu repo GitHub → **Settings → Webhooks → Add webhook**.
2. **Payload URL**: `https://tu-inteeBuild.com/api/git/webhook`
3. **Content type**: `application/json`
4. **Events**: Selecciona **Just the push event**.
5. **Active**: ✓

Cuando haces `push` a la rama configurada:
1. GitHub envía el payload a `/api/git/webhook`.
2. InteeBuild verifica que exista integración para ese `repo#branch`.
3. Lee `.inteebuild/config.json` del commit (si existe) o usa valores por defecto.
4. Lanza una compilación vía `startBuild()` (cola local → GitHub Actions).
5. Responde con `{ "ok": true, "buildId": "abcd", "branch": "main" }`.

---

## 5. Flujo completo

```
push a main
    │
    ▼
GitHub Webhook → /api/git/webhook
    │
    ▼
InteeBuild busca integración (repo + branch)
    │
    ▼
Lee .inteebuild/config.json del commit (opcional)
    │
    ▼
Encola build local (máx 3 concurrentes)
    │
    ▼
Sincroniza workflow (.github/workflows/build-app.yml)
    │
    ▼
Sube proyecto a rama temporal (build-xxxx)
    │
    ▼
Dispara workflow_dispatch en GitHub Actions
    │
    ▼
GitHub Actions compila (Gradle / Flutter / Tauri / etc.)
    │
    ▼
Sube artefactos (APK, AAB, IPA, EXE, DMG…)
    │
    ▼
InteeBuild detecta finalización (poll cada 6s)
    │
    ▼
Guarda en historial + notifica webhook configurado (opcional)
```

---

## 6. Ver builds automáticos

- En Studio: **Historial** → filtra por estado.
- Via API: `GET /api/build/:id` o `GET /api/v1/build/:id`.
- Webhook de notificación: Configura `webhookUrl` en la integración o en el config para recibir `build.completed` / `build.failed`.

---

## 7. Solución de problemas

| Problema | Causa | Solución |
|----------|-------|----------|
| Webhook 404 | Integración no existe | Verifica `repo` y `branch` exactos en InteeBuild |
| Build falla "config not found" | No hay `.inteebuild/config.json` | Añade el archivo o configura defaults en la integración |
| Rate limit 429 | >10 builds/hora/IP | Espera o usa distinta IP |
| Workflow no existe | Primer build en repo nuevo | El primer push crea el workflow automáticamente |

---

## 8. Referencia API

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/git/integrations` | GET | Listar integraciones |
| `/api/git/connect` | POST | Crear integración |
| `/api/git/:id` | DELETE | Borrar integración |
| `/api/git/webhook` | POST | Recibir webhook GitHub (interno) |
| `/api/build/:id` | GET | Estado de build (con `phase`, `percent`, `queuePos`, `actionsSteps`) |
| `/api/v1/build/:id` | GET | Estado v1 (igual + `buildId`, `apkUrl`, `aabUrl`…) |

---

## 9. Seguridad

- El token GitHub se guarda **hasheado (SHA-256 truncado)** en `data/git-integrations.json`. El token en claro **solo se usa al crear la integración** y opcionalmente se guarda en `rawToken` si lo necesitas para borrar el webhook luego.
- Las ramas de build (`build-*`, `decompile-*`) se borran automáticamente a los 60s tras finalizar.
- Los artefactos y runs de Actions se limpian tras 30 min.