# Versions, updates, and CI/CD

Everything on this page runs on your own server and is stored in local files (`data/versions.json` and `data/git-integrations.json`). There are no external services or added accounts: the only thing you need is GitHub, which you already use to build.

## Versioning

Every build carries a `versionName` and a `versionCode`. The version accepts one to four dot-separated numeric blocks (`1`, `1.0`, `1.0.1`, `1.0.1.2`) and anything that doesn't fit is rejected with a `400`. The `versionCode` is an integer that only ever goes up: the Play Store requires it to grow on every release, and the server accepts any positive integer.

In the studio you fill it in on the Application step. Over the API they go in the body of `POST /api/build` as `versionName` and `versionCode`; `POST /api/v1/build` accepts them too.

## Publishing and querying versions

```bash
curl -X POST /api/versions/publish -H "Content-Type: application/json" \
  -d '{"appId":"com.miempresa.miapp","version":"1.0.1","changelog":"Corrige audio en segundo plano"}'
# → {"ok":true,"appId":"com.miempresa.miapp","versions":[{"version":"1.0.1","changelog":"…","publishedAt":1712345678901}]}
```

Keeps up to 20 entries per `appId`, always with the newest first. If you don't send `appId` or the version doesn't match the format, it returns `400`.

```bash
curl /api/versions/com.miempresa.miapp
# → {"appId":"com.miempresa.miapp","versions":[…]}
```

Returns the full list. If nobody has published for that `appId`, it responds with the empty object (`versions: []`).

```bash
curl "/api/check-update?appId=com.miempresa.miapp&version=1.0.0"
# → {"updateAvailable":true,"latest":"1.0.1","changelog":"Corrige audio en segundo plano"}
```

Compares the version you send against the latest published one, component by component. If nothing has been published it responds `{"updateAvailable":false}`.

This is a registry you can query: there's no OTA client inside the generated app, so the "new version available" banner is up to you to build, on your site or in your HTML, by calling this endpoint and linking to your APK or AAB.

## Automatic build on every push

The flow has four steps:

1. Connect the repository: `POST /api/git/connect` with `{"repo":"usuario/mi-web","branch":"main"}`. The integration is saved and its `id` returned.
2. Generate the workflow: `POST /api/cicd` with `{"repo":"usuario/mi-web","branch":"main","baseUrl":"https://tu-dominio.com"}`. Returns the full YAML and the path to upload it to.
3. Upload that YAML to `usuario/mi-web/.github/workflows/inteebuild-auto.yml`.
4. Every push to that branch triggers the workflow's `curl` against your server's `POST /api/git/webhook`.

The webhook accepts GitHub's native format (`{"repository":{"full_name":"usuario/mi-web"},"ref":"refs/heads/main"}`) and also a short format with `repo` and `branch`. If there's no integration registered for that combination it responds `404`. If the body carries a `config` field, it's used as the build configuration; otherwise a minimal one is built with `url: https://usuario/mi-web` and the repository name.

Integrations are listed with `GET /api/git/integrations` and deleted with `DELETE /api/git/:id`.

One thing to know before sending a token: the `token` field of `connect` is stored in full in `data/git-integrations.json` (plus a digest for the listing) and nothing reads it today. Since the webhook doesn't use it, the recommendation is not to send it.

Since automatic cleanup deletes `build-*` branches as soon as they're a few minutes old, the builds repo never fills up: each push creates a new branch, a run, and some artifacts that live a short time.

On build limits, see [production.md](./production.md). On what comes out of each compilation, see [outputs.md](./outputs.md).
