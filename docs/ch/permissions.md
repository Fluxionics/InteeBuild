# Android 权限

Permission Engine 位于 `server/generator/permissions.js`，在 `PERMISSION_SPEC` 中定义了 **86 个条目**，每个条目都有对应的清单权限、是否需要运行时对话框、它的 `minSdk`、依赖关系以及会生成的原生实现。同一个对象支撑三样东西：工作台的开关、`GET /api/permissions/spec` 和 Audit。如果明天 spec 新增一个条目，它会自动出现在 UI 中。

支撑整个系统的一条规则是：声明一个权限并不等于 Android 会授予它。因此 Audit 检查的是待编译的 ZIP，而不是配置：

1. **清单** —— `main-manifest.xml` 包含 `uses-permission` 行。
2. **运行时** —— `NativePermissions.java` 及其在 `MainActivity.java` 中的补丁会用该批次调用 `requestPermissions()`。
3. **WebView 桥接** —— `WebChromeClient.onPermissionRequest` 只有在权限既在清单中、又被授予过的情况下才执行 `grant()`；否则执行 `deny()`。

只有第一层是真正自动的。对话框是否弹出、你的网页是否正确响应，都要在真实 Android 设备上验证。

## 如何阅读 Audit

`POST /api/permissions/audit`（或工作台上的 QA 按钮）会为每个勾选的权限返回一行：

- `GENERATED OK` —— 存在于清单中且有已生成的实现。这是唯一可用于编译的状态。
- `SPEC ONLY, NOT GENERATED` —— 你请求了但没有生成。Audit 会将其标记为 `fail` 并阻止构建。
- `NO GENERADO` —— 预留给 `ads`：目前只输出配置和 AdMob 的 `meta-data`，没有 `AdView` 也没有初始化。
- `warn` —— 可以编译，但有些地方需要检查：Settings 中的特殊权限、`minSdk` 高于 `targetSdk`，或实验性 provider。
- `fail` —— 阻止构建。`gpsBackground` 却没有 `gps` 是典型情况。

每一行都带一个 `mechanism`：`runtime`（普通对话框）、`background`（两步）、`special`（从 Settings 授予）、`install-time`（安装时授予）或 `missing`。

真实层级有三个，最好不要混淆：Audit 验证项目*包含*该权限；Android 是否*授予*只能在设备上看到；功能是否*可用*只能通过实际使用功能来验证。按 Android 版本的矩阵由 `lab` 模板（Permission Test Lab）提供，它会从应用内部执行每项测试。

## 始终包含

`INTERNET`、`ACCESS_NETWORK_STATE` 和 `ACCESS_WIFI_STATE` 在所有项目中都会声明（spec 的 `internet` 条目）。没有它们网页无法加载，应用会白屏。它们不会出现在 Audit 中，因为它们不是由用户选择的。

## 通知 —— `notifications`

仅在 Android 13+ 上启用（该条目的 `minSdk`：33）；更低版本该权限不存在，系统也不会询问。生成内容：清单中的 `POST_NOTIFICATIONS`、`package.json` 中的 `@capacitor/local-notifications` 和 `@capacitor/push-notifications` 插件（勾选该复选框时工作台会自动启用它们）以及桥接方法 `Intee.notifications.schedule({title, body})`。如果你在 Ajustes 中启用了定时提醒但没有勾选该权限，清单仍会将其添加进去。

测试很直接：只勾选此选项进行编译，安装到 Android 13+，接受对话框，并用 `notifyOnOpen` 定时一条提醒。当 `targetSdk < 33` 时，Audit 返回 `warn`。

## 后台音频 —— `foreground`、`wakeLock`、`foregroundService`

这是 spec 中的三个条目，从不同角度实现同一目标：在播放音频时保持进程存活。`foreground` 添加 `FOREGROUND_SERVICE`、`FOREGROUND_SERVICE_DATA_SYNC`、`FOREGROUND_SERVICE_MEDIA_PLAYBACK` 和 `WAKE_LOCK`（没有它，`PARTIAL_WAKE_LOCK` 会抛出 `SecurityException` 并导致服务崩溃），也是三者中唯一会生成 `RadioService.java`、`AudioBridge.java` 以及在打开时启动它的 `MainActivity` 补丁的条目。`foregroundService` 声明那三行服务但不含 `WAKE_LOCK`，不过不生成任何服务：它只提供权限，仅此而已。`wakeLock` 只添加 `WAKE_LOCK`，没有对话框。如果你启用了带流地址的原生音频，引擎会自动勾选 `foreground` 和 `wakeLock`，因为进程不存活且屏幕关闭时声音会中断。spec 还提示：如果服务不是音频或同步类的，Play 会要求提供理由。

详细内容以及配套 HTML 都在 [foreground.md](./foreground.md)。

## 摄像头与麦克风 —— `cameraMic`、`microphone`

它们被刻意分开：Play 会单独审查麦克风而非摄像头，只录制视频的应用不应请求 `RECORD_AUDIO`。

- `cameraMic` 生成 `CAMERA`、`NativePermissions.request(CAMERA)` 和 `@capacitor/camera`。
- `microphone` 生成 `RECORD_AUDIO` 和 `MODIFY_AUDIO_SETTINGS`。

WebView 桥接在执行 `grant()` 之前，会用清单核对 `wants(VIDEO)`，用授权状态核对 `hasPerm(CAMERA)`。如果你没有勾选摄像头，`getUserMedia({video:true})` 会从应用内返回 `denied`：这是预期行为，不是 bug。

该组的细分项是 `cameraFlash`、`cameraAutoFocus`、`videoCapture` 和 `audioRecord`；它们共享同一个清单权限，但被分开声明，以便 Audit 能追踪你请求了什么。

## 存储 —— `storage`、`readExternalStorage`、`writeExternalStorage`、`manageExternalStorage`

当 `targetSdk` 为 33 或更高时，`storage` 生成 `READ_MEDIA_IMAGES`、`READ_MEDIA_VIDEO` 和 `READ_MEDIA_AUDIO`，并省略 `READ_EXTERNAL_STORAGE` 以免在 Play 上触发警告。当 `targetSdk` 较低时，则回退到旧版权限。`manageExternalStorage`（`MANAGE_EXTERNAL_STORAGE`，API 30+）是"所有文件"权限，通过 Settings 授予，而不是通过对话框。

测试方法：一个 `<input type="file" accept="image/*">` 应该能打开相册，从你的网页发起的下载应该出现在下载管理器中。

## 位置 —— `gps`、`gpsBackground` 及细分项

`gps` 声明 `ACCESS_FINE_LOCATION` 和 `ACCESS_COARSE_LOCATION`，不涉及后台。`gpsBackground` 声明 `ACCESS_BACKGROUND_LOCATION`，它被刻意设为独立条目：在 Android 11+ 上，如果后台请求与前台请求在同一批次中，系统会忽略它，因此运行时会分两步请求（授予前台之后调用 `requestBackground()`）。

如果你勾选了后台却没有前台，Audit 返回 `fail`。Play 还要求提供演示应用在关闭状态下追踪位置的视频理由；对于商店、博客和电台类应用，永远不要勾选它。

细分项 `accessFineLocation`、`accessCoarseLocation` 和 `accessBackgroundLocation` 是为追求最高粒度的用户准备的，`advGeo` 增加基于 `FusedLocationProvider` 的追踪和地理围栏（需要在 Play 提供理由）。

## 蓝牙 —— `bluetoothScan`、`bluetoothConnect`、`bluetoothAdvertise`、`bluetooth`

在 Android 12+ 上它们是三个不同的权限，工作台将其呈现为三个开关：扫描（`BLUETOOTH_SCAN`）、连接（`BLUETOOTH_CONNECT`）和广播（`BLUETOOTH_ADVERTISE`），`minSdk` 均为 31。

`bluetooth` 是旧版条目（`BLUETOOTH` + `BLUETOOTH_ADMIN`），有效至 API 30。如果你在 `targetSdk` 31 或更高时勾选它，`normalizeConfig` 会自动启用 `bluetoothScan` 和 `bluetoothConnect`，而不是留下一个无效权限。`bluetoothPrivileged` 属于系统应用，在普通应用中无效。

## 精确闹钟 —— 二选一

针对两个真实权限共有五个条目，同一时间只能勾选一个：

- `alarmSchedule` → `SCHEDULE_EXACT_ALARM`。推荐使用：用户可以从 Settings 撤销它。
- `alarmUse` → `USE_EXACT_ALARM`，仅用于时钟、闹钟或日历。Play 会人工审核。
- `scheduleExactAlarm` 和 `useExactAlarm` 是上述两个的细分项。
- `alarm` 是旧版选择器；`normalizeConfig` 会将其转换为 `scheduleExactAlarm`。

Audit 会把它们解析为 `special`（通过 Settings 授予），而 `SpecialAccess.java` 系统只在你勾选了其中之一时才生成。

## 电话与短信 —— Play 上的受限权限

`phone` 包含 `CALL_PHONE`、`READ_PHONE_STATE` 和 `READ_CALL_LOG`；`sms` 包含 `SEND_SMS` 和 `READ_SMS`。细分项为 `callPhone`、`answerPhone`、`readPhoneState`、`readPhoneNumber`、`readCallLog`、`processOutgoingCalls`、`sendSms`、`readSms`、`receiveSms` 和 `receiveMms`。

它们在 spec 中都带有 `Play Store restringido` 警告。编译没有问题，但 Play 只接受类别为标记或消息传递类的应用。如果你的应用不属于这两类，就不要勾选。

## 联系人、日历与传感器

`contacts` 和 `calendar` 是读写组合包；它们的细分项是 `readContacts`、`writeContacts`、`readCalendar` 和 `writeCalendar`。

`sensors` 覆盖 `BODY_SENSORS` 和 `HIGH_SAMPLING_RATE_SENSORS`；细分项是 `bodySensors`（运行时）和 `highSamplingRateSensors`（安装时，API 31+）。`activityRecognition` 需要 API 29+，`envSensors`（Droncito）增加加速度计、陀螺仪、气压计、光线和接近传感器，使用 API 29 权限。

## 网络、账户与 WiFi

`nearby` 和 `nearbyWifiDevices` 是同一个开关（`NEARBY_WIFI_DEVICES`，API 33）的两个不同选择器。`changeWifiState` 和 `changeNetworkState` 在安装时授予。`getAccounts`（`GET_ACCOUNTS`）在 Play 上被标记为受限。

## 特殊访问（不是对话框）

- `systemAlert` / `systemAlertWindow` → `SYSTEM_ALERT_WINDOW`，通过 `Settings.ACTION_MANAGE_OVERLAY_PERMISSION` 授予。
- `installPackages` / `requestInstallPackages` → `REQUEST_INSTALL_PACKAGES`，配合 `canRequestPackageInstalls`。
- `powerMgmt` → `WAKE_LOCK` 加上 `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`，它会打开 Settings 以便把应用移出电池优化。

即使清单正确，Audit 也会把它们标记为带 `special` 的 `warn`。这是预期的：用户必须手动授予该权限。

## 目录其余部分

- `nfc` —— 无对话框的 `NFC`，加上 `uses-feature`，勾选时还有带 `nfc_tech_filter.xml` 的 `TECH_DISCOVERED` 过滤器。
- `vibration` / `vibrate` —— `VIBRATE`，安装时授予。两个选择器指向同一权限。
- `biometric`（`USE_BIOMETRIC`，API 28+）和 `fingerprint`（`USE_FINGERPRINT`，至 API 27）：勾选旧版会启用 `biometric`。
- `infrared` —— `TRANSMIT_IR`，仅在带红外的设备上有效。
- `ads` —— 仅 AdMob 配置：清单包含 `meta-data APPLICATION_ID` 和插件，但没有广告代码。Audit 将其返回为 NO GENERADO 并阻止选择它的构建。
- `foregroundService` —— 与 `foreground` 相同的三个清单权限，但不含服务。
- `internet` —— 基础网络条目（`INTERNET`、`ACCESS_NETWORK_STATE`、`ACCESS_WIFI_STATE`）：无论是否勾选此框，所有项目都会包含它。

## Droncito Pack

Droncito Pack 是 **18 个 spec 条目**（`ar`、`voiceRec`、`envSensors`、`aiSuite`、`powerMgmt`、`adaptiveNotif`、`advSecurity`、`dynamicUI`、`socialAnalytics`、`advGeo`、`dataAnalytics`、`vr`、`blockchain`、`rpa`、`vulnScan`、`emoAI`、`iot`、`mr`），它们会解析为通过补丁注入的单个文件 `DroncitoBridge.java`，并由 `patch-droncito-gradle.js` 在需要时添加 Gradle 依赖（ARCore、ML Kit、SceneView、GVR）。在网页中通过 `Intee.ar.*`、`Intee.voice.*`、`Intee.ai.*`、`Intee.chain.*`、`Intee.iot.*` 等方式使用。

spec 自身记录了三条警告：`ar`、`vr` 和 `mr` 会明显增加 APK 体积（ARCore/GVR）且只在兼容设备上可用；`blockchain` 会把密钥保存在 Android Keystore 中，最好先在测试网验证；`iot` 会在你勾选的内容之上额外添加蓝牙和定位。

## 运行时内部原理

1. `NativePermissions.java` 生成时会带一个 `BATCH[]` 数组，恰好包含你的运行时权限：不含后台，不含 `MANAGE_EXTERNAL_STORAGE`。`requestAll()` 只请求已声明且未授予的权限。
2. `ACCESS_BACKGROUND_LOCATION` 分两步进行：`requestBackground()` 只在授予前台之后调用。
3. `SpecialAccess.java` 为悬浮窗、安装器、精确闹钟和存储管理打开 Settings。仅在你请求时才生成。
4. `patch-permissions.js` 注入 `onPermissionRequest`，实现选择性授权（VIDEO 给摄像头、AUDIO 给麦克风、GEO 给位置），默认 `deny()`。
5. 清单为摄像头、蓝牙 LE、GPS、NFC 和麦克风声明 `uses-feature ... required="false"`，并且只在需要时添加 NFC 过滤器。
6. workflow 日志中会出现 `permisos nativos instalados`、`accesos especiales instalados` 和 `filtro NFC instalado`。

## 推荐测试顺序

每次构建只测试一个权限，按此顺序：

1. 只带 `INTERNET` 的最小 HTML：安装、打开，确认它不请求任何东西。
2. 摄像头：`getUserMedia({video:true})` 应触发对话框。
3. GPS：`navigator.geolocation.getCurrentPosition` 应请求位置。
4. Android 13+ 上的通知：打开时应询问。
5. Bluetooth Scan + Connect：`navigator.bluetooth.requestDevice()` 应请求蓝牙。

如果某个构建请求了你没有勾选的内容，说明引擎多加了东西：请带上 `build-config.json` 和 Audit 结果开一个 issue。

## 构建之后

两个端点用于发布前检查：

- `POST /api/manifest-diff` 将请求的内容与生成的内容进行对比，按权限返回 `MATCH` 或 `MISSING`，以及意外出现的权限。
- `POST /api/inspect`（APK 最大 30 MB）返回带评分的包信息。

上传到 Play 之前最好把这两个都跑一遍。其余流程见 [production.md](./production.md)，常见错误见 [troubleshooting.md](./troubleshooting.md)。
