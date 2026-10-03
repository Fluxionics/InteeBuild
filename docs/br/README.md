# Documentação do InteeBuild

Esta pasta é a documentação que o `docs.html` carrega no navegador. Todos os guias foram escritos para poderem ser verificados contra o código do repositório: se uma afirmação não puder ser comprovada em `server/`, ela não deveria estar aqui.

Se é a sua primeira vez, comece pelo [início rápido](./quickstart.md).

## Guias

- [quickstart.md](./quickstart.md) — do zero ao primeiro APK com o estúdio.
- [permissions.md](./permissions.md) — as 86 permissões granulares: o que cada uma gera, como testá-la e o que o Audit retorna.
- [foreground.md](./foreground.md) — áudio em segundo plano com `RadioService`, `MediaSession` e `WakeLock`.
- [templates.md](./templates.md) — os 29 templates e o que cada um pré-carrega.
- [providers.md](./providers.md) — mecanismos WebView: quais compilam e quais apenas geram código.
- [ui-ux.md](./ui-ux.md) — campos de aparência e comportamento que o gerador aceita.
- [outputs.md](./outputs.md) — o que sai de cada build (APK, AAB, ZIP, PWA, ficha da Play Store).
- [api.md](./api.md) — API REST, API Keys, webhooks e exemplos de `curl`.
- [analyzer.md](./analyzer.md) — analisador de saúde web, pontuação e auto-fix.
- [decompiler.md](./decompiler.md) — descompilação local e na nuvem.
- [versions.md](./versions.md) — versões, verificação de atualizações e auto-build a cada push.
- [security.md](./security.md) — limites do servidor, SSRF, API Keys e o que o app gerado expõe.
- [production.md](./production.md) — implantação no Render, ambiente e diagnóstico.
- [troubleshooting.md](./troubleshooting.md) — erros frequentes e sua causa.
- [faq.md](./faq.md) — perguntas frequentes: providers, limites, logs, iOS, áudio.

## Convenção de evidência

- `GENERATED OK` significa que o elemento existe no ZIP que será compilado, não na definição. Você pode baixá-lo com `POST /api/project` e procurá-lo manualmente.
- `SPEC ONLY, NOT GENERATED` significa que você pediu, mas não foi gerado: não implante isso.
- O Audit é executado com `POST /api/permissions/audit` ou com o botão de QA no estúdio.
- A ordem de testes útil é uma: mínimo, uma permissão por build, dispositivo real.
