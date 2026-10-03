# Analyzer：编译前的安全、错误与优化检查

Analyzer 会在不进行任何编译的情况下审计你的网站。可以通过“应用”步骤中的 `Analizar salud web` 按钮触发，或通过 API 用 `GET /api/analyze?url=…` 触发。如果你想检查的是一段独立的 HTML，`POST /api/analyze/html` 可以在不下载任何内容的情况下完成同样的工作。

它不是一个经过认证的安全分析器：这些是服务器上的本地规则，没有 AI，也不依赖外部服务。它的作用是让你在把网站塞进 WebView 之前，一眼看出还缺什么。

## 基础检查

它以 10 秒超时下载页面，并检查一系列具体项：是否使用 HTTPS、是否响应、是否具有 `meta viewport`、manifest、favicon、theme-color、service worker，是否有任何 `src` 或 `href` 指向 `http://`，HTML 是否有 doctype，以及是否存在 Open Graph 和结构化数据。如果页面带有 manifest，会尝试从 `/manifest.json` 或 `/manifest.webmanifest` 下载，并把内容返回在 `pwa` 中。

由此得出 0 到 100 的 `score` 和文字诊断：90 分及以上为 `Listo para compilar`，70 分及以上为 `Bueno, con mejoras menores`，50 分及以上为 `Necesita ajustes`，低于 50 分为 `Requiere correcciones`。每项检查都会加分或扣分：viewport 和 service worker 的权重高于 favicon。

请求使用 `redirect: manual`，因此不会跟随重定向：如果响应是 3xx，只会检查 `Location` 头是否指向内网 URL，并原样返回状态码。

## 安全

`security` 模块返回自己的 `score`（0-100）、一个 `level`（`Excelente`、`Bueno`、`Riesgo medio`、`Crítico`）以及一份包含严重程度和修复建议的问题列表。它能检测：

- 缺少 HTTPS（扣 25 分）。
- 缺少 Content-Security-Policy，无论是在响应头还是 `http-equiv` 中。
- 使用 `http://` 加载的资源以及通过 HTTP 加载的外部脚本。
- HTML 中的 `eval()`。
- 未经净化的 `innerHTML`。
- 读取时缺少 `Secure` 标志的 Cookie。
- jQuery 1.x 或 2.x。
- 缺少 `X-Content-Type-Options: nosniff`。

这些规则在 WebView 内同样适用：mixed content 和 `eval()` 在打包应用中依然是问题。

## 错误

`errors` 返回两个列表。`errors` 针对真正会出问题的情况：缺少 `<!DOCTYPE html>` 和缺少 `<html>` 标签。`warnings` 则是其余问题，包含 `type`、消息和修复建议：重复的 ID（列出前三个）、可能存在未闭合标签的错位、缺少 `alt` 的图片、超过 15 处内联样式、用 `var` 而不是 `let` 或 `const`、`if` 内可能的赋值，以及空的 `#` 链接。摘要中包含 `total`、`altMissing` 和 `duplicateIds`。

## 优化

`optimization` 返回 `score`、`grade`（85 分及以上为 `A`，70 分及以上为 `B`，50 分及以上为 `C`，低于 50 为 `D`）、`sizeKB`、`images`、`scripts`，以及一份影响程度为 `high`、`medium` 或 `low` 的 `tips` 列表。它检查 HTML 体积、图片数量及其中未使用 `loading="lazy"` 的数量、外部脚本数量、阻塞式 CSS、缺少 WebP，以及重复的 `<style>` 块。

## Framework、Web API 与权限

`frameworks` 是通过正则检测到的标签列表：React、Vue、Angular、Next.js、Nuxt、Svelte、Astro、Vite、WordPress、Shopify、Webflow、Wix、Bubble、Lovable、Replit、Bootstrap 和 Tailwind。如果没有识别到任何内容，返回 `html`。

`detectedApis` 列出存在的 Web API：地理定位、摄像头、麦克风、Bluetooth、NFC、通知、振动、分享、全屏、方向、localStorage、indexedDB、service worker、WebGL、支付、剪贴板和 wake lock。据此，`recommendations` 会换算出还缺少哪些权限和插件：例如，`geolocation` 会建议 `gps` 权限和 `geolocation` 插件。

同一条逻辑也用于“权限”步骤中的 `Sugerir por Web API` 按钮，以及 `POST /api/permissions/suggest`，后者接受 HTML、URL 或已检测到的 API 列表。

## 自动修复

`autoFixHtml` 只做四件事：把 `src` 和 `href` 中的 `http://` 改为 `https://`，给没有该属性的图片加上 `loading="lazy"`，如果缺少则注入 `meta viewport`，并给没有 `alt` 的图片加上 `alt=""`。结果会与原始内容比较以得出 `autoFix.available`，前 8,000 个字符会放在 `autoFix.preview` 中。

有三种方式应用它：

- `POST /api/analyze/fix` 返回 `{fixed, originalLength, fixedLength}`，其中包含修正后的完整 HTML。
- `POST /api/analyze/html` 除 `preview` 外还返回 `autoFix.full`。
- 工作台中的 `Aplicar Auto-Fix y previsualizar HTML optimizado` 按钮会把结果放入编辑器供你检查。

这是启发式的。空的 `alt=""` 并不是可访问的描述，而对一个并不存在 HTTPS 版本的资源强制使用 `https://` 会让图片加载失败。在认可输出结果之前，请先检查 diff。

## 推荐的工作顺序

先用 URL 进行分析，如果分数低于 70，就应用修复并查看优化列表。然后检查 `security`：你现在忽略的 `eval()` 或 mixed content，在构建中依然会出现。使用 `Sugerir por Web API` 只勾选你的网站真正用到的权限，在“权限”步骤的 Audit 中核对结果，并在你对站点做较大改动后重新分析。

大小限制见 [api.md](./api.md)；Permission Engine 如何使用这些信息，见 [permissions.md](./permissions.md)。
