# Providers：哪个引擎渲染你的应用

provider 决定你的应用得到什么样的 `MainActivity` 和渲染技术栈。它在 **Aplicación**（应用）步骤的 provider 卡片中选择，或通过 API 的 `provider` 字段选择。该值保存在 ZIP 内的 `provider.json` 中，workflow 在 `Apply provider WebView (pro)` 步骤读取它。

在看状态表之前，有一点需要先弄清楚：**共有三个家族**。`capacitor`、`native`、`twa` 和 `gecko`（以及别名 `react-native`/`ionic`）编译的都是同一个 Gradle 项目：workflow 添加 Capacitor 的 Android 平台并执行 Gradle；唯一的区别是 provider 是否替换 `MainActivity`。`cordova` 自带项目和专属 job（`cordova-build`），使用真实的 Cordova 工具链。`flutter` 和 `tauri` 也自带项目和专属 job：Flutter 不动 Capacitor 的 Gradle，Tauri 在 Windows 上用 Cargo 编译。

## 对比表

| Provider | 当前生成什么 | 在 CI 中编译 | 适合 |
|---|---|---|---|
| **Capacitor**（默认） | 完整的 Capacitor 项目：`MainActivity extends BridgeActivity`、npm 插件、InteeBridge、Ads 配置 | APK + AAB | 基于 npm 生态的完全控制 |
| **Native WebView** | 预置的 `MainActivity` Java：WebView、运行时权限、RadioService、AudioBridge、DownloadManager、文件选择器 | APK | 轻量 APK、启动快、无依赖 |
| **GeckoView** | 带 GeckoView + `PermissionDelegate` 的 `MainActivity`、文件提示、下载（`onExternalResponse`）和 Mozilla Gradle 补丁 | APK | 纯 Mozilla 引擎，与 Chromium 隔离 |
| **TWA** | `twa-manifest.json` + `assetlinks.json`（APK 仍是 WebView 路线） | APK | 带 Digital Asset Links 的 PWA |
| **Cordova** | 真实的 `config.xml`（SDK、方向、全屏）+ CI 中的 `cordova-android` 平台 | APK (+AAB) (`cordova-build`) | 完全生活在 Cordova 工具链中 |
| **Flutter** | Flutter 项目：`pubspec.yaml`、`main.dart`、资源、自有清单 | APK + AAB (`flutter-build`) | 如果你的应用本来就用 Flutter |
| **Tauri** | `tauri/src-tauri`（Rust）：`Cargo.toml`、`tauri.conf.json`、`main.rs`、图标 | 桌面 EXE (`tauri-build`) | 使用 WebView2 的桌面应用 |

以下两个是刻意不实现的：**NativeScript**（又一个需要维护的完整运行时）和 **webapkify**（仅供参考：不能编译）。方案中"自研 WebToApp"指的正是 `native` provider。TWA 不在 CI 中运行 bubblewrap：只交付清单。

## 真实状态

- **`capacitor`（默认）** —— 生成完整的 Capacitor 项目：`capacitor.config.json`、`@capacitor/*` 依赖、`MainActivity extends BridgeActivity`。它是唯一所有补丁都经过测试的：运行时权限、特殊访问、DownloadManager、原生音频、Droncito Pack。
- **`native`** —— 生成 `native-MainActivity.java`（一个带 `WebView` 的 `AppCompatActivity`，带选择性权限授予、内置的 `RadioService` 和 `AudioBridge` 启动、把下载排入 `DownloadManager` 的 `DownloadListener` —— 通过 `ibFileName()` 从 `Content-Disposition` 或 URL 取文件名，失败时回退到 `ACTION_VIEW` —— 以及打开 `ACTION_GET_CONTENT` 并带 `EXTRA_MIME_TYPES`/`EXTRA_ALLOW_MULTIPLE`、通过 `onActivityResult` 用 `ValueCallback` 返回 `Uri` 的 `onShowFileChooser`），workflow 会把它复制为 `MainActivity.java`。输出轻量、启动快，代价是没有 Capacitor 运行时：npm 插件不存在，`inteebridge.js` 只在带网页回退的方法上可用（`share`、`vibrate`、`clipboard`、`storage`、`toast`、`dialog`）；依赖插件的方法（`Intee.location()`、`Intee.camera()`、`Intee.notifications.schedule()`）会以 "no disponible" 拒绝。`InteeAudio` 可以工作，因为原生桥接注入在类本身中。可以在配置中用 `downloadManager: false` 关闭下载。
- **`gecko`** —— 生成 `gecko-MainActivity.java`（一个创建 `GeckoView`、打开 URL 并通过 GeckoView 的 `PermissionDelegate` 烧录权限的 `AppCompatActivity`：它用代码 4101 请求 Android 权限并向会话返回 `grant`/`reject`，如果存在 `foreground` 还会启动 `RadioService`）以及 `patch-gecko-gradle.js`，它把依赖 `org.mozilla.geckoview:geckoview` 和仓库 `https://maven.mozilla.org/maven2` 注入 `build.gradle`。workflow 在 `Apply GeckoView dependencies` 步骤应用它，因此无需手动操作即可编译。APK 的其他部分使用 Capacitor 的权限运行时。文件选择走 `PromptDelegate.onFilePrompt`（返回 `GeckoResult<PromptResponse>`，从 `onActivityResult` 用 `FilePrompt.confirm(Context, Uri[])` 或 `FilePrompt.dismiss()` 解决），下载走 `ContentDelegate.onExternalResponse`：先尝试用 `Content-Disposition`/URL 走 `DownloadManager`，如果 URL 无法重新下载，则在另一个线程把 `body` 复制到下载目录。已知限制：GeckoView 不暴露 `addJavascriptInterface`，因此在该 provider 下**不存在 `window.InteeAudio`** 和 `Intee.*` 桥接（`catalog.js` 的移交运行时会检测到并什么都不做：屏幕关闭时 WebView 的音频会中断）。GeckoView 的 AAR 约 200 MB，下载很慢且每次构建都会发生。
- **`twa`** —— 生成 `twa-manifest.json` 和 `assetlinks.json`，供你用 bubblewrap 构建 Trusted Web Activity（附带的 README 中有说明：`bubblewrap build --manifest=twa-manifest.json`）。workflow 编译出的 APK 仍是带 Capacitor 运行时的普通 WebView 应用；它不是 TWA。此外，`assetlinks.json` 中的 `sha256_cert_fingerprints` 是用占位零生成的：上传到 `/.well-known/` 之前必须替换为你真实签名证书的指纹。
- **`cordova`** —— 在 ZIP 根目录写入真实的 `config.xml`（`<content src>`、`access`/`allow-intent`、`Orientation`、`Fullscreen`、`BackgroundColor`，以及带你版本号的 `android-minSdkVersion`/`android-targetSdkVersion`/`android-compileSdkVersion` 偏好设置），并在 CI 中运行 **`cordova-build`** job：`cordova platform add android`、把 `main-manifest.xml` 中的 `<uses-permission>`/`<uses-feature>` 注入生成的清单（必要时加上 `INTERNET` 和 `usesCleartextTraffic`）、把图标复制到 `mipmap-*`，以及 `cordova build android`（debug APK；如果你请求了 AAB 则生成 AAB，带 `continue-on-error`；用你的 keystore 通过 `build.json` 签 release）。在此 provider 下会跳过 Capacitor 的 `compile` job。它**不**继承：批量权限运行时 `NativePermissions`、`SpecialAccess`、`RadioService`/`AudioBridge` 以及 `InteeBridge`（网页运行在标准 `CordovaWebView` 中）；iOS 上的编译仍走 Capacitor。Audit 将其视为 `CI_ANDROID`（在 CI 中编译 APK，权限由应用运行时管理）。
- **`flutter`** —— 写入 `flutter/pubspec.yaml`（webview_flutter 4 + permission_handler）、`flutter/lib/main.dart`（WebView，用 `loadFlutterAsset('assets/www/index.html')` 或用 `loadRequest` 加载 URL，控制器在 `initState` 中初始化）、不含 `package=` 的自有 `AndroidManifest.xml`（AGP 8 使用脚手架 Gradle 的 `namespace`）、带你网页的 `flutter/assets/www/*` 以及一个 README。在 CI 中，`flutter-build` job 执行 `flutter create` 生成 Android 宿主，把你的清单覆盖上去，把 `applicationId`/`namespace` 调整为你的包名，把 `MainActivity.kt` 移到正确的包下，然后编译：产物为 `-apk` 和（如果你请求了 `aab`）`-aab`。在此 provider 下会跳过 Capacitor 的 `compile` job。
- **`tauri`** —— 写入 `tauri/src-tauri/Cargo.toml`、`tauri/src-tauri/build.rs`、`tauri/src-tauri/tauri.conf.json`（`distDir: ../../www`，为注入脚本设置带 `unsafe-inline` 的 CSP）、`tauri/src-tauri/src/main.rs`、图标（`icons/*.png`、`icon.ico`、`icon.icns` 由你的 PNG 生成；如果你的图标不是 PNG，则省略 `bundle.icon` 键）以及一个 README。在 CI 中，`tauri-build` job 在 `windows-latest` 上运行 `cargo build --release` 并上传 `-exe` 构件。在此 provider 下 Electron 项目（`desktop/`）会被禁用，以免与 `.exe` 构件冲突；`compile` job 产出的 Android APK 仍然是 Capacitor 的。
- **`react-native`** 和 **`ionic`** —— 是 `normalizeConfig` 中的有效值，但不会生成任何自己的内容：只留下带该名称的 `provider.json`，workflow 会像 Capacitor 一样编译它们。它们不出现在工作台中。

工作台的开关把 `capacitor`、`native`、`twa`、`gecko`、`cordova`、`flutter` 和 `tauri` 标为 `READY`（这七个都能在 CI 中编译）；`react-native` 和 `ionic` 不会出现。

## 如何更改

通过 API：

```bash
curl -X POST /api/build -H "Content-Type: application/json" \
  -d '{"appName":"Mi App","url":"https://mi-web.com","provider":"native"}'
```

ZIP 始终带 `provider.json`：

```json
{ "provider": "native", "version": "7", "webview": "Native WebView" }
```

## `capacitor` 与 `native` 的真实区别

Capacitor 带来完整的桥接（`Capacitor`、npm 插件、`BridgeActivity`），因此支持整个插件目录和 `InteeBridge`。原生 provider 有三处不同：`MainActivity` 是加载 URL 或 `file:///android_asset/public/index.html` 的自有类，运行时权限和特殊访问直接从该类调用，而且 Capacitor 的 npm 插件不存在。

如果你从 `capacitor` 切换到 `native`，请重新检查 Audit：每个 `providerOk` 不包含新 provider 的权限都会变成 `WARN`（没有声明该列表的仍为 `OK`），这会拉低 readiness，但不会阻止构建。

## 权限兼容性

Audit 会为每一行增加一列 `provider`：

- `OK (<provider>)` —— 该 provider 处于 `READY`，且该权限为其运行时声明了实现。
- `WARN (<provider> sin handler declarado para este permiso)` —— 该 provider 处于 `READY`，但该权限没有为该运行时声明 handler（APK 仍可编译）。
- `WARN (<provider> compila APK en CI, permisos por runtime de la app)` —— 针对 `flutter`、`tauri`、`react-native`、`ionic` 和 `cordova`：APK 按指定路线构建，权限由相应的运行时管理。

一个说明为何重要的具体例子：使用 `NDEFReader` 的 NFC 在 Chromium（Capacitor 和 Native）中可用，但在 Gecko 上 Audit 返回 `WARN`。

## 广告（AdMob）：现状

生成器输出的是配置，不是集成。如果你勾选 `ads` 并填写 `admobAppId`，ZIP 会包含 `admob-config.json`，清单带 `meta-data APPLICATION_ID`，`normalizeConfig` 启用 `@capacitor-community/admob` 插件。

**不会**生成的内容：`MobileAds` 初始化、`AdView`，以及插页式或激励广告代码。Audit 会明确将其返回为 `NO GENERADO (requiere AdMob App ID + SDK, no incluido)` 并按 `fail` 处理，因此勾选了 `ads` 的构建会被阻止，直到实现存在为止。

## 域名验证（assetlinks）

只要存在域名（`twaDomain` 字段、深度链接域名或你 URL 的主机名），`assetlinks.json` 就会被生成，同时也会复制到 `.well-known/assetlinks.json`。它同时适用于 App Links 和 TWA。记住上文所说：它自带的证书指纹是占位值。

更多生成的应用会暴露什么见 [security.md](./security.md)；实际编译出什么见 [outputs.md](./outputs.md)。
