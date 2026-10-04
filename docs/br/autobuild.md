# Auto-Build no Push

O InteeBuild pode compilar seu app automaticamente a cada `push` para uma branch configurada no seu repositório GitHub.

---

## 1. Pré-requisitos

- Um repositório no GitHub (público ou privado).
- Um **Personal Access Token (PAT)** do GitHub com escopos `repo`, `workflow`, `admin:repo_hook`.
- Servidor InteeBuild configurado com `GITHUB_TOKEN` e `INTEE_BUILDS_REPO` no `.env`.

---

## 2. Configuração no Repositório (`.inteebuild/config.json`)

Crie um arquivo `.inteebuild/config.json` na raiz do seu repositório. Este arquivo define como seu app será compilado.

```json
{
  "url": "https://seusite.com",
  "appName": "MeuApp",
  "packageName": "com.minhaempresa.meuapp",
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

> **Nota**: Todos os campos são opcionais, exceto `url` e `appName`. Se `packageName` for omitido, será gerado automaticamente. As permissões mapeiam para as permissões granulares do InteeBuild.

---

## 3. Conectar o Repositório no InteeBuild

### Opção A: Pela UI (Studio)

1. Abra o InteeBuild Studio (`index.html`).
2. Vá em **Conta → Integrações Git**.
3. Clique em **Conectar Repositório**.
4. Preencha:
   - **Repo**: `usuario/repo` (ex: `meuusuario/meuapp`).
   - **Branch**: `main` (ou a branch de produção).
   - **Token**: Seu PAT do GitHub.
   - **Webhook URL**: Preenche automaticamente com a URL da sua instância InteeBuild + `/api/git/webhook`.
5. Clique em **Salvar**.

### Opção B: Via API

```bash
curl -X POST https://seu-inteebuild.com/api/git/connect \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "usuario/repo",
    "branch": "main",
    "token": "ghp_xxxxxxxxxxxx",
    "webhookUrl": "https://seu-inteebuild.com/api/git/webhook"
  }'
```

---

## 4. Como Funciona o Webhook

Ao salvar a integração, o InteeBuild armazena a configuração. **Não cria o webhook no GitHub automaticamente** (limitação de permissões do PAT). Você deve criar o webhook manualmente no GitHub:

1. No seu repo GitHub → **Settings → Webhooks → Add webhook**.
2. **Payload URL**: `https://seu-inteebuild.com/api/git/webhook`
3. **Content type**: `application/json`
4. **Events**: Selecione **Just the push event**.
5. **Active**: ✓

Ao fazer `push` para a branch configurada:
1. GitHub envia o payload para `/api/git/webhook`.
2. InteeBuild verifica se existe integração para esse `repo#branch`.
3. Lê `.inteebuild/config.json` do commit (se houver) ou usa valores padrão.
4. Dispara uma compilação via `startBuild()` (fila local → GitHub Actions).
5. Responde com `{ "ok": true, "buildId": "abcd", "branch": "main" }`.

---

## 5. Fluxo Completo

```
push para main
    │
    ▼
GitHub Webhook → /api/git/webhook
    │
    ▼
InteeBuild busca integração (repo + branch)
    │
    ▼
Lê .inteebuild/config.json do commit (opcional)
    │
    ▼
Enfileira build local (máx. 3 simultâneos)
    │
    ▼
Sincroniza workflow (.github/workflows/build-app.yml)
    │
    ▼
Envia projeto para branch temporária (build-xxxx)
    │
    ▼
Dispara workflow_dispatch no GitHub Actions
    │
    ▼
GitHub Actions compila (Gradle / Flutter / Tauri / etc.)
    │
    ▼
Envia artefatos (APK, AAB, IPA, EXE, DMG…)
    │
    ▼
InteeBuild detecta conclusão (poll a cada 6s)
    │
    ▼
Salva no histórico + notifica webhook configurado (opcional)
```

---

## 6. Ver Builds Automáticos

- No Studio: **Histórico** → filtre por status.
- Via API: `GET /api/build/:id` ou `GET /api/v1/build/:id`.
- Webhook de notificação: Configure `webhookUrl` na integração ou no config para receber `build.completed` / `build.failed`.

---

## 7. Solução de Problemas

| Problema | Causa | Solução |
|----------|-------|---------|
| Webhook 404 | Integração não existe | Verifique `repo` e `branch` exatos no InteeBuild |
| Build falha "config not found" | Não há `.inteebuild/config.json` | Adicione o arquivo ou configure defaults na integração |
| Rate limit 429 | >10 builds/hora/IP | Aguarde ou use IP diferente |
| Workflow não existe | Primeiro build em repo novo | O primeiro push cria o workflow automaticamente |

---

## 8. Referência da API

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/git/integrations` | GET | Listar integrações |
| `/api/git/connect` | POST | Criar integração |
| `/api/git/:id` | DELETE | Remover integração |
| `/api/git/webhook` | POST | Receber webhook GitHub (interno) |
| `/api/build/:id` | GET | Status do build (com `phase`, `percent`, `queuePos`, `actionsSteps`) |
| `/api/v1/build/:id` | GET | Status v1 (igual + `buildId`, `apkUrl`, `aabUrl`…) |

---

## 9. Segurança

- O token do GitHub fica **hasheado (SHA-256 truncado)** em `data/git-integrations.json`. O token em claro **só é usado ao criar a integração** e opcionalmente guardado em `rawToken` se precisar apagar o webhook depois.
- Branches de build (`build-*`, `decompile-*`) são apagadas automaticamente 60s após terminar.
- Artefatos e runs do Actions são limpos após 30 min.