# 构建的输出产物

经典的 `outputType` 仍接受三个值：`apk`、`aab` 和 `both`。在其之上是 `outputs`，一个列表（也接受逗号分隔的文本），它优先于前者：`apk`、`aab`、`xapk`、`apks`、`ipa`、`exe`、`msi`、`dmg`、`appimage`。workflow 中每个格式都有一个由该列表决定是否执行的步骤，因此只会运行你请求的那一个；而 `platform` 字段（`android`、`ios` 或 `both`）决定是启动 Android 作业、iOS 作业还是两者都启动。当 `platform` 为 `ios` 或 `both` 时，ZIP 中的 `package.json` 会包含 `@capacitor/ios`，以使 `npx cap add ios` 步骤不会因 "Could not find the ios platform" 而失败。`GET /api/v1/build/:id` 返回的字段包含 `outputs` 和 `formats`，后者是产物实际确认存在的格式。

## 构建完成后你下载到的内容

每个格式在 `GET /api/download/:id/:fmt` 都有对应路径；不带后缀时默认为 APK。

- **APK** — `GET /api/download/:id`（或 `.../apk`）。可直接安装到设备上。当 provider 为 `flutter` 时由作业 `flutter-build` 生成；为 `cordova` 时由作业 `cordova-build` 生成；而不是 Capacitor 的作业。
- **AAB** — `GET /api/download/:id/aab`。Play Console 上传所需的格式。只有当你在 `outputs` 中请求了它才会出现。当 provider 为 `flutter` 时由作业 `flutter-build` 产出；为 `cordova` 时会尝试使用 `--packageType=bundle`（如果所用版本的 cordova-android 在 debug 模式下不支持，该步骤不会阻塞，也不会产生 AAB）。
- **XAPK** — `GET /api/download/:id/xapk`。基础 APK 加上包含包名、版本和权限的 `AndroidManifest.json`。仅在你请求了 `xapk` 时生成。
- **APKS** — `GET /api/download/:id/apks`。由 AAB 生成的通用模式 Bundletool 产物。仅在你请求了 `apks` 时生成。
- **IPA** — `GET /api/download/:id/ipa`。只有当构建在 `macos-latest` 上运行，且在 iOS 签名步骤中发送了 `.p12`、`.mobileprovision` 和密码时才存在。否则不会有产物，该端点返回错误。
- **EXE 与 MSI** — `GET /api/download/:id/exe` 和 `.../msi`。Electron 的 EXE：在 `windows-latest` 上运行 `electron-builder` 的作业，只有当你请求了该格式且 ZIP 中包含 `desktop/` 时才会运行。Tauri 的 EXE：如果 provider 是 `tauri`，作业 `tauri-build` 会把 Cargo 二进制文件作为 `-exe` 产物上传，即使你没有请求桌面格式。MSI：仅来自 Electron。
- **DMG** — `GET /api/download/:id/dmg`。`macos-latest` 上的作业，条件与 EXE 相同。
- **AppImage** — `GET /api/download/:id/appimage`。`ubuntu-latest` 上的作业，条件相同。

不在上面列表中的格式会返回 `404`，并附上受支持的格式列表。产物存放在 GitHub Actions 中，30 分钟后过期；服务器也会在自动清理中删除它们。历史记录（`GET /api/history`）会在本地条目有效期内保留链接。

此外，项目的 ZIP 可以通过 `POST /api/project` 在不编译的情况下获取，并包含任意配置：其中有 `build-config.json`、`main-manifest.xml`、生成的 Java 代码、补丁脚本和 workflow。

## ZIP 中仅作为源代码存在的内容

- **Desktop** — 如果你启用 `desktopEnabled`，**或在 `outputs` 中请求了 `exe`、`msi`、`dmg` 或 `appimage`**（在这种情况下引擎会自动启用 `desktopEnabled`），就会出现 `desktop/` 目录，其中是一个 Electron 项目（`package.json`、`main.js`、README），并且工作台中的 "Desktop .EXE/.APP" 选择器会写入该文件夹。要生成二进制文件，必须在 `outputs` 中请求 `exe`、`msi`、`dmg` 或 `appimage`：这样 workflow 会根据格式在 Windows、macOS 或 Linux 上启动 `electron-builder`。`desktopPlatform`（`win`、`mac`、`both`）会被校验、保存到 `build-config.json`，并由 `desktop/package.json` 的生成器用来设定 `electron-builder` 的 targets。
- **TWA** — `twa-manifest.json`、`assetlinks.json` 以及包含 bubblewrap 命令的 README。真正的 Trusted Web Activity 需要在外部用你自己的工具构建。
- **`react-native` 和 `ionic`** — 除了 `provider.json` 之外不会生成任何东西；产出的 APK 是 Capacitor 的 APK。
## CI 中的 Flutter、Tauri 和 Cordova

- **Flutter**（`provider: flutter`）— `ubuntu-latest` 上的作业 `flutter-build` 会执行 `flutter create` 生成 Android 宿主，然后放入你的清单文件，把 `applicationId`/`namespace` 修正为你的包名，移动 `MainActivity.kt`，最后用 `flutter build apk --release` 编译（如果你请求了 `aab`，还会执行 `appbundle`）。产物：`-apk`，以及可选的 `-aab`。在此 provider 下 Capacitor 的 `compile` 作业会被跳过，因此不会出现重复的 APK。

- **Tauri**（`provider: tauri`）— `windows-latest` 上的作业 `tauri-build` 会运行 `cargo build --release --manifest-path tauri/src-tauri/Cargo.toml`，并把二进制文件作为 `-exe` 产物上传。使用此 provider 时 Electron 项目（`desktop/`）会被排除，以避免产物名称冲突；Android APK 仍由 `compile` 作业产出（底层依然是 Capacitor）。

- **Cordova**（`provider: cordova`）— `ubuntu-latest` 上的作业 `cordova-build` 会基于你真实的 `config.xml` 运行 `cordova platform add android`，把 `main-manifest.xml` 中的权限注入 Cordova 清单，将图标复制到 `mipmap-*`，然后执行 `cordova build android`（debug 产物 `-apk`；可选的 `-aab` 使用 `continue-on-error`；如果你上传了 keystore，则通过 `build.json` 生成 `-release-apk`）。在此 provider 下 Capacitor 的 `compile` 作业会被跳过：APK 完全由 Cordova 生成。

workflow 通过 input（`provider`）接收 provider，服务器在 `workflow_dispatch` 中会把它与 `id`、`platform` 和 `outputs` 一起发送。

## 项目中的 PWA

启用 `pwaEnabled`（默认启用）后，ZIP 会包含 `www/manifest.webmanifest`（含名称、颜色和图标）以及 `www/sw.js`（含离线缓存和回退到 `index.html`）。service worker 的注册代码和 `manifest` 标签会注入到你的 `index.html` 中（如果原本没有）。

为此你不需要把任何东西托管在 InteeBuild：把 `www/` 文件夹上传到你的主机，网站本身即可作为 PWA 安装。如果你的站点已经自带 manifest，请用 `pwaEnabled: false` 关闭它。

## Play Store 商品页信息

`POST /api/listing` 返回可直接粘贴到 Play Console 的文本，由本地规则生成，不依赖任何外部服务：

```bash
curl -X POST /api/listing -H "Content-Type: application/json" \
  -d '{"appName":"Mi Radio","url":"https://mi-radio.com","packageName":"com.miempresa.radio","permissions":{"foreground":true}}'
```

响应包含 `title`（截断至 30 个字符）、`shortDescription`（80）、`fullDescription`（最多 4000，其中的功能描述根据你的权限和 UI 标志推导）、`keywords`（100）、`category`（`Herramientas`）、`packageName` 和 `version`。这只是一份草稿：发布前最好重写一遍。

还有 `POST /api/security-audit`（文本形式的评分，包含 GDPR 和权限相关问题）以及 `GET /api/privacy-policy?appName=&package=`（用你的数据填写的通用隐私政策）。

## 下载二维码

`GET /api/qr/:id` 返回一张包含下载链接二维码的 PNG 图片。图片由外部服务（`api.qrserver.com`）生成；如果它在 8 秒内没有响应，端点会返回 `502`，并附上文本形式的下载链接，以便你自己展示。

## 压缩

`minify` 选项（或 API 中的 `minify: true`）会移除注入代码中的 HTML 注释和多余空白。它不会改动你的 JavaScript，也不是生产级压缩器：只是让内嵌的 HTML 体积更小。

## 没有的功能

没有 Apple 证书就无法完成 iOS 构建（该作业仅在模拟器上验证；提供 `.p12` 和 `.mobileprovision` 后才能导出 IPA），没有自有商店或分发渠道，这一切背后也没有任何付费计划。存在的是服务器的使用限制：每个 IP 每小时 10 次构建，以及 [production.md](./production.md) 中详述的输入大小限制。
