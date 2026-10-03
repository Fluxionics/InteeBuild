# 投入生产

本指南介绍如何在免费服务上部署 InteeBuild，以及在对外暴露之前需要检查什么。本项目的所有功能都不需要付费计划：构建在 GitHub Actions 上运行，服务器可以放进 Render 的免费套餐，背后没有任何付费 API。

## 免费部署

`render.yaml` 用 `plan: free` 定义服务，用 `npm install` 作为构建命令，用 `node server/server.js` 作为启动命令，用 `/api/health` 作为健康检查。`GITHUB_TOKEN`、`INTEE_BUILDS_REPO`、`INTEE_DEFAULT_BRANCH`，以及可选的 `CORS_ORIGIN` 和 `CLEANUP_SECRET` 都放在 Render > Environment 中。

关于免费套餐有三点需要注意：

- **磁盘在重启时会被清空。** 服务器写入 `data/` 的所有内容（构建历史、API key、git 集成和版本）都存放在 Render 的临时磁盘上，每次重启或部署都会消失。这是预期行为：不要在那里保存任何不能丢失的东西。
- **没有流量时服务会休眠**，唤醒大约需要一分钟。闲置后的第一次请求会比较慢。
- **GitHub Actions 对私有仓库收取分钟数费用。** 免费账户每月有约 2000 分钟的 Linux runner 配额，每次构建会占用 runner 数分钟。公开仓库不消耗该配额。如果配额不够，请使用公开的构建仓库或查看 GitHub 的计费面板。

构建仓库不花钱，并且会自我清理：服务器每 30 分钟删除存在超过 5 分钟的 `build-*` 和 `decompile-*` 分支，以及超过 30 分钟的 run 和产物。因此下载链接很快就会过期。

## 发布前的安全措施

1. **权限最小的 token。** 一个仅针对构建仓库的 fine-grained token，只授予 `Contents: Read/write` 和 `Actions: Read/write`。仅此而已。即使泄露，影响也仅限于该仓库。
2. **切勿把 `.env` 上传到仓库。** 它已在 `.gitignore` 中。变量放在 Render > Environment。
3. **配置 `CORS_ORIGIN`。** `.env.example` 中它是空的，即开发模式（允许任何来源）。在生产环境应设为 `CORS_ORIGIN=https://tu-dominio.com`。
4. **手动清理默认禁用。** 除非你设置 `CLEANUP_SECRET` 并传入 `?secret=…`，否则 `/api/cleanup` 返回 `403`。每 30 分钟一次的自动清理不依赖于此。
5. **速率限制已启用。** 每个 IP 每小时 10 次构建，与云端反编译共用。在 Render 上，计数器会在重启时丢失，这是临时磁盘带来的副作用。
6. **SSRF 防护已启用。** 指向 localhost、内网和云元数据端点的 URL 会在 `/api/build`、`/api/project` 和 `/api/analyze` 中被拦截，分析器返回的重定向同样受限。
7. **响应中不包含机密。** `/api/health` 和 `/api/diag` 会确认 token 是否存在及其是否有效，但绝不会返回它。API key 列表返回的是掩码后的哈希，而不是 key 本身。

## 诊断

在你的域名下打开 `/api/diag`（页脚也有 "Diagnóstico" 链接）。它会依次检查五个步骤，并在第一个失败处停下：

- `env.hasToken` 或 `env.hasRepo` 为 `false`：Render > Environment 中缺少变量。添加它们并重新部署。
- `token.hint` 显示 "inválido"：token 已过期或被吊销；生成一个新的。
- `repo.hint` 显示 "no existe o sin acceso"：`INTEE_BUILDS_REPO` 书写有误（格式为 `usuario/repo`），或 token 无法访问该仓库。
- `branch.hint` 显示 GitHub 的默认分支与你使用的不同：按提示信息把 `INTEE_DEFAULT_BRANCH` 调整为对应值。
- `workflow.hint` 显示 "aún no hay workflow"：全新安装时属正常，该文件会在第一次构建时自动创建。
- `ok: true`：一切正常。如果之后构建失败，从结果按钮打开 run 的日志。

## 常见错误

- `503 "GitHub no configurado"` — 缺少 `GITHUB_TOKEN` 或 `INTEE_BUILDS_REPO`。
- `429` 伴随 `Limite de builds alcanzado (10 por hora)` — 每个 IP 每小时 10 次；等待时间窗口过去。
- `400` 校验错误 — 消息会指出需要修正的内容：名称、被拦截的 URL、package、版本、超过 500,000 字符的 HTML 或大于 7 MB 的图标。
- 构建为 `failed` 且是 GitHub 错误 — 打开 `/api/diag`，如果返回 `ok: true`，查看 run 的日志。
- 构建为 `failed` 且错误为 "Tiempo de espera agotado consultando GitHub" — 服务器用完了 200 次、每次 6 秒的查询（约 20 分钟）；runner 耗时超出预期，或 GitHub 当时较慢。

## 成本

许可证和服务方面为 $0：构建、debug 签名、下载和 API 都不花钱。唯一可能产生费用的是你自己的 GitHub 或 Render 账号超出免费配额，这可以在它们的计费面板中看到。如果你将来要加入付费计划，请在单独的 fork 中进行，以免让这个版本变得复杂。

关于 API 的具体限制，见 [api.md](./api.md)。关于构建和服务器的安全，见 [security.md](./security.md)。
