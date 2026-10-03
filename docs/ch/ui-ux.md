# 应用界面与体验

本指南涵盖你在工作台 Ajustes（设置）步骤中控制的外观和行为字段。它们都属于生成配置：你在这里勾选的内容最终会出现在清单、`capacitor.config.json`、`colors.xml` 或注入到你 HTML 中的脚本里。

要弄清某个字段的作用，规则很简单：如果它没有出现在本列表中，或者被标记为无效，请用 `POST /api/project` 验证并查看 ZIP，不要想当然。

## 样式与外观

**主题（`appTheme`）** —— `system`（默认）、`light` 或 `dark`。选择状态栏使用浅色还是深色样式：当 StatusBar 插件激活或处于 edge-to-edge 模式时，如果主题为深色，`capacitor.config.json` 中的 `StatusBar.style` 为 `DARK`，否则为 `LIGHT`。它不会改变你自身网页的颜色。

**入场动画（`entryAnimation`）** —— `none`（默认）、`fade` 或 `slide`。它会保存到 `build-config.json`，但目前生成器的任何补丁都不会应用它：这是一个被记录但不会转化为代码的值。

**强调色（`accentColor`）** —— 默认 `#4f46e5`。修改后，ZIP 会包含带 `colorPrimary` 和 `colorAccent` 的 `custom-colors.xml`；workflow 会把该文件复制到 `res/values/colors.xml`。同一个颜色也用作 PWA manifest 的 `theme_color` 以及注入脚本的强调色。

**状态栏颜色（`statusBarColor`）** —— 默认 `#ffffff`。它会写入同一个 `custom-colors.xml` 的 `colorPrimaryDark`，并在 StatusBar 插件激活时写入 `StatusBar.backgroundColor`。

**导航栏颜色（`navigationBarColor`）** —— 默认 `#ffffff`。它只用于决定是否生成 `custom-colors.xml`，但不会以该颜色写入任何值：该文件只包含 `colorPrimary`、`colorPrimaryDark` 和 `colorAccent`。

这三个颜色只有在某个偏离其默认值时才会生成该文件；出厂配置下 ZIP 中不会出现它。

**edge-to-edge 设计（`edgeToEdge`）** —— 在 StatusBar 插件中启用 `overlaysWebView`，使你的内容绘制在系统栏下方。配合 `statusBarColor` 可以决定后面显示什么颜色。

## 屏幕行为

**屏幕方向（`orientation`）** —— `any`（默认）、`portrait`、`landscape` 或 `sensor`。作为 `screenOrientation` 写入清单。

**全屏（`fullscreen`）** —— 隐藏顶部状态栏，并让启动页变为沉浸式。

**保持屏幕常亮（`keepScreenOn`）** —— 为活动添加 `android:keepScreenOn="true"`。适用于视频、游戏和直播；`streaming`、`game`、`delivery`、`fitness` 和 `emergency` 会带此设置。

**明文流量（`useCleartext`）** —— 默认启用。在清单中设置 `android:usesCleartextTraffic="true"`，在 `capacitor.config.json` 中设置 `server.cleartext` 和 `android.allowMixedContent`，并在你的 URL 为 `http://` 时把 `androidScheme` 固定为 `http`。如果你禁用它而来源又是 `http://`，应用将无法加载任何内容。

## 启动页

`splashEnabled` 会把 `SplashScreen` 配置写入 `capacitor.config.json`，包含 `launchAutoHide: true`、时长和背景色。`splashDuration` 接受 500 到 5000 毫秒，默认 2000。`splashColor` 还会被复用为 PWA manifest 的 `background_color`。

没有启动页图片字段：背景是纯色的，图标由系统提供。`radio` 系列模板会禁用启动页，让应用直接打开。

## 深度链接

`deepLinksEnabled` 配合 `deepLinkDomain` 会向清单添加带 `autoVerify` 的 `intent-filter`，该域名也用于生成 `assetlinks.json` 和 `.well-known/assetlinks.json`。`deepLinkPaths` 最多接受十条路径。该文件必须挂在你的域名下 App Links 才能工作：它自带的证书指纹是占位值，必须替换（更多细节见 [providers.md](./providers.md)）。

## WebView 设置

**返回键行为（`backButtonBehavior`）** —— `back`（默认）在历史中后退，没有更多历史时退出；`exit` 调用 `finishAffinity()`；`confirm` 显示对话框 "¿Deseas salir de la app?"；`none` 什么都不做。补丁会把它写到 `MainActivity` 上。

**自定义 User-Agent（`userAgent`）** —— 字段存在，但如果你填写了，只会激活 `capacitor.config.json` 中的 `webContentsDebuggingEnabled: false`。它不会改变 WebView 的 UA：不要指望用它把自己的应用伪装成别的浏览器。

**缓存模式（`cacheMode`）** —— `normal`、`no-cache` 或 `force-cache`。会被规范化并保存，但不会传到任何生成器：不改变应用行为。

**自定义 HTTP 头（`customHeaders`）** —— 情况相同：会被接受并裁剪，对生成没有影响。

**JavaScript 注入（`jsInjection`）与样式注入（`cssInjection`）** —— 如果你填写了，ZIP 会包含带相应内容的 `www/inject.js` 和 `www/inject.css`。它们不会自动加入你的 HTML：你的页面需要用 `<script src="inject.js">` 和 `<link rel="stylesheet" href="inject.css">` 引用它们。

**HTML 压缩（`minify`）** —— 移除生成 HTML 中的注释和多余空白，以及 `catalog.js` 中的注释。它不会动你的 JavaScript，也不是生产级压缩器。

## 定时提醒

`notifyOnOpen`、`notifyOnClose` 和 `notifyDelayMinutes` 配合 `notifyTitle` 和 `notifyText` 会生成一个使用 `LocalNotifications` 的脚本，在打开时、转入后台时或经过指定分钟后安排提醒。两个条件：只有来源为 HTML 时才注入，并且需要启用通知插件。

"通知渠道"区块（`notifChannel`、`notifImportance`、`notifSound`、`notifVibration`）在工作台中有字段，但这四个值在生成时都不被使用：无论是 `RadioService` 的渠道还是定时提醒都不会读取它们。音频服务的渠道名为 `inteebuild_radio`，重要性为低，且是固定的。

## 注入到你网页中的功能

Ajustes 步骤有一个目录区块，其中的功能会被写入 `catalog.js`，并在 WebView 中针对你自己的页面执行：

- **Pull-to-refresh（下拉刷新）** —— 滚动到顶部后继续下拉会重新加载页面。
- **Offline screen（离线页面）** —— 带 `offlineMessage`（默认 "Sin conexión. Revisa tu internet."）和重试按钮的固定图层。由 `offlineScreen` 启用，除 `lab` 外默认开启。
- **Loading indicator（加载指示器）** —— `spinner`（居中图层）、`bar`（顶部 3 像素进度条）或 `none`。
- **侧边抽屉**（`drawerEnabled`） —— 左上角的固定按钮，点击打开带 `drawerItems` 的面板：最多八个 JSON 对象 `{label, url, icon}`。
- **底部导航**（`bottomNavEnabled`） —— 底部栏，最多五个 `{label, url, icon}`，body 自动带 `padding-bottom`。
- **DownloadManager** —— 使用原生下载而不是交给 WebView。
- **选择锁定**（`blockSelection`） —— `user-select: none` 的 CSS（文本字段除外）并阻止右键菜单。
- **Root/越狱检测**（`rootDetection`） —— 在 `MainActivity` 上打 `RootCheck` 补丁。
- **Encrypted Storage** —— 添加 `capacitor-secure-storage-plugin` 和 `USE_BIOMETRIC` 权限。

`flagSecure` 不走这里：它在 Java 中、在 `MainActivity` 上应用。

如果你的 HTML 说了算，请记住目录脚本是在你的代码之后注入到 `</body>` 中的，并且 viewport 和 charset 只在来源为 HTML 时才保证。如果你加载的是 URL，需要由你的站点自己提供 viewport。

## 无障碍与性能

这些生成器都不会替你做；这是你 HTML 的工作：

- `meta viewport` 只在 HTML 模式注入。如果你的来源是 URL，请在你的站点添加。
- 文字对比度至少 4.5:1，大号文字 3:1。
- 触摸目标 48 dp 或更大。
- 图片使用描述性的 `alt`。分析器的 Auto-Fix 会填 `alt=""`，那不算描述。
- 图片和资源使用 `defer` 或 `async` 延迟加载。分析器会将其标记在 `optimization` 中。

## 如何核对改动

```bash
curl -X POST /api/project -H "Content-Type: application/json" -d '{"appName":"Mi App","url":"https://mi-web.com","accentColor":"#112233","entryAnimation":"fade","orientation":"portrait"}' -o proyecto.zip
unzip -p proyecto.zip capacitor.config.json
unzip -p proyecto.zip main-manifest.xml | grep -E "screenOrientation|keepScreenOn|cleartext"
unzip -p proyecto.zip www/index.html | tail -5
```

最后一行显示附加在你的 HTML 末尾的目录脚本。如果 `entryAnimation` 在任何地方都不出现，就说明它没有被应用，你已经确认了。

更多权限内容见 [permissions.md](./permissions.md)，每次构建实际编译出什么见 [outputs.md](./outputs.md)，分析器见 [analyzer.md](./analyzer.md)。
