# 故障排查

本列表中的案例是最常出现的。先完整阅读错误消息：大多数会准确说明缺了什么。

## “编译”按钮无法继续

在启动任何操作之前，工作台会调用 `POST /api/build-readiness`，如果 `canBuild` 为 `false`，就会以红色显示 `warnings` 并且不进行编译。最常见的警告：

- `Audio nativo activo pero sin URL del stream: pon tu servidor en Audio nativo` — 电台或流媒体模板默认启用了 `nativeAudio`，但 stream 字段为空。请在“设置”步骤的原生音频卡片中填写它。
- `streamUrl debe empezar con http:// o https://` — 你的 stream URL 缺少协议部分。
- `Falta URL o HTML` — 第 1 步中没有内容来源。
- `X requiere Android N+` — 某个权限要求更高的 `targetSdk`。提高 SDK 版本或移除该权限。

如果 readiness 检查没有响应，工作台仍会尝试编译，并向你显示服务器的真实错误。

在 QA 步骤中还有一份会变红的检查清单。只要有一项未通过，或未接受条款，前进按钮就会被禁用：这是有意为之，但上方的消息会告诉你需要修正什么。

## 构建根本没有启动

- `503 "GitHub no configurado..."` — 缺少 `GITHUB_TOKEN` 或 `INTEE_BUILDS_REPO`。查看 `/api/diag`。
- `429` 伴随 `Limite de builds alcanzado (10 por hora)` — 计数器按 IP 统计，`/api/build`、`/api/v1/build` 和 `/api/decompile/cloud` 共用。等待这一小时过去。
- `400` 伴随校验消息 — 文本会解释原因：应用名称、package ID、版本、被拦截的 URL、超过 500,000 字符的 HTML 或大于 7 MB 的图标。
- `/api/v1/build` 返回 `401` — 已经存在至少一个 API key，而你没有发送任何一个。用 `POST /api/keys` 创建一个。

## GitHub Actions 失败

从构建结果或 `/api/build/:id` 打开 run 的链接。常见错误：

- **`422 No workflow found with any ref`** — workflow 尚未在基础分支上注册。服务器会自动重试，最多六次且等待时间递增；如果仍然失败，等待几秒后重新发起。
- **Gradle 失败** — 几乎总是 SDK 或依赖问题。试试把 `compileSdk` 和 `targetSdk` 设为 35，这是生成器经过测试的值。run 中的步骤名为 `Compile APK`、`Compile Release APK`、`Compile AAB` 和 `Compile Release AAB`。
- **`package org.mozilla.geckoview does not exist`** — `Apply GeckoView dependencies` 步骤未运行，或其补丁失败：在日志中执行 `grep -c geckoview android/app/build.gradle` 后应出现 `geckoview`。如果 ZIP 来自生成器的旧版本，请重新生成项目；如果仍然没有，切换到 `capacitor` 或 `native`。
- **workflow 结束但没有产物** — 请求的输出（`apk`、`aab` 或 `both`）与实际编译的内容不符，或者 Gradle 没能完成打包。查看 run 中的 `Compile APK` 和 `Compile AAB` 步骤。

## APK 无法下载

1. 检查构建是否已达到 `success`。
2. `/api/download/:id` 要求构建仍在服务器内存中：如果进程已重启，即使产物在 GitHub 上存在也会返回 `404`。
3. 分支在完成后约一分钟被删除，每 30 分钟一次的自动清扫会移除超过 30 分钟的 run 和产物。如果已过期，重新编译。
4. `404 "AAB no encontrado"` 表示你请求的是 APK；`IPA no encontrado (firma iOS requerida)` 表示没有 Apple 证书。

## 应用打开后是空白的

- 如果你关闭了 HTTP 流量（cleartext）选项，清单会带有 `android:usesCleartextTraffic="false"`，`http://` 的 URL 将无法加载：你会看到一片空白。重新启用它或使用 HTTPS。默认情况下清单是允许 cleartext 的。
- 检查你的站点是否允许被嵌入：服务器上的 `X-Frame-Options` 或 `Content-Security-Policy: frame-ancestors` 头会阻止 WebView，你会看到空白屏幕。
- 在应用打开的情况下查看你站点的控制台：JavaScript 错误与浏览器中相同。
- 当 provider 为 `flutter` 时，APK 来自作业 `flutter-build`（查看其 `Build APK`/`Build App Bundle` 步骤），而不是 `Compile APK`。为 `cordova` 时来自作业 `cordova-build`（`Compile Cordova APK` 步骤）。为 `tauri` 时 APK 仍是 Capacitor 的，另外还有一个来自 `tauri-build` 作业的 `.exe`。`gecko` provider 确实会编译一个不同的 APK：其 `MainActivity` 是 GeckoView。

## Android 上权限被拒绝

1. 用 `POST /api/project` 下载项目，检查 `main-manifest.xml` 是否包含该权限。
2. 第一次在 Android 设置中手动授予该权限。
3. 如果你的网站请求摄像头而你没有勾选 `cameraMic`，生成的 `WebChromeClient` 不会把该资源列入允许列表，会响应 `deny()`。勾选该权限并重新编译。
4. `minSdk` 较高的权限在你的 `targetSdk` 更低时会在 Audit 中给出 `warn`；提高 SDK。

## Audit 和 readiness 显示为红色

- `gpsBackground sin gps` — 同时启用精确定位。
- 某一行出现 `SPEC ONLY, NOT GENERATED` — 该权限存在于 spec 中，但没有进入生成的清单；通常这种情况需要另一个基础权限。
- `NO GENERADO` — 该条目没有实现（`ads` 就是这种情况）。Audit 将其视为失败并阻止构建。
- 行显示 `REQUIRES ANDROID N+` — 提高 `targetSdk` 或移除该权限。
- 如果前进按钮被禁用，说明 Audit 中有 `fail`：修正它，而不是强行绕过。

## 分析器评分过低

- 没有 HTTPS：分析器扣 10 分，安全模块在其自身评分上扣 25 分。这是首先要修复的问题。
- 没有 `viewport`：扣 10 分（有它则加 20 分）；添加 `<meta name="viewport" content="width=device-width, initial-scale=1">`。
- 没有 service worker 和 manifest：拿不到本应加上的 15 分和 10 分，`checks.pwa` 保持为 `false`。
- 使用 `http://` 的资源：每个资源扣 2 分，最多扣 20 分。安全模块会单独统计这些资源。
- 如果分数很低，应用 Auto-Fix 并检查 diff：该修复是启发式的，可能会留下空的 `alt=""`，或对不存在的资源强制使用 `https://`。

## 浏览器控制台中的错误

- 访问广告域名时出现 `ERR_BLOCKED_BY_CLIENT` — 是 adblocker 造成的。广告现在通过你自己的域名 `/api/ads/:slot` 提供；如果仍然出现，进行强制刷新或重新部署。
- `cdn.tailwindcss.com should not be used in production` — Tailwind 的警告，不会造成任何问题。
- `No label associated with a form field` — 无障碍方面的警告，不会阻塞任何操作。
- 加载编辑器时出现 `Uncaught SyntaxError` — 进行强制刷新。

## 表单校验

- 名称：字母、数字、空格、连字符和点，2 到 40 个字符。
- Package ID：小写字母、数字和下划线，至少包含一个点（`com.miempresa.miapp`）。
- 版本号：带点的数字（`1.0.0`）。
- SDK：如果值不在有效列表中，服务器会替换为有效值，而不是拒绝。
- 来源为 HTML 但 HTML 为空：会被拒绝；粘贴你的代码或使用某个模板的界面。

## 反编译器

- 云端出现 `413` 或 "APK demasiado grande"：上限是 60 MB；本地模式可达 100 MB。
- `Rate limit: 10/h por IP`：与构建共用同一个计数器。
- `409 Workflow todavía corriendo`：稍候再重试下载。
- `404 El workflow terminó sin artefacto`：查看 run 的日志；混淆过的 APK 通常会在这里失败。
- `500 Configura GITHUB_TOKEN...`：缺少与编译相同的配置。

## 服务器诊断

`/api/diag` 依次检查 token、仓库、分支和 workflow，并在第一个失败处停下，同时给出说明该改什么的 `hint`。如果它返回 `ok: true` 而构建仍然失败，问题出在 GitHub 的 run 上：打开其日志。各字段的详情见 [production.md](./production.md)。

如果问题与权限有关，参考资料在 [permissions.md](./permissions.md)；如果与后台音频有关，在 [foreground.md](./foreground.md)。
