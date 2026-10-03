# Decompiler：从 APK 中恢复配置

上传一个 APK，即可从中提取包名、权限、清单以及包含其内容的 ZIP。可以从工作台的“编译”步骤（`Descompilador APK`）或通过 API 使用。有两种作用范围不同的模式：本地模式，在浏览器和服务器上处理 AXML 和 DEX；云端模式，在 GitHub Actions 上运行 jadx 和 apktool，返回真正的 Java 代码。

本地模式即时完成，不需要 GitHub。云端模式需要一到三分钟，并且需要与构建相同的 `GITHUB_TOKEN` 和 `INTEE_BUILDS_REPO`。

## 本地模式

```bash
curl -X POST /api/decompile -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
```

它也接受把 APK 作为 `application/octet-stream` 请求体，或使用 `buffer` 字段。最小 100 字节，最大 100 MB。全部在服务器上处理，二进制文件不会接触任何外部服务。

响应如下：

```json
{
  "ok": true,
  "meta": { "packageName": "com.example.app", "appName": "Mi App", "permissions": ["android.permission.CAMERA"], "hasIcon": true, "hasDex": true, "fileCount": 120, "versionName": "1.0.0", "sizeKB": 2048 },
  "axml": { "binary": true, "package": "com.example.app", "permissions": [], "minSdk": 23, "targetSdk": 35 },
  "dex": { "classCount": 900, "methodCount": 5200, "libs": ["capacitor"], "hasCapacitor": true },
  "entries": ["AndroidManifest.xml", "classes.dex", "res/…"],
  "manifestPreview": "<manifest …>…",
  "importConfig": { "appName": "…", "packageName": "…", "url": "https://example.com", "permissions": {} },
  "sourceZipBase64": "UEs…",
  "sourceZipSizeKB": 450,
  "note": "APK real: AXML decodificado (9 permisos) + DEX (900 clases, libs: capacitor) + importConfig con keys reales + ZIP fuente"
}
```

`note` 以文字说明恢复到了什么，内容因情况而异：

- InteeBuild 的 APK：在其中找到 `build-config.json` 并原样作为 `importConfig` 返回。这是能 100% 恢复的情况。
- 普通 APK：解码 AXML 清单，如果存在则读取 `capacitor.config.json`、`www/index.html` 或 `assets/www/index.html`，并解析最多五个 `classes*.dex` 文件以检测库（Capacitor、Droncito、ARCore、MLKit、web3j、MQTT、GVR、Firebase、AdMob）。`importConfig` 由读取到的内容拼装，URL 填入 `https://example.com`。
- 通用 ZIP：列出文件并打包现有内容。

源码 ZIP 中包含小于 4 MB 的文件，另加 `DECODED-AndroidManifest.xml` 以及记录提取内容的 `decompiler-axml.json` 和 `decompiler-dex.json`。体积超过限制的文件会被排除，以免拖垮浏览器。

`manifestPreview` 包含前 8,000 个字符；如果清单是二进制且没有可读字符串，则返回一条提示，数据位于 `axml.permissions` 中。

## 云端模式（jadx + apktool）

```bash
curl -X POST /api/decompile/cloud -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
# → 202 {"ok":true,"id":"ab12cd34","branch":"decompile-ab12cd34","tools":"jadx 1.5.1 + apktool 2.9.3","statusUrl":"…","downloadUrl":"…"}
```

APK 会作为 `input/app.apk` 上传到构建仓库的临时分支 `decompile-<id>`，使用 workflow `decompile-app.yml`。该 workflow 运行 jadx 1.5.1 生成 Java 源码，运行 apktool 2.9.3 处理清单、资源和 smali，并把结果作为产物上传，`retention-days: 7`。包含 APK 的分支会在 20 分钟后删除。

状态查询：

```bash
curl /api/decompile/cloud/ab12cd34/status
# → {"id":"…","branch":"…","status":"completed","conclusion":"success","runUrl":"…","artifacts":[{"name":"inteebuild-decompile-ab12cd34","id":1,"sizeKB":812}],"ready":true}
```

只有当 run 成功结束且存在产物时，`ready` 才为 `true`。在 run 尚未创建之前，返回 `status: "queued"`。工作台每 5 秒查询一次，最长等待 5 分钟。

```bash
curl -L -o fuentes.zip /api/decompile/cloud/ab12cd34/download
```

ZIP 包含 `output/sources/**/*.java`、含 res、smali 和 manifest 的 `output/resources/**`、`output/AndroidManifest-decoded.xml` 和 `output/REPORT.txt`。如果 workflow 仍在运行，端点返回 `409`；如果已结束但没有产物，返回 `404` 并附上日志链接。

云端模式的限制：60 MB（git blobs 允许该大小）、与其余编译相同的每 IP 每小时 10 次构建的速率限制，产物 7 天后过期。使用商业混淆器混淆过的 APK 会失败。

## 工作台中的工作流程

1. 在“编译”步骤的 `Descompilador APK` 中，选择文件并点击 `Descompilar`。
2. 检查 `packageName`、权限、`Manifest preview` 以及关于读取到内容的说明。
3. 点击结果中的导入按钮：向导会填入名称、包名、URL 和权限。
4. 编译前先通过“权限”步骤的 Audit。
5. 如果你需要真正的 Java 代码，点击 `Decompilar en la nube (jadx + apktool)` 并下载源码 ZIP。

同一条路径也适用于 API：`POST /api/decompile`、`importConfig`，再用这些字段调用 `POST /api/build`，然后编译。

## 它不会做的事

- 不会反混淆代码。商业混淆器产生的代码，jadx 返回的结果往往不可读或不完整。
- 不会提取密钥、证书或混淆的资源。
- 来自其他 APK 的 `importConfig` 使用 `https://example.com` 作为 URL：编译前请改成真实的地址。
- 不会把 APK 转换成完整的 Gradle 项目：它返回清单、配置和包含内容的 ZIP，供你重新导入 InteeBuild。

如果你只是想检查 APK 而不重新导入，`POST /api/inspect` 会返回技术信息和 `security.score`，其上限较低，为 30 MB。限制和速率限制的详情见 [api.md](./api.md)。
