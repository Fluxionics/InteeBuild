# 推送时自动构建

InteeBuild 可以在每次向 GitHub 仓库的配置分支执行 `push` 时自动构建您的应用。

---

## 1. 前置条件

- 一个 GitHub 仓库（公开或私有）。
- 具有 `repo`、`workflow`、`admin:repo_hook` 权限的 GitHub **Personal Access Token (PAT)**。
- InteeBuild 服务器在 `.env` 中配置了 `GITHUB_TOKEN` 和 `INTEE_BUILDS_REPO`。

---

## 2. 仓库配置 (`.inteebuild/config.json`)

在仓库根目录创建 `.inteebuild/config.json` 文件。该文件定义应用的构建方式。

```json
{
  "url": "https://您的网站.com",
  "appName": "我的应用",
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

> **注意**：除 `url` 和 `appName` 外所有字段均为可选。若省略 `packageName` 将自动生成。权限映射到 InteeBuild 的细粒度权限。

---

## 3. 在 InteeBuild 中连接仓库

### 选项 A：从 UI (Studio)

1. 打开 InteeBuild Studio (`index.html`)。
2. 进入 **账户 → Git 集成**。
3. 点击 **连接仓库**。
4. 填写：
   - **Repo**: `user/repo`（如 `myuser/myapp`）。
   - **分支**: `main`（或您的生产分支）。
   - **Token**: 您的 GitHub PAT。
   - **Webhook URL**: 自动填充为您的 InteeBuild 实例 URL + `/api/git/webhook`。
5. 点击 **保存**。

### 选项 B：通过 API

```bash
curl -X POST https://您的-inteebuild.com/api/git/connect \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "user/repo",
    "branch": "main",
    "token": "ghp_xxxxxxxxxxxx",
    "webhookUrl": "https://您的-inteebuild.com/api/git/webhook"
  }'
```

---

## 4. Webhook 工作原理

保存集成时，InteeBuild 存储配置。**不会自动在 GitHub 创建 webhook**（受 PAT 权限限制）。需在 GitHub 手动创建：

1. 在您的 GitHub 仓库 → **Settings → Webhooks → Add webhook**。
2. **Payload URL**: `https://您的-inteebuild.com/api/git/webhook`
3. **Content type**: `application/json`
4. **Events**: 选择 **Just the push event**。
5. **Active**: ✓

向配置分支 `push` 时：
1. GitHub 向 `/api/git/webhook` 发送 payload。
2. InteeBuild 验证该 `repo#branch` 存在集成。
3. 从提交读取 `.inteebuild/config.json`（若存在）或使用默认值。
4. 通过 `startBuild()` 触发构建（本地队列 → GitHub Actions）。
5. 返回 `{ "ok": true, "buildId": "abcd", "branch": "main" }`。

---

## 5. 完整流程

```
推送到 main
    │
    ▼
GitHub Webhook → /api/git/webhook
    │
    ▼
InteeBuild 查找集成 (repo + branch)
    │
    ▼
从提交读取 .inteebuild/config.json (可选)
    │
    ▼
加入本地队列 (最多 3 并发)
    │
    ▼
同步 workflow (.github/workflows/build-app.yml)
    │
    ▼
推送项目到临时分支 (build-xxxx)
    │
    ▼
在 GitHub Actions 触发 workflow_dispatch
    │
    ▼
GitHub Actions 构建 (Gradle / Flutter / Tauri / 等)
    │
    ▼
上传制品 (APK, AAB, IPA, EXE, DMG…)
    │
    ▼
InteeBuild 检测完成 (每 6 秒轮询)
    │
    ▼
保存到历史 + 通知配置的 webhook (可选)
```

---

## 6. 查看自动构建

- 在 Studio：**历史** → 按状态筛选。
- 通过 API：`GET /api/build/:id` 或 `GET /api/v1/build/:id`。
- 通知 webhook：在集成或配置中设置 `webhookUrl` 接收 `build.completed` / `build.failed`。

---

## 7. 故障排除

| 问题 | 原因 | 解决 |
|------|------|------|
| Webhook 404 | 未找到集成 | 在 InteeBuild 中核对准确的 `repo` 和 `branch` |
| 构建失败 "config not found" | 无 `.inteebuild/config.json` | 添加文件或在集成中设置默认值 |
| Rate limit 429 | >10 次构建/小时/IP | 等待或使用不同 IP |
| Workflow 缺失 | 新仓库首次构建 | 首次 push 自动创建 workflow |

---

## 8. API 参考

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/git/integrations` | GET | 列出集成 |
| `/api/git/connect` | POST | 创建集成 |
| `/api/git/:id` | DELETE | 删除集成 |
| `/api/git/webhook` | POST | 接收 GitHub webhook (内部) |
| `/api/build/:id` | GET | 构建状态 (含 `phase`, `percent`, `queuePos`, `actionsSteps`) |
| `/api/v1/build/:id` | GET | v1 状态 (同上 + `buildId`, `apkUrl`, `aabUrl`…) |

---

## 9. 安全性

- GitHub 令牌以 **哈希形式 (截断 SHA-256)** 存储在 `data/git-integrations.json` 中。明文令牌**仅在创建集成时使用**，可选保存在 `rawToken` 供后续删除 webhook。
- 构建分支 (`build-*`, `decompile-*`) 构建完成 60 秒后自动删除。
- Actions 制品和 runs 30 分钟后清理。