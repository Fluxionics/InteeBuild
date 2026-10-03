# Going to production

This guide covers how to deploy InteeBuild on free services and what to check before exposing it. Everything the project does works without paid plans: builds run on GitHub Actions, the server fits in Render's free plan, and there isn't a single paid API behind it.

## Free deployment

`render.yaml` defines the service with `plan: free`, `npm install` as the build, `node server/server.js` as the start command, and `/api/health` as the health check. In Render > Environment go `GITHUB_TOKEN`, `INTEE_BUILDS_REPO`, `INTEE_DEFAULT_BRANCH`, and, if you want, `CORS_ORIGIN` and `CLEANUP_SECRET`.

Three things worth keeping in mind about the free plan:

- **The disk is wiped on restart.** Everything the server writes to `data/` (build history, API keys, git integrations, and versions) lives on Render's ephemeral disk and disappears with every restart or deploy. That's expected: don't put anything there you can't afford to lose.
- **The service sleeps without traffic** and takes about a minute to wake up. The first request after idle is slow.
- **GitHub Actions charges minutes to private repos.** On the free account there's a monthly allowance of about 2000 minutes on Linux runners, and each build occupies a runner for several minutes. Public repos don't consume that allowance. If you run short, use a public builds repo or check GitHub's billing panel.

The builds repo costs nothing and cleans itself: every 30 minutes the server deletes `build-*` and `decompile-*` branches older than 5 minutes, and runs and artifacts older than 30 minutes. That's why download links expire quickly.

## Security before you publish

1. **Token with minimal permissions.** A fine-grained token scoped to the builds repo only, with `Contents: Read/write` and `Actions: Read/write`. Nothing more. If it leaks, the damage stays contained to that repo.
2. **Never upload `.env` to the repo.** It's in `.gitignore`. Variables go in Render > Environment.
3. **`CORS_ORIGIN` configured.** In `.env.example` it comes empty, which is development mode (any origin). In production, `CORS_ORIGIN=https://tu-dominio.com`.
4. **Manual cleanup off by default.** `/api/cleanup` returns `403` unless you set `CLEANUP_SECRET` and pass `?secret=…`. The automatic cleanup every 30 minutes doesn't depend on that.
5. **Rate limit active.** 10 builds per hour per IP, shared with cloud decompilation. On Render the counter is lost on restart, a side effect of the ephemeral disk.
6. **SSRF protection active.** URLs to localhost, private networks, and cloud metadata endpoints are blocked in `/api/build`, `/api/project`, and `/api/analyze`, and also in the redirects the analyzer returns.
7. **No secrets in responses.** `/api/health` and `/api/diag` confirm that the token exists and whether it's valid, but they never return it. The API key listing returns the masked hash, not the key.

## Diagnostics

Open `/api/diag` on your domain (there's also a "Diagnóstico" link in the footer). It walks through five steps and stops at the first one that fails:

- `env.hasToken` or `env.hasRepo` set to `false`: variables are missing in Render > Environment. Add them and redeploy.
- `token.hint` with "inválido": the token expired or was revoked; generate a new one.
- `repo.hint` with "no existe o sin acceso": `INTEE_BUILDS_REPO` is misspelled (format `usuario/repo`) or the token can't reach that repo.
- `branch.hint` with GitHub's default branch different from the one you use: set `INTEE_DEFAULT_BRANCH` to the value the message indicates.
- `workflow.hint` with "aún no hay workflow": normal on a fresh install, the file gets created on the first build.
- `ok: true`: everything lines up. If the build fails after that, open the run's logs from the result button.

## Common errors

- `503 "GitHub no configurado"` — `GITHUB_TOKEN` or `INTEE_BUILDS_REPO` missing.
- `429` with `Limite de builds alcanzado (10 por hora)` — 10 per hour per IP; wait for the window to expire.
- `400` validation error — the message says what to fix: name, blocked URL, package, version, HTML over 500,000 characters, or an icon over 7 MB.
- Build in `failed` with a GitHub error — open `/api/diag` and, if it gives `ok: true`, check the run's log.
- Build in `failed` with "Tiempo de espera agotado consultando GitHub" — the server exhausted its 200 polls at 6 seconds each (about 20 minutes); the runner took longer than expected or GitHub was slow.

## Cost

$0 in licenses and services: builds, debug signing, downloads, and API cost nothing. The only thing that can spend money is your own GitHub or Render account if you go past the free allowance, and that shows up in their billing panels. If you ever add paid plans, do it in a separate fork so you don't complicate this version.

On concrete API limits, see [api.md](./api.md). On build and server security, see [security.md](./security.md).
