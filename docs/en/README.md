# InteeBuild Documentation

This folder contains the documentation that `docs.html` loads in the browser. All guides are written so they can be verified against the repository's code: if a claim can't be checked in `server/`, it shouldn't be here.

If this is your first time, start with the [quickstart](./quickstart.md).

## Guides

- [quickstart.md](./quickstart.md) — from zero to your first APK with the studio.
- [permissions.md](./permissions.md) — the 86 granular permissions: what each one generates, how to test it, and what the Audit returns.
- [foreground.md](./foreground.md) — background audio with `RadioService`, `MediaSession` and `WakeLock`.
- [templates.md](./templates.md) — the 29 templates and what each one preloads.
- [providers.md](./providers.md) — WebView engines: which ones compile and which ones only generate code.
- [ui-ux.md](./ui-ux.md) — appearance and behavior fields accepted by the generator.
- [outputs.md](./outputs.md) — what comes out of each build (APK, AAB, ZIP, PWA, Play Store listing).
- [api.md](./api.md) — REST API, API Keys, webhooks and `curl` examples.
- [analyzer.md](./analyzer.md) — web health analyzer, scoring and auto-fix.
- [decompiler.md](./decompiler.md) — local and cloud decompilation.
- [versions.md](./versions.md) — versions, update checks and auto-build on every push.
- [security.md](./security.md) — server limits, SSRF, API Keys and what the generated app exposes.
- [production.md](./production.md) — deployment on Render, environment and diagnostics.
- [troubleshooting.md](./troubleshooting.md) — common errors and their causes.
- [faq.md](./faq.md) — frequently asked questions: providers, limits, logs, iOS, audio.

## Evidence convention

- `GENERATED OK` means the item exists in the ZIP that gets compiled, not in the definition. You can download it with `POST /api/project` and look for it by hand.
- `SPEC ONLY, NOT GENERATED` means you requested it but it wasn't generated: don't ship it.
- The Audit runs with `POST /api/permissions/audit` or with the QA button in the studio.
- The useful order of testing is one: minimal, one permission per build, real device.
