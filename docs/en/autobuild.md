# Auto-Build on Push

InteeBuild can automatically build your app every time you `push` to a configured branch in your GitHub repository.

---

## 1. Prerequisites

- A GitHub repository (public or private).
- A GitHub **Personal Access Token (PAT)** with `repo`, `workflow`, `admin:repo_hook` scopes.
- InteeBuild server configured with `GITHUB_TOKEN` and `INTEE_BUILDS_REPO` in `.env`.

---

## 2. Repository Configuration (`.inteebuild/config.json`)

Create a `.inteebuild/config.json` file at your repository root. This file defines how your app is built.

```json
{
  "url": "https://yoursite.com",
  "appName": "MyApp",
  "packageName": "com.mycompany.myapp",
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

> **Note**: All fields are optional except `url` and `appName`. If `packageName` is omitted, one is generated automatically. Permissions map to InteeBuild's granular permissions.

---

## 3. Connect Repository in InteeBuild

### Option A: From the UI (Studio)

1. Open InteeBuild Studio (`index.html`).
2. Go to **Account → Git Integrations**.
3. Click **Connect Repository**.
4. Fill in:
   - **Repo**: `user/repo` (e.g. `myuser/myapp`).
   - **Branch**: `main` (or your production branch).
   - **Token**: Your GitHub PAT.
   - **Webhook URL**: Auto-fills with your InteeBuild instance URL + `/api/git/webhook`.
5. Click **Save**.

### Option B: Via API

```bash
curl -X POST https://your-inteebuild.com/api/git/connect \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "user/repo",
    "branch": "main",
    "token": "ghp_xxxxxxxxxxxx",
    "webhookUrl": "https://your-inteebuild.com/api/git/webhook"
  }'
```

---

## 4. How the Webhook Works

When saving the integration, InteeBuild stores the config. **It does NOT create the GitHub webhook automatically** (due to PAT permission limits). You must create the webhook manually in GitHub:

1. In your GitHub repo → **Settings → Webhooks → Add webhook**.
2. **Payload URL**: `https://your-inteebuild.com/api/git/webhook`
3. **Content type**: `application/json`
4. **Events**: Select **Just the push event**.
5. **Active**: ✓

On push to the configured branch:
1. GitHub sends payload to `/api/git/webhook`.
2. InteeBuild verifies integration exists for that `repo#branch`.
3. Reads `.inteebuild/config.json` from the commit (if present) or uses defaults.
4. Triggers a build via `startBuild()` (local queue → GitHub Actions).
5. Responds with `{ "ok": true, "buildId": "abcd", "branch": "main" }`.

---

## 5. Full Flow

```
push to main
    │
    ▼
GitHub Webhook → /api/git/webhook
    │
    ▼
InteeBuild finds integration (repo + branch)
    │
    ▼
Reads .inteebuild/config.json from commit (optional)
    │
    ▼
Queues build locally (max 3 concurrent)
    │
    ▼
Syncs workflow (.github/workflows/build-app.yml)
    │
    ▼
Pushes project to temp branch (build-xxxx)
    │
    ▼
Dispatches workflow_dispatch on GitHub Actions
    │
    ▼
GitHub Actions builds (Gradle / Flutter / Tauri / etc.)
    │
    ▼
Uploads artifacts (APK, AAB, IPA, EXE, DMG…)
    │
    ▼
InteeBuild detects completion (poll every 6s)
    │
    ▼
Saves to history + notifies configured webhook (optional)
```

---

## 6. View Automated Builds

- In Studio: **History** → filter by status.
- Via API: `GET /api/build/:id` or `GET /api/v1/build/:id`.
- Notification webhook: Configure `webhookUrl` in integration or config to receive `build.completed` / `build.failed`.

---

## 7. Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Webhook 404 | Integration not found | Verify exact `repo` and `branch` in InteeBuild |
| Build fails "config not found" | No `.inteebuild/config.json` | Add file or set defaults in integration |
| Rate limit 429 | >10 builds/hour/IP | Wait or use different IP |
| Workflow missing | First build in new repo | First push creates workflow automatically |

---

## 8. API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/git/integrations` | GET | List integrations |
| `/api/git/connect` | POST | Create integration |
| `/api/git/:id` | DELETE | Delete integration |
| `/api/git/webhook` | POST | Receive GitHub webhook (internal) |
| `/api/build/:id` | GET | Build status (with `phase`, `percent`, `queuePos`, `actionsSteps`) |
| `/api/v1/build/:id` | GET | v1 status (same + `buildId`, `apkUrl`, `aabUrl`…) |

---

## 9. Security

- GitHub token stored **hashed (truncated SHA-256)** in `data/git-integrations.json`. Plain token **only used when creating integration** and optionally kept in `rawToken` if needed for webhook deletion.
- Build branches (`build-*`, `decompile-*`) auto-deleted 60s after completion.
- Actions artifacts and runs cleaned up after 30 min.