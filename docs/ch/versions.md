# 版本、更新与 CI/CD

本页的所有功能都在你自己的服务器上运行，并保存在本地文件（`data/versions.json` 和 `data/git-integrations.json`）中。没有外部服务，也不需要额外账号：你唯一需要的就是 GitHub，而你本来就在用它来编译。

## 版本号

每次构建都带有 `versionName` 和 `versionCode`。版本号接受一到四个以点分隔的数字块（`1`、`1.0`、`1.0.1`、`1.0.1.2`），不符合格式的会以 `400` 拒绝。`versionCode` 是一个必须始终递增的整数：Play Store 要求它在每次发布时增长，服务器接受任意正整数。

在工作台中，你在“应用”步骤填写它们。通过 API 时，它们作为 `versionName` 和 `versionCode` 放在 `POST /api/build` 的请求体中；`POST /api/v1/build` 同样接受它们。

## 发布与查询版本

```bash
curl -X POST /api/versions/publish -H "Content-Type: application/json" \
  -d '{"appId":"com.miempresa.miapp","version":"1.0.1","changelog":"Corrige audio en segundo plano"}'
# → {"ok":true,"appId":"com.miempresa.miapp","versions":[{"version":"1.0.1","changelog":"…","publishedAt":1712345678901}]}
```

每个 `appId` 最多保存 20 条记录，最新的始终排在最前面。如果你没有发送 `appId`，或版本号不符合格式，会返回 `400`。

```bash
curl /api/versions/com.miempresa.miapp
# → {"appId":"com.miempresa.miapp","versions":[…]}
```

返回完整列表。如果没有人针对该 `appId` 发布过，则返回空对象（`versions: []`）。

```bash
curl "/api/check-update?appId=com.miempresa.miapp&version=1.0.0"
# → {"updateAvailable":true,"latest":"1.0.1","changelog":"Corrige audio en segundo plano"}
```

把你发送的版本与最新发布的版本逐段比较。如果没有已发布的内容，返回 `{"updateAvailable":false}`。

这是一个你可以查询的记录：生成的应用中没有 OTA 客户端，所以“有新版本可用”的横幅需要你自己实现，放在你的网页或 HTML 中，调用该端点并链接到你的 APK 或 AAB。

## 每次 push 时自动构建

该流程有四个步骤：

1. 连接仓库：向 `POST /api/git/connect` 发送 `{"repo":"usuario/mi-web","branch":"main"}`。集成会被保存并返回其 `id`。
2. 生成 workflow：向 `POST /api/cicd` 发送 `{"repo":"usuario/mi-web","branch":"main","baseUrl":"https://tu-dominio.com"}`。返回完整的 YAML 及其上传路径。
3. 把该 YAML 上传到 `usuario/mi-web/.github/workflows/inteebuild-auto.yml`。
4. 每次向该分支 push 都会触发 workflow 中的 `curl`，请求你服务器的 `POST /api/git/webhook`。

webhook 接受 GitHub 的原生格式（`{"repository":{"full_name":"usuario/mi-web"},"ref":"refs/heads/main"}`），也接受带 `repo` 和 `branch` 的简短格式。如果该组合没有注册的集成，则返回 `404`。如果请求体带有 `config` 字段，它会被用作构建配置；否则会用 `url: https://usuario/mi-web` 和仓库名构造一个最小配置。

集成可以用 `GET /api/git/integrations` 列出，用 `DELETE /api/git/:id` 删除。

发送 token 前需要知道的一个细节：`connect` 的 `token` 字段会完整保存在 `data/git-integrations.json` 中（另外还会保存一个用于列表展示的摘要），而目前没有任何代码读取它。既然 webhook 不使用它，建议不要发送。

由于自动清理会在 `build-*` 分支满几分钟后就将其删除，构建仓库不会被塞满：每次 push 都会生成一个新分支、一次 run 和一些存活时间很短的产物。

关于构建的限制，见 [production.md](./production.md)。关于每次编译的产物，见 [outputs.md](./outputs.md)。
