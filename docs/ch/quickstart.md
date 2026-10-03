# 快速开始

本指南带你把一个网页变成可安装的 APK，使用的是 `index.html` 中的工作台。配置大约需要几分钟；真正的等待来自 GitHub Actions，免费 runner 上每次构建需要三到六分钟。

## 1. 准备源

工作台在 **Aplicación**（应用）步骤接受两种输入：

- **URL**：必须以 `http://` 或 `https://` 开头且可公开访问。localhost、内网 IP 和云元数据端点出于安全原因会被拦截（`server/url-guard.js` 中的 `isBlockedUrl`），同一条规则也适用于 `/api/build` 和 `/api/project`。
- **HTML 直接粘贴**：粘贴你的代码。上限为 500,000 个字符；如果页面更大，请先压缩再粘贴。

继续之前，先点击 **Analizar salud web**（分析网页健康度）。它会返回 0 到 100 的评分以及具体问题（HTTPS、viewport、favicon、`http://` 资源）。这不是编译的必要条件，但几乎所有“白屏”问题都从这里开始。详情见 [analyzer.md](./analyzer.md)。

## 2. 模板或手动设置权限

如果你不知道你的应用需要哪些权限，选择一个模板（共 29 个，见 [templates.md](./templates.md)）：它只预置权限、屏幕方向和 UI 标志，绝不会改动你的 HTML。

如果手动勾选，只勾选你的网页真正用到的权限。Google Play 会拒绝没有正当理由的敏感权限（短信、电话、悬浮窗），Audit 还会提醒 `gpsBackground` 却没有 `gps` 这类不一致。

## 3. 个性化

以下字段有严格校验，因为它们通常是导致 400 的原因：

- **Nombre（名称）**：字母、数字、空格、连字符和点，2 到 40 个字符。示例：`Mi Tienda`。
- **Package ID**：小写字母、数字和下划线，至少包含一个点。示例：`com.miempresa.miapp`。留空则生成 `com.inteebuild.<slug>`。
- **Versión（版本）**：用点分隔的数字，最多四段。示例：`1.0.0`。
- **Salida（输出）**：`apk`、`aab` 或 `both`。没有其他选项：除非下文特别说明，否则不会生成桌面版或 iOS 二进制文件。
- **Icono（图标）**：data URL 形式的 PNG、JPG 或 WebP。上限为 7 * 1024 * 1024 个 base64 字符。

其余内容（屏幕方向、启动页、颜色、抽屉、JS 注入）记录在 [ui-ux.md](./ui-ux.md)。

## 4. 检查并编译

在 **QA** 步骤会显示 Audit 和 readiness。如果编译按钮报错，原因属于以下几种：

- `Falta URL o HTML` —— 回到第 1 步。
- `Audio nativo activo pero sin URL del stream` —— Radio 模板会带上 `nativeAudio: true` 但故意留空 `streamUrl`；请在 Ajustes（设置）步骤粘贴你的流地址（见 [foreground.md](./foreground.md)）。
- Audit 中某个权限处于 `fail` —— 请修正它，而不要强行构建。

编译时，服务器会把项目上传到你的仓库的 `build-<id>` 分支并触发 workflow。进度每 6 秒查询一次（最多 200 次），日志保存在 `GET /api/build/:id/logs` 以及指向 GitHub Actions 的链接中。

完成后，从结果中下载 APK。要在 Android 上安装，需要为你使用的浏览器或文件管理器允许“安装未知应用”。

## 你会遇到的限制

- 每个 IP 每小时 10 次构建。如果收到 429，请等待窗口期结束。
- 构建分支在运行结束后（一分钟后）会被删除，GitHub 的构件 30 分钟后过期：如果下载链接已过期，请重新构建。
- 历史记录保存在本地磁盘（`data/history.json`），50 条，`GET /api/history` 返回最近 30 条。Render 免费版的磁盘会在重启时清空。

## 下一步

- 如果出现问题：[troubleshooting.md](./troubleshooting.md)。
- 带真实测试的权限：[permissions.md](./permissions.md)。
- 电台与播客：[foreground.md](./foreground.md)。
- 从你的后端进行自动化：[api.md](./api.md) 和 `developer.html` 面板。
- 历史记录中的 **JSON** 按钮会保存你的配置以便复用。
