# 后台音频

InteeBuild 中最常见的用例是电台、播客或直播流，希望在应用最小化且屏幕关闭时仍继续播放。本指南描述项目为此生成什么、如何测试，以及声音中断时该怎么办。

有两条路径，最好选其一：

- **原生音频（推荐）。** HTML 中只有调用 `window.InteeAudio` 的按钮；流由 `RadioService.java` 使用 `MediaPlayer` 和 `MediaSession` 播放。WebView 的行为不再重要。
- **来自 WebView 的音频。** 你的页面控制一个普通的 `<audio>` 或 `<video>`。启用 `foreground` 后，项目会在 `catalog.js` 中注入一段运行时代码：当页面隐藏时（应用最小化或屏幕关闭），它会把播放连同当前位置一起移交给 `RadioService`，页面返回时再交回 WebView。只要应用在前台，就照常由你的播放器掌控。

`radio`、`streaming` 和 `podcast` 模板会启用 `nativeAudio`。

## 最小配置

在工作台的 **Audio 100% nativo**（原生音频）卡片（Ajustes 步骤）：勾选原生播放并粘贴流地址。通过 API：

```json
{
  "appName": "Mi Radio",
  "url": "https://mi-radio.com",
  "template": "radio",
  "permissions": { "foreground": true, "wakeLock": true, "notifications": true },
  "nativeAudio": true,
  "nativeAutoplay": true,
  "streamUrl": "https://tu-servidor.com:8000/stream"
}
```

填好 `nativeAudio` 和 `streamUrl` 后，`normalizeConfig` 会强制启用 `foreground` 和 `wakeLock`，因此无需手动勾选。没有 `streamUrl` 时，readiness 返回 `canBuild: false` 并给出提示 `Audio nativo activo pero sin URL del stream`：没有地址就没有任何东西能在原生层播放，这个限制是刻意的。

## ZIP 中会出现什么

清单（可在 `main-manifest.xml` 中核对）：

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<service android:name=".RadioService"
         android:exported="false"
         android:foregroundServiceType="dataSync|mediaPlayback" />
```

文件：

- `RadioService.java` —— `inteebuild_radio` 通知渠道，`IMPORTANCE_LOW`，`startForeground(1, notificación)`，以及返回 `START_STICKY` 的 `onStartCommand`，以便系统重启它。它用 `MediaPlayer` 请求流，并发送 `Icy-MetaData: 0` 请求头，让 Shoutcast 不把元数据插入 MP3。`PARTIAL_WAKE_LOCK` 和 `WifiLock`（`WIFI_MODE_FULL_HIGH_PERF`，防止屏幕关闭时 WiFi 进入节能导致流缓冲耗尽）都在 `try/catch` 中获取：如果权限缺失，服务会继续无锁播放而不是崩溃，并在暂停或销毁时释放。在 `onCompletion` 中，只有当 URL 看起来像直播流时才重新连接；MP3 播完就停止。
- `AudioBridge.java` —— 暴露 `window.InteeAudio`，包含 `play(url)`、`playAt(url, ms)`、`pause()`、`isPlaying()`、`isActive()` 和 `keepAwake(bool)`。即使你不使用原生音频，启用 `foreground` 也会生成它，因为它是移交的目标。
- `patch-main-activity.js` 和 `patch-audio.js` —— 把服务启动和桥接注入 `MainActivity.java`。`patch-audio.js` 只处理 `MainActivity extends BridgeActivity`；在 `native` provider 中，桥接已经内置于类中，在 `gecko` 中，服务启动也已内置于 `gecko-MainActivity.java`，但桥接没有（见下方限制）。
- `www/catalog.js` —— 除目录 UI 外，还包含移交运行时（可通过 `window.__ibFg` 识别）。

workflow 日志中应出现 `--- audio service installed ---` 后跟 `1`，以及 `--- native audio installed ---`。如果看到 `0`，说明补丁没有应用：请检查 `build-config.json` 和 `permissions.foreground`。

## 页面 `<audio>` 的自动移交

勾选 `foreground` 后，`catalog.js` 的运行时会在每个页面执行以下操作（对远程 URL 同样有效，因为补丁在 `onPageFinished` 时注入）：

1. 监听 `<audio>` 和 `<video>` 的 `play`、`pause` 和 `ended`，记录 URL、位置以及是否正在播放。
2. 页面隐藏时，如果正在播放，就调用 `InteeAudio.playAt(url, posición)` 并暂停你的元素。屏幕关闭时 WebView 会冻结，但服务的 `MediaPlayer` 在 wakelock 和 WifiLock 保护下继续运行。
3. 返回时，如果服务仍处于活动状态（`isActive()`），就暂停原生播放，把元素恢复到估算位置并执行 `play()`。如果你是从通知控制中心暂停的音频，则不会恢复播放。

仍然属于你的限制：

- **`gecko` provider：没有 `InteeAudio` 桥接。** GeckoView 不暴露 `addJavascriptInterface`，因此 `AudioBridge` 无法挂到 WebView 上。`RadioService` 服务能编译并启动（钩子已内置于 `gecko-MainActivity.java`），但你的 HTML 中没有 `window.InteeAudio`：按钮会回退到网页 `<audio>`，屏幕关闭时声音会中断，因为 `catalog.js` 的移交运行时检测到没有桥接便不做任何事。要实现屏幕关闭的后台电台，请使用 `capacitor`、`native` 或 `twa`。
- `blob:` URL（hls.js、嵌入的 YouTube、任何经过 Media Source Extensions 的内容）无法交给原生层：屏幕关闭时会中断。请使用直接的流地址或原生音频。
- iframe 不会被处理。
- 如果你的 HTML 在 `visibilitychange` 中暂停，请移除该监听器：移交和你的暂停会互相冲突。

## 你的 HTML 页面


```html
<button onclick="nPlay()">Play</button>
<button onclick="nPause()">Pausa</button>
<script>
  const STREAM = 'https://tu-servidor.com:8000/stream';

  function nPlay() {
    if (window.InteeAudio) InteeAudio.play(STREAM);
    else {
      const a = document.createElement('audio');
      a.src = STREAM; a.play();
    }
  }
  function nPause() {
    if (window.InteeAudio) InteeAudio.pause();
  }
</script>
```

如果你不使用原生音频而使用页面的 `<audio>`，有四条规则几乎总是被违反：

1. `src` 使用 `https://`，除非你启用了明文 HTTP 流量。
2. 不要在 `visibilitychange`、`pagehide` 或 `blur` 中调用 `audio.pause()`。
3. 第一次 `play()` 必须来自用户点击：WebView 中自动播放是被阻止的。
4. 在 `error`、`stalled` 和 `ended` 时重连。Shoutcast 和 Icecast 流隔一段时间就会自己掉线，如果不重试，静音看起来就像应用中断了。

最简重连方案：

```html
<script>
  const a = document.getElementById('player');
  let wantPlay = false;

  document.getElementById('play').onclick = () => {
    if (a.paused) { wantPlay = true; a.load(); a.play().catch(() => {}); }
    else { wantPlay = false; a.pause(); }
  };

  ['error', 'stalled', 'suspend'].forEach(ev => a.addEventListener(ev, () => {
    if (!wantPlay) return;
    setTimeout(() => { a.load(); a.play().catch(() => {}); }, 3000);
  }));

  a.addEventListener('ended', () => {
    if (!wantPlay) return;
    a.load(); a.play().catch(() => {});
  });

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
      wantPlay = true; a.load(); a.play().catch(() => {});
    });
    navigator.mediaSession.setActionHandler('pause', () => { wantPlay = false; a.pause(); });
  }
</script>
```

## 真机测试

1. 用 Radio 模板并填好 `streamUrl` 进行编译。安装前，在 ZIP 中确认 `main-manifest.xml` 包含 `RadioService` 和 `FOREGROUND_SERVICE_MEDIA_PLAYBACK`。
2. 打开应用：应出现带 Play 按钮的通知。如果没有通知，说明服务没有启动，不要继续后续测试。
3. 点击播放并最小化：音频继续。
4. 关闭屏幕 30 秒：音频继续（`WAKE_LOCK` 加上播放器的 `PARTIAL_WAKE_LOCK`）。
5. 确认通知不会被滑除（`setOngoing(true)`），并且它的按钮和锁屏控件能控制流。

## 如果仍然中断

- **关闭屏幕时中断** —— 几乎总是 `blob:` URL（hls.js、YouTube）无法交给原生层，或者你的 HTML 在 `visibilitychange` 中暂停。使用直接 URL 且不自行暂停时，`WAKE_LOCK` 会随 `foreground` 自动带上。
- **从后台返回时中断且不会自动恢复** —— 元素被系统暂停了；点击播放即可。如果是你从通知中暂停的，那就是预期行为。
- **没有通知出现** —— 服务没有启动。检查日志中的 `servicio instalado: 1`。
- **通知可见时几分钟后中断** —— 厂商的激进电池优化。在 Settings、Apps、你的应用、Battery 中：选择无限制并允许后台活动。
- **最小化时中断且没有通知** —— 该构建不含 Foreground。用 `foreground + wakeLock + notifications` 重新编译。
- **Play 拒绝 AAB** —— 几乎总是 `ACCESS_BACKGROUND_LOCATION` 缺少理由。电台不需要它。
- **`onPermissionRequest` 授予一切** —— 旧版补丁使用了 `grant-all`；请重新生成项目。

## 相关编译错误

`androidx.media.app.NotificationCompat does not exist` 出现在用旧版 workflow 生成的 ZIP 中。该服务只使用框架类（`Notification.MediaStyle`、`MediaPlayer`、`MediaSession`），不需要 androidx 媒体依赖：重新编译并在日志中核对 `--- audio nativo instalado ---`。

如果在生成的项目中 `grep -c RadioService` 结果为 `0`，不要安装该 APK：服务不存在。如果 `grep -c InteeAudio` 结果为 `0`，说明 JS 桥接没有注入，你的按钮会回退到网页方案，而屏幕关闭时它会中断。唯一预期的例外是 `gecko` provider，那里 `InteeAudio` 不可能存在（GeckoView 不允许）；这种情况下计数为 `0` 是刻意的，移交也不会工作。

## 发布前

- 已应用 Radio 模板，并在原生音频卡片中填入你的服务器 `streamUrl`。
- `main-manifest.xml` 包含 `FOREGROUND_SERVICE_MEDIA_PLAYBACK` 和 `RadioService`。
- ZIP 中存在 `RadioService.java`、`AudioBridge.java`、`patch-audio.js`。
- Audit 中 `foreground`、`wakeLock` 和 `notifications` 状态为 `GENERATED` 且 `verified: true`。
- 页面使用 `window.InteeAudio.play(url)`。
- 流使用 `https://` 且证书有效。
- 在目标设备上通过 30 秒关屏测试。

相关权限内容见 [permissions.md](./permissions.md)；如果构建失败，见 [troubleshooting.md](./troubleshooting.md)。
