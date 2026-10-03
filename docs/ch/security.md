# 安全

InteeBuild 在两条战线上工作：服务端为避免成为攻击载体所采取的措施，以及它在 APK 中生成的内容以确保应用不泄露任何东西。本页描述目前实现的内容及其局限。

## 服务端

### 出站 URL

`isBlockedUrl` 应用于 `/api/build`、`/api/project`、`/api/analyze`、分析器返回的重定向以及 PWA manifest 的下载。它拦截：

- 任何非 `http` 或 `https` 的协议，以及无法解析的 URL。
- 私有或本地主机：`localhost`、`127.*`、`10.*`、`192.168.*`、`172.16-31.*`、`0.0.0.0`、`::1`、`fc00:*`、`fe80:*` 和 `169.254.*`。
- 云元数据端点：`169.254.169.254`、`metadata.google.internal` 和 `100.100.100.200`。

这样可以防止攻击者把分析器或构建变成指向服务器内网的代理。它不防护公网目标：任何公开 URL 仍然有效，因为这正是产品用途所在。

### 大小与速率限制

- HTML：`/api/analyze`、`/api/build` 和 `/api/project` 为 500,000 字符；`/api/analyze/html` 为 600,000 字符。
- 图标：`/api/build` 为 7 MB 的 base64。
- 请求体：`express.json` 为 110 MB，`express.raw` 为 100 MB。
- APK：本地反编译器 100 MB，云端 60 MB，`/api/inspect` 为 30 MB。
- 速率限制：`POST /api/build`、`POST /api/v1/build` 和 `POST /api/decompile/cloud` 每个 IP 每小时 10 次操作。三者共用同一个计数器，因此用掉一个就消耗了其他两个的额度。

限制保存在内存中，因此进程重启后会丢失。

### API Key

它们只以 sha256 哈希（`keyHash`）和十位前缀保存；密钥本身不会持久化。`GET /api/keys` 返回脱敏的哈希，`DELETE /api/keys/:id` 执行带 `revokedAt` 的逻辑删除，此后该 key 不再能通过认证。支持 `X-API-Key` 和 `Authorization: Bearer`。

有两个限制需要知道：`scopes` 会被保存但没有任何路由校验它；在尚未创建任何 key 之前，整个 API 是开放的。在公开服务器之前先创建第一把 key。

### CORS 与响应头

`.env` 中的 `CORS_ORIGIN` 固定允许的来源。如果留空，则反射任意来源，这是开发模式；生产环境请填入你的域名。

所有响应都带有 `X-Content-Type-Options: nosniff`、`X-Frame-Options: SAMEORIGIN`、`Referrer-Policy: strict-origin-when-cross-origin` 和 `Permissions-Policy: camera=(), microphone=(), geolocation=()`。

### 响应中的机密

`/api/health` 只说明 GitHub 是否已配置。`/api/diag` 检查 token、仓库、分支和 workflow，并返回文字说明，从不返回 token 的值。历史记录保存每次构建的配置，但不含密码：`iconBase64`、keystore 和 iOS 相关内容在写入条目前就会被剔除。

### Webhook

`webhookUrl` 接收带纯 JSON 的 POST（`build.completed`、`build.failed`、`build.error`），超时 8 秒。不带 HMAC 签名：如果你的接收端比较敏感，请在 URL 中要求自己的 token 或校验来源。

## 生成的应用中

### FLAG_SECURE

`flagSecure` 选项会为 `MainActivity` 的窗口添加 `FLAG_SECURE` 标志，从而阻止该活动的截屏和录屏。`empresa`、`dashboard`、`finanzas` 和 `banking` 模板默认启用它。

### 选择锁定

`blockSelection` 会向你的 HTML 注入 CSS（主要是 `user-select: none`，文本字段除外），同时也经过目录脚本。它出现在 `finanzas` 和 `banking` 中。用于防止长按复制数据；它不是密码学也不是加密。

### 目前不起作用的部分

`banking` 模板带 `screenCaptureSecurity: true`，`emergency` 带 `highPriority: true`，但这两个字段都不在 `normalizeConfig` 中，因此既不会到达清单也不会到达代码。通知渠道区块（`notifChannel`、`notifImportance`、`notifSound`、`notifVibration`）确实会被规范化，但目前也没有任何生成器读取它：不会改变任何东西的优先级。

### 权限

Permission Engine 有 86 个条目，其中 52 个是实时执行的。思路是最小权限：`gps` 和 `gpsBackground` 是不同的权限，在 Play Store 上需要不同的理由，`bluetoothScan`、`bluetoothConnect` 和 `bluetoothAdvertise` 可以分别请求，`useExactAlarm` 和 `scheduleExactAlarm` 也是如此。Audit 会检查清单、实时权限、原生实现、JavaScript 桥接以及与 provider 的兼容性，只有全部吻合时才返回 `canBuild`。

一个刻意阻止的案例：`ads` 返回 `NO GENERADO`，因为生成器不会写入 AdMob 初始化和广告视图，Audit 将其视为失败。

### 签名

自签名是可选的，用你自己的 keystore 配置（只有在填写了密码和别名时 `useCustomSigning` 才会启用）。keystore 不在构建之间共享，签名配置会从历史记录中剔除，APK 下载始终经过你的服务器。iOS 构建只有在你提供 `.p12`、`.mobileprovision` 和密码时才会签名。

### 前台服务

音频服务声明为 `android:exported="false"` 和 `foregroundServiceType="dataSync|mediaPlayback"`（如果还有 `advGeo` 则加上 `location`），配套权限为 `FOREGROUND_SERVICE`、`FOREGROUND_SERVICE_DATA_SYNC` 和 `FOREGROUND_SERVICE_MEDIA_PLAYBACK`。通知是常驻的，以免系统杀掉服务。详情见 [foreground.md](./foreground.md)。

## GitHub Actions

每次构建都会上传到 `build-<id>` 分支，并在临时 runner 上运行。分支在结束后约一分钟被删除，30 分钟的自动清扫会清理超过 5 分钟的分支以及超过 30 分钟的运行和构件。这就限定了你的 HTML 和 APK 在构建仓库中保留的时间。

服务器使用的 token 必须是细粒度（fine-grained）的，仅对构建仓库具有 `Contents: Read/write` 和 `Actions: Read/write`。workflow 本身不使用 GitHub secrets：它需要的一切都在构建分支中携带。如果你提供自己的 keystore，那个临时 ZIP 会包含 `user-keystore.jks` 和明文密码的 `signing.properties`，分支在运行结束后 60 秒被删除；30 分钟的清扫会清除任何残留。如果你介意这个缺口，请使用一个可以轮换的发布 keystore，并使用私有的构建仓库。

## 数据与隐私

没有数据库：`data/builds.json`、`data/apikeys.json`、`data/git-integrations.json` 和 `data/versions.json` 都是本地文件。你提交的 HTML 代码会在构建期间上传到构建仓库，并随分支一起删除。你可以在 Play 上链接的通用政策来自 `GET /api/privacy-policy`，它是为了让你修改后使用，而不是让你原样发布。

对于最终用户，实际的建议是：只授予应用请求的权限、确认 APK 的来源，并保持应用更新。每个权限的作用见 [permissions.md](./permissions.md)。

## Play Store 合规

敏感权限（`phone`、`sms`、`systemAlert`、`installPackages`、`gpsBackground`）需要在 Play 商店页提供理由。`ACCESS_BACKGROUND_LOCATION` 有自己单独的表单和审批流程。`USE_EXACT_ALARM` 只接受时钟、日历或闹钟类应用。`POST /api/security-audit` 会标出这些权限，并返回 GDPR 清单中取决于你的三点：已链接的政策、不必要的权限和自有 keystore。

## 手动验证

构建之后，在终端检查 ZIP：

```bash
unzip -p proyecto.zip main-manifest.xml | grep "uses-permission"
unzip -p proyecto.zip MainActivity.java | grep "NativePermissions"
unzip -p proyecto.zip main-manifest.xml | grep "RadioService"
```

以及通过 API：

```bash
curl -X POST /api/manifest-diff -H "Content-Type: application/json" -d '{"url":"https://mi-web.com","permissions":{"gps":true}}'
curl -X POST /api/security-audit -H "Content-Type: application/json" -d '{"url":"https://mi-web.com","permissions":{"gps":true}}'
```

`manifest-diff` 会告诉你请求了什么、实际出现了什么，包括 `missing` 和 `unexpected`。`security-audit` 返回评分、问题列表和 GDPR 清单。

## 职责划分

应用开发者一方：不要把机密放进 HTML、使用 HTTPS、在后端校验你的网页所校验的内容，并在每次修改权限后编译前检查 Audit。InteeBuild 一方：生成你所请求的清单和处理程序、在服务端校验输入并保持限制生效。任何一方都不能替代另一方。

更多内容见 [permissions.md](./permissions.md)、[foreground.md](./foreground.md) 和 [production.md](./production.md)。
