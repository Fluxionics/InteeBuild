# 常见问题

针对最常被问到的问题给出简短回答。每条都指向可与代码核对的指南。

## 我该选择哪个 provider？

如果没有理由更换，选 `capacitor`：它是唯一所有补丁都经过测试的（运行时权限、特殊访问权限、原生音频、Droncito Pack）。想要最轻量的 APK 选 `native`；需要 Mozilla 引擎选 `gecko`；`twa`、`cordova`、`flutter` 和 `tauri` 则用于对应的生态。目前它们都能在 CI 中编译。每个 provider 的详情和限制见 [providers.md](./providers.md)。

## Flutter 和 Tauri 真的能编译吗？

能。`flutter` 启动作业 `flutter-build`（Ubuntu + `flutter create` + `flutter build apk`），交付 `-apk` 产物，如果你请求了，还会交付 `-aab`。`tauri` 启动 `tauri-build`（Windows + `cargo build --release`），交付 `-exe`。workflow 通过 input 接收 provider，并据此跳过或启用相应作业。见 [outputs.md](./outputs.md)。

## 我能做多少次构建？

每个 IP 每小时 10 次，另外每小时还有 10 次反编译。限制由服务器针对你的 IP 施加；达到上限时 API 返回 `429`。

## 在哪里可以看到构建的完整日志？

在构建详情页，控制台会显示所有作业和步骤的日志（每次构建最多 500 KB）。通过 API：`GET /api/build/:id/logs`。如果你需要原始细节，GitHub Actions 会在分支和产物存活期间（30 分钟）保留该 run。

## iOS 构建能用吗？

能。workflow 使用 `pod install` 并针对 `App.xcworkspace`（而不是 `App.xcodeproj`）编译，这是使用 Capacitor pods 所必需的。没有证书时，`ios-build` 步骤会关闭签名并在模拟器上编译；在签名步骤提供 `.p12` 和 `.mobileprovision` 后，会为真机构建归档。见 [outputs.md](./outputs.md)。

## 为什么屏幕关闭后音频会中断？

几乎总是以下三种之一：URL 是 `blob:`（hls.js、YouTube）、你的 HTML 在 `visibilitychange` 时暂停，或构建缺少 `foreground` + `streamUrl`。`gecko` provider 永远不会有向原生的转移，因为 GeckoView 不允许 `addJavascriptInterface`。完整清单见 [foreground.md](./foreground.md)。

## Audit 中每个徽标是什么意思？

`GENERATED OK` = 该条目在待编译的 ZIP 中。`SPEC ONLY, NOT GENERATED` = 你请求了但未生成。`NO GENERADO` = 没有实现（会阻止构建，例如 `ads`）。provider 列中则是：`OK (<provider>)`、`WARN (<provider> sin handler declarado...)` 或 `WARN (<provider> compila APK en CI...)`。见 [permissions.md](./permissions.md)。

## 应用有多大？

服务器限制为图标 7 MB、HTML 500 KB。`native` 的 APK 最轻量，因为它不携带 Capacitor 运行时；使用 `gecko` 时构建耗时会长得多，因为 `patch-gecko-gradle.js` 每次编译都会从 `maven.mozilla.org` 下载 Mozilla 的 AAR。

## 我可以不用工作台编译吗？

可以：`POST /api/project` 返回包含全部内容（含 workflow）的 ZIP，你可以把它上传到自己的 GitHub 仓库。workflow `build-app.yml` 与服务器使用的相同；inputs 为 `id`、`platform`、`outputs` 和 `provider`。见 [api.md](./api.md)。

## 产物会永久保存吗？

不会：它们在 GitHub Actions 上存活 30 分钟，服务器也会同样清理。本地历史（`GET /api/history`）会在条目有效期内保留元数据和链接；如果已过期，重新编译即可。

## 应用能离线使用吗？

PWA 可以：启用 `pwaEnabled`（默认开启）后，ZIP 包含 `manifest.webmanifest` 和 `sw.js`，可离线缓存你的 HTML。Android 应用在其 WebView 中展示你的网站；service worker 的离线缓存取决于你的 HTML 和服务器的响应头。见 [outputs.md](./outputs.md)。

## 每项外观选择会影响什么？

`accentColor` 进入清单和原生颜色，`splashColor` 进入启动画面，`orientation` 进入清单和桌面窗口。详情见 [ui-ux.md](./ui-ux.md)。

如果出现问题，先看 [troubleshooting.md](./troubleshooting.md)。
