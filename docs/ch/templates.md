# 模板

InteeBuild 自带 29 个模板。它们不是装饰性的预设：每个模板都定义了一套完整且经过验证的配置，让你可以一次构建成功。它们按家族分布在 `server/templates/` 目录下（`core`、`media`、`commerce`、`location`、`social`、`wellness`、`secure`），并在 `server/templates/index.js` 中汇总。

模板只提供默认值。Permission Engine 会自动补全权限所需的插件，并且 Audit 必须返回 `canBuild: true` 才会启动构建。

## 模板如何被应用

`applyTemplate` 以模板配置为基础进行合并，然后把用户的值覆盖上去：你填写的内容优先。`permissions` 和 `plugins` 对象会按权限逐项合并，因此你可以额外勾选一个而不丢失模板自带的权限。

当你向 `POST /api/build` 或 `POST /api/v1/build` 发送 `template` 时，也会发生同样的合并。如果不发送模板，配置就完全来自你在 `normalizeConfig` 中提交的内容。

## 各家族的内容

**`core`** —— web、pwa、blog、portafolio、news、dashboard、empresa、edu。

- `web` 是最小基础：除 INTERNET 外没有其他权限，带下拉刷新、离线页面和下载功能。
- `pwa` 增加 `notifications` 和 `storage`，并启用 `webManifest` 和 `serviceWorker`，从而生成可安装的 PWA。
- `blog` 和 `portafolio` 增加通知和阅读功能；`news` 另外把屏幕方向限制为竖屏。
- `dashboard` 只保留通知；`empresa` 增加生物识别、`flagSecure` 和 `outputType: aab` 用于 Play Store；`edu` 增加摄像头和麦克风。

**`media`** —— radio、streaming、podcast、ai、game。

- `radio` 启用 `nativeAudio`、`nativeAutoplay`、`mediaSession` 和 `audioFocus`，权限为 `foreground`、`wakeLock` 和 `notifications`，并带离线页面，提示语为 "Sin conexión. El stream necesita internet."。
- `streaming` 使用 `nativeAudio`，配合传感器方向和 `keepScreenOn`。
- `podcast` 增加 `storage` 用于下载，以及 `mediaSession` 用于媒体控制。
- `ai` 启用麦克风和摄像头以进行语音识别。
- `game` 为横屏、全屏，带震动、`wakeLock` 和 `keepScreenOn`。

**`commerce`** —— ecommerce、marketplace、food、realestate。全部带摄像头用于拍摄商品照片、GPS 和存储；`marketplace` 和 `food` 增加通知，`realestate` 增加 `phone` 用于直接拨打电话。

**`location`** —— maps、travel、delivery、eventos。

- `maps` 是最小可行方案：只要前台 GPS，别无其他。
- `travel` 组合 GPS、摄像头、存储和旅行提醒。
- `delivery` 增加 `gpsBackground`、`keepScreenOn` 和用于交付凭证的摄像头。
- `eventos` 覆盖扫描二维码的摄像头和定位场地的 GPS。

**`social`** —— comunidad 和 social。两者都需要摄像头、存储和通知；`social` 额外增加 GPS 用于对帖子进行地理定位。

**`wellness`** —— salud 和 fitness。两者都使用 `sensors` 和 `activityRecognition`；`fitness` 增加 GPS、`wakeLock` 和 `keepScreenOn`。

**`secure`** —— finanzas、banking、emergency、lab。

- `finanzas` 和 `banking` 共享 `biometric` + `notifications`、`flagSecure`、`blockSelection` 和 `outputType: aab`；`banking` 增加 `screenCaptureSecurity`。
- `emergency` 带后台 GPS、用于自动拨号的 `phone`、摄像头以及用于提醒的 `highPriority`。
- `lab`（Permission Test Lab）一次请求十个权限，它的示例页面会在设备上执行每项测试并报告真实结果。

带有 `outputType: aab` 的三个是 `empresa`、`finanzas` 和 `banking`，专为直接上传到 Play Console 而设计。其余生成 APK。

## 示例页面

每个模板都可以带一个 `faceHtml`，即一个 HTML 示例页面。例如 radio 的页面有两个按钮，调用 `InteeAudio.play()` 和 `InteeAudio.pause()`，如果原生桥接不存在则回退到浏览器的 `<audio>`。该页面不会单独保存：应用模板时，工作台会把它写入 HTML 字段并把来源切换为 HTML。如果编辑器原本为空，它会自动执行；如果你已有自己的代码，它会先询问是否替换（你也可以随时用编辑器的页面按钮切回示例页面）。如果你更想用自己的 URL，请不要改动示例页面，之后再把来源改回 URL 即可。

你可以通过 API 查看示例页面：

```bash
curl /api/templates            # lista con id, name, description y audit resumido
curl /api/templates/radio      # config completa + faceHtml
```

`/api/templates` 的列表会使用一个安全名称和 `https://example.com` 对每个模板运行 Audit，并返回 `ok`、`total`、`readiness` 和 `canBuild`。如果某个模板开始返回 `canBuild: false`，你无需编译任何东西就能在这里看到。

## 原生检查

`GET /api/templates/:id/native` 会在内存中生成该模板的真实文件，并返回清单、文件列表、包含的 `.java` 和 `.xml`、是否包含 `NativePermissions.java`、是否包含 `RadioService.java`、是否包含目录补丁、`provider.json` 以及 audit。当 audit 验证全部通过并允许编译时，`native100` 字段为 `true`。这是在不请求构建的情况下快速查看每个模板将产出什么的方式。

## 前台服务与音频

只有三个模板请求 `foreground`：`radio`、`streaming` 和 `podcast`。`wakeLock` 出现在这三者以及 `game`、`fitness` 中，`keepScreenOn` 出现在 `streaming`、`game`、`delivery`、`fitness` 和 `emergency` 中。`delivery` 不请求 `foreground`：它的后台由 `gpsBackground` 解决，那是另一个权限、另一套清单。**此外，当 `foreground` 存在时，`wifiLock`（`WIFI_MODE_FULL_HIGH_PERF`）会自动为 `radio`、`streaming` 和 `podcast` 生成，以避免屏幕关闭时 WiFi 节能导致音频中断。** 这段代码为何存在以及如何测试，详见 [foreground.md](./foreground.md)。

## 自定义

加载模板后，你可以在高级模式下修改任意内容：单个权限、插件、SDK、屏幕方向、颜色、启动页和深度链接。如果你只想改两三项，直接用 `template: "radio"` 叠加那些字段即可：无需重复模板已有的内容。

每个模板的真实配置位于 `server/templates/*.js`，所以如果你缺少某个用例，可以用相同格式在那里添加，它会出现在 `GET /api/templates` 中。
