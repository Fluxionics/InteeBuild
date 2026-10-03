# InteeBuild 文档

本文件夹是 `docs.html` 在浏览器中加载的文档。所有指南都编写为可与仓库代码进行核对：如果某条说法无法在 `server/` 中得到验证，就不应该放在这里。

如果你是第一次使用，请从[快速开始](./quickstart.md)看起。

## 指南

- [quickstart.md](./quickstart.md) — 从零到用工作台构建第一个 APK。
- [permissions.md](./permissions.md) — 86 个细粒度权限：每个权限生成什么、如何测试以及 Audit 返回什么。
- [foreground.md](./foreground.md) — 使用 `RadioService`、`MediaSession` 和 `WakeLock` 实现后台音频。
- [templates.md](./templates.md) — 29 个模板以及每个模板预置的内容。
- [providers.md](./providers.md) — WebView 引擎：哪些能编译，哪些只生成代码。
- [ui-ux.md](./ui-ux.md) — 生成器接受的外观和行为字段。
- [outputs.md](./outputs.md) — 每次构建产出什么（APK、AAB、ZIP、PWA、Play Store 商店页）。
- [api.md](./api.md) — REST API、API Key、webhook 与 `curl` 示例。
- [analyzer.md](./analyzer.md) — 网页健康度分析器、评分与自动修复。
- [decompiler.md](./decompiler.md) — 本地与云端反编译。
- [versions.md](./versions.md) — 版本、更新检查与每次 push 的自动构建。
- [security.md](./security.md) — 服务端限制、SSRF、API Key 以及生成的应用暴露了什么。
- [production.md](./production.md) — 在 Render 上部署、环境与诊断。
- [troubleshooting.md](./troubleshooting.md) — 常见错误及其原因。
- [faq.md](./faq.md) — 常见问题：providers、限制、日志、iOS、音频。

## 证据约定

- `GENERATED OK` 表示该元素存在于待编译的 ZIP 中，而不是只存在于定义中。你可以用 `POST /api/project` 下载它并手动查找。
- `SPEC ONLY, NOT GENERATED` 表示你请求了但它没有被生成：不要部署它。
- Audit 可通过 `POST /api/permissions/audit` 或工作台上的 QA 按钮运行。
- 有用的测试顺序只有一条：先最小化、每次构建只加一个权限、使用真实设备。
