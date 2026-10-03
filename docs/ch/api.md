# 开发者 API

整个 API 位于与界面同一服务器的 `/api` 下。基础 URL 是你的域名或 `http://localhost:8787`。除返回 ZIP、纯文本或 PNG 的端点外，其余都是 JSON。

如果你需要这些端点的可浏览视图，有 `developer.html`。`GET /api/docs` 返回 API 的 JSON 摘要及服务器版本。

## 身份验证

API key 不是必需的：在创建任何 key 之前，API 是开放的。一旦你创建了第一个，`POST /api/v1/build` 就会开始要求提供它。

```bash
curl -X POST /api/keys -H "Content-Type: application/json" -d '{"name":"ci"}'
# → {"id":"…","key":"ib_…","keyHash":"…","prefix":"ib_…","scopes":["build","decompile","analyze"]}
```

key 只在那次响应中返回一次。磁盘上只保留其 sha256 哈希（`keyHash`）和前缀（前十个字符），绝不会保存密钥本身。`GET /api/keys` 返回掩码后的形式（`ib_1a2b3c4…` 加上哈希的最后四位）、使用情况、最近一次调用和状态；`DELETE /api/keys/:id` 通过标记 `revokedAt` 执行逻辑删除，该 key 随即失效。上限是 10 个活跃 key。

支持两种方式：`X-API-Key: ib_…` 或 `Authorization: Bearer ib_…`。

一个值得了解的细节：`scopes` 会被保存，创建 key 时也可以对其加以限制，但在任何路由上都不会被校验。实际的权限判断是“key 存在且未被吊销”。

你也可以用 `GET /api/keys` 在自己的客户端中进行列表和吊销。

## 编译

有两个入口。工作台的入口不需要 key，响应返回 `id`；版本化的入口可能会要求 key，响应返回 `buildId`。

```bash
curl -X POST /api/build -H "Content-Type: application/json" \
  -d '{"url":"https://mi-tienda.com","appName":"Mi Tienda","packageName":"com.miempresa.miapp","permissions":{"gps":true,"cameraMic":true}}'
# → 202 {"id":"abc123","branch":"build-abc123","status":"queued"}
```

```bash
curl -X POST /api/v1/build -H "Content-Type: application/json" -H "X-API-Key: ib_…" \
  -d '{"url":"https://mi-tienda.com","name":"Mi Tienda","package":"com.miempresa.miapp","output":"apk","template":"ecommerce"}'
# → 202 {"buildId":"abc123","status":"queued","branch":"build-abc123"}
```

`POST /api/build` 接受完整配置：`url` 或 `htmlCode` 与 `inputType`、`appName`、`packageName`、`outputType`（`apk`/`aab`/`both`）、`outputs`（格式列表：`apk`、`aab`、`xapk`、`apks`、`ipa`、`exe`、`msi`、`dmg`、`appimage`）、`platform`（`android`/`ios`/`both`）、`permissions`、`plugins`、`provider`、`template`、`streamUrl`、`nativeAudio`、`nativeAutoplay`、`orientation`、`iconBase64`、keystore 与 iOS 签名、`webhookUrl`、`desktopEnabled`，以及 SDK 规范化的其余字段。

`POST /api/v1/build` 刻意收窄了范围：只识别 `url`、`name`/`appName`、`package`/`packageName`、`output`/`outputType`、`outputs`、`platform`、`inputType` + `htmlCode`、`versionName`、`versionCode`、`compileSdk`、`targetSdk`、`minSdk`、`permissions`、`plugins`、`provider`、`template`、`streamUrl`、`nativeAudio`、`nativeAutoplay` 和 `webhookUrl`。图标和 UI 标志不通过那里传递；如果需要，请使用 `/api/build`。

在启动任何事情之前你会遇到的错误：GitHub 未配置会返回 `503` 并附带 `.env` 提示；被安全策略拦截的 URL 返回 `400`；超过 500,000 字符的 HTML 返回 `400`；大于 7 MB 的图标返回 `400`；每 IP 每小时 10 次构建的限制返回 `429`。这个计数器与云端反编译共用，因此一轮反编译同样会消耗你的构建配额。

编译过程中，步骤依次为 `Enviando proyecto a GitHub`、`Sincronizando workflow`、`Subiendo proyecto`、`Lanzando compilacion en GitHub Actions`、`En cola en GitHub Actions` 和 `Compilando APK`，最终结束于 `Build completado` 或 `Build fallido`。

## 查询状态与下载

工作台每 3 秒查询一次。你可以按自己想要的频率查询。

```bash
curl /api/build/abc123
# → {"id":"abc123","status":"building","step":"Compilando APK","runUrl":"https://github.com/…","apkUrl":null,"outputType":"apk"}
```

`status` 经历 `queued` → `building` → `success` 或 `failed`。如果构建已不在内存中，端点会查询历史记录并返回带有 `fromHistory: true` 的条目；如果找不到，则返回 `404`。

`GET /api/v1/build/:id` 以另一种形式返回相同信息：相对于 API 的 `apkUrl`、`aabUrl` 和 `ipaUrl`（如果该产物未生成则为 `null`），以及 `outputs`（你请求的）和 `formats`（GitHub Actions 上产物确认存在的）。

```bash
curl /api/v1/build/abc123
# → {"buildId":"abc123","status":"success","apkUrl":"/api/download/abc123","aabUrl":null,"ipaUrl":null,"outputs":["apk"],"formats":["apk"]}
```

下载：

- `GET /api/download/:id` — APK。
- `GET /api/download/:id/aab` — AAB。
- `GET /api/download/:id/ipa` — IPA，仅在有 Apple 签名时可用。

三者的工作方式相同：查找 run 的产物，打开 GitHub Actions 上传的 ZIP，并返回带扩展名的独立二进制文件（如果找不到该二进制文件，则返回整个 ZIP）。如果构建仍在进行中，则返回 `404` 和 "Build aun en progreso"。

有一个条件需要记住：下载要求构建仍在服务器内存中。如果进程已重启，即使产物在 GitHub 上存在，端点也会返回 `404`。历史记录用于查询状态和配置，不能用于下载。

产物由 GitHub Actions 提供，30 分钟后过期。`GET /api/apk-info/:id` 仅在构建结束后返回产物信息（名称、以 MB 为单位的大小、各自的链接）。`GET /api/build/:id/logs` 返回截断到 80,000 字符的 run 日志，且仅在构建已有 `runId` 时可用。

服务器每 6 秒查询一次 GitHub，共尝试 200 次：如果次数用尽，构建会变为 `failed`，错误信息为 "Tiempo de espera agotado consultando GitHub"，分支会在 60 秒后被删除。

获取未编译的项目：

```bash
curl -X POST /api/project -H "Content-Type: application/json" -d '{"url":"https://mi-tienda.com","template":"ecommerce"}' -o proyecto.zip
```

## 模板

```bash
curl /api/templates
curl /api/templates/radio
curl /api/templates/radio/native
```

列表返回 `id`、`name`、`description`、`hasFace` 和摘要 audit（`ok`、`total`、`readiness`、`canBuild`）。详情包含 `config` 和 `faceHtml`。第三个在内存中生成清单、Java/XML 文件和 audit，无需编译。每个模板的详情见 [templates.md](./templates.md)。

## 权限与 readiness

```bash
curl /api/permissions/spec
curl -X POST /api/permissions/audit -H "Content-Type: application/json" -d '{"appName":"Mi Tienda","url":"https://mi-tienda.com","permissions":{"cameraMic":true}}'
curl -X POST /api/permissions/suggest -H "Content-Type: application/json" -d '{"url":"https://mi-tienda.com"}'
curl -X POST /api/build-readiness -H "Content-Type: application/json" -d '{"appName":"Mi Tienda","url":"https://mi-tienda.com","permissions":{"gps":true}}'
```

`spec` 返回 Permission Engine 的条目（当前版本为 86 条）。`audit` 为每个权限返回一行，包含 `status`（`ok`/`warn`/`fail`）、`minSdk`、原生实现以及 provider 是否支持它，另加 `ok`、`total`、`canBuild`、`verifiedAll` 和 `readiness`。`suggest` 接受 `{html}`、`{url}` 或 `{detectedApis}`，响应为 `{detected, suggested, count}`。

`build-readiness` 是“编译”步骤使用的接口。它返回 `readiness`（0-100）、`checks`、`audit`、`warnings` 和 `canBuild`。只有当 audit 通过、存在 URL 或 HTML、且原生音频有其 stream 时，`canBuild` 才为 `true`。一个典型警告是 "Audio nativo activo pero sin URL del stream: pon tu servidor en Audio nativo"，在你填写 `streamUrl` 之前它会阻止电台构建。

**Foreground + WifiLock**：如果 `permissions.foreground` 已启用，生成器现在会包含 `WifiLock`（`WIFI_MODE_FULL_HIGH_PERF`，带 `try/catch`），以避免屏幕因 WiFi 节能而关闭时音频中断。`WakeLock`（PARTIAL）同样保持启用。后台服务的详情参见 `foreground.md`。

配置中的 `provider` 字段现在能正确传递到 `build-config.json`（此前会因 workflow 中的转义错误而丢失），流水线会根据该值决定注入原生/gecko 的 `MainActivity` 还是 Capacitor 桥接。

`POST /api/manifest-diff` 把你请求的内容与生成的内容进行比较：返回 `requested`、`generated`、`missing`、`unexpected`，以及每个权限状态为 `MATCH` 或 `MISSING` 的 `rows`。它可用于在编译前发现被遗漏在清单之外的权限。

## 网站分析

```bash
curl "/api/analyze?url=https://mi-tienda.com"
curl -X POST /api/analyze/html -H "Content-Type: application/json" -d '{"html":"<html>…</html>"}'
curl -X POST /api/analyze/fix -H "Content-Type: application/json" -d '{"html":"<html>…</html>"}'
```

`GET /api/analyze` 以 10 秒超时下载页面，检查 HTTPS、viewport、manifest、favicon、theme-color、service worker、使用 `http://` 的资源、Open Graph 和结构化数据，并返回 0 到 100 的 `score` 及其诊断。同时还会给出 `frameworks`、`detectedApis`、`recommendations`、`security`（含问题的评分）、`errors`、`optimization`，以及包含前 8,000 个修正字符的 `autoFix.preview`。如果页面带有 manifest，会尝试下载以返回 `pwa`。拒绝超过 500,000 字符的 HTML 和被拦截的 URL。

`POST /api/analyze/html` 对发送的 HTML 执行同样的分析，上限为 600,000 字符，并额外返回 `autoFix.full`。`POST /api/analyze/fix` 返回 `{fixed, originalLength, fixedLength}`，不含诊断信息。

## 检查器与反编译器

```bash
curl -X POST /api/inspect -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
curl -X POST /api/decompile -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
curl -X POST /api/decompile/cloud -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
curl /api/decompile/cloud/abc123/status
curl -L -o salida.zip /api/decompile/cloud/abc123/download
```

`/api/inspect` 返回技术信息（`packageName`、版本、大小、文件数量、`.dex`、`.so`、图标）、检测到的权限、`riskyPermissions`、`findings` 和 `security.score`。最大接受 30 MB，最小 100 字节。

`/api/decompile` 在本地运行：接受 `apkBase64`（带或不带 `data:` 前缀）或 `application/octet-stream` 请求体，最大 100 MB。返回 `meta`、`importConfig`、`sourceZipBase64` 和 `manifestPreview`。

`/api/decompile/cloud` 把 APK 上传到 `decompile-<id>` 分支，并启动使用 `jadx 1.5.1 + apktool 2.9.3` 的 workflow。它返回 `202`，包含 `statusUrl`、`downloadUrl`，以及 APK 将在 20 分钟后从分支删除的提示。上限为 60 MB，并与构建共用每 IP 每小时 10 次的速率限制。状态接口返回 `status`、`conclusion`、`runUrl`、`artifacts` 和 `ready`；客户端以 5 秒间隔轮询，最长等待 5 分钟。下载的 ZIP 包含 `output/sources`（Java）、`output/resources`（res 和 smali）、`AndroidManifest-decoded.xml` 和 `REPORT.txt`。

## 商品页、安全与隐私

```bash
curl -X POST /api/listing -H "Content-Type: application/json" -d '{"appName":"Mi Radio","packageName":"com.miempresa.radio","template":"radio"}'
curl -X POST /api/security-audit -H "Content-Type: application/json" -d '{"appName":"Mi App","url":"https://mi-web.com","permissions":{"cameraMic":true}}'
curl "/api/privacy-policy?appName=Mi%20App&package=com.miempresa.miapp"
```

`/api/listing` 返回 `{ok, listing}`，包含 `title`、`shortDescription`、`fullDescription`、`keywords`、`category` 和 `packageName`，遵循 Play Console 规定的长度限制。

`/api/security-audit` 返回 `score`、`level`、权限 `audit`、`issues`（敏感权限、cleartext），以及包含三项检查的 `gdpr` 列表：是否链接隐私政策、是否存在不必要的敏感权限、是否使用自有 keystore。评分规则为：每个 `fail` 权限扣 20 分，每个 `warn` 扣 5 分，每个高危问题扣 5 分。

`/api/privacy-policy` 返回包含你所提供数据的纯文本。它是供填写的基础模板，而不是最终的法律文件。

## 版本与 CI/CD

```bash
curl -X POST /api/versions/publish -H "Content-Type: application/json" -d '{"appId":"com.miempresa.miapp","version":"1.0.1","changelog":"fix"}'
curl "/api/check-update?appId=com.miempresa.miapp&version=1.0.0"
curl "/api/versions/com.miempresa.miapp"
curl -X POST /api/cicd -H "Content-Type: application/json" -d '{"repo":"usuario/mi-web","branch":"main","baseUrl":"https://tu-dominio.com"}'
```

`versions/publish` 按 `appId` 最多保存 20 条记录，包含 `version`（格式 `1.0.1`）、`changelog` 和日期。`check-update` 与最新发布的版本比较，响应 `{updateAvailable, latest, changelog}`。应用中没有内嵌 OTA 客户端：这是一个你可以随时查询的记录。

`cicd` 返回 `.github/workflows/inteebuild-auto.yml` 的内容，供你上传到自己的仓库，并附上触发 webhook 的 `curl`。真正的集成是携带 `{repo, branch, token, webhookUrl}` 的 `POST /api/git/connect`，它会保存加哈希后的 token；随后携带 `{"repository":{"full_name":"usuario/repo"},"ref":"refs/heads/main"}` 的 `POST /api/git/webhook` 会使用你发送的配置（或从仓库派生的最小配置）启动一次构建。`GET /api/git/integrations` 用于列表，`DELETE /api/git/:id` 用于删除。

## Webhooks

`webhookUrl` 接收带 JSON 的 POST。事件有 `build.completed`、`build.failed` 和 `build.error`（在运行任何内容之前，将项目发送到 GitHub 时出错）。

## 实用工具

- `GET /api/health` — `{ok, service, version, githubReady}`。
- `GET /api/diag` — 在 GitHub 上检查 token、仓库、分支和 workflow，逐步返回 `hint`，让你知道 `.env` 中还缺什么。
- `GET /api/history`、`GET /api/history/:id`、`DELETE /api/history/:id` — 本地历史记录。列表返回文件中最先的 30 条记录（文件本身最多保存 50 条）；`:id` 返回包含所用配置的完整条目。
- `GET /api/stats` — 按状态和 `outputType` 统计的总数，以及已完成构建的平均耗时。
- `GET /api/qr/:id` — 下载链接的 PNG 二维码。
- `GET /api/cleanup?secret=…` — 强制清理过期产物。需要环境中配置 `CLEANUP_SECRET`；没有它端点返回 `403`。
- `GET /api/ads/:slot` 和 `GET /api/ad-proxy?u=` — 自有广告网络，带缓存和素材代理（`u` 是要下载的 URL）。

关于限制和部署的更多内容见 [production.md](./production.md)；关于每次构建的产物，见 [outputs.md](./outputs.md)。
