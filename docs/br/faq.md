# Perguntas frequentes

Respostas curtas ao que mais se pergunta. Cada uma aponta para o guia onde se verifica contra o código.

## Qual provider eu escolho?

`capacitor` se você não tem motivos para mudar: é o único com todos os patches testados (permissões runtime, acessos especiais, áudio nativo, Droncito Pack). `native` se você quer o APK mais leve; `gecko` se você precisa do motor Mozilla; `twa`, `cordova`, `flutter` e `tauri` para esses ecossistemas específicos. Todos compilan hoje na CI. Detalhe e limites de cada um em [providers.md](./providers.md).

## Flutter e Tauri compilam de verdade?

Sim. `flutter` lança o job `flutter-build` (Ubuntu + `flutter create` + `flutter build apk`) e entrega o artefato `-apk` e, se você pediu, `-aab`. `tauri` lança `tauri-build` (Windows + `cargo build --release`) e entrega `-exe`. O workflow recebe o provider como input e pula ou ativa cada job conforme o caso. Ver [outputs.md](./outputs.md).

## Quantos builds posso fazer?

10 por hora e por IP, mais 10 descompilações por hora. O limite é aplicado no servidor sobre a sua IP; quando se atinge, a API responde `429`.

## Onde vejo o log completo do build?

Na ficha do build, o console mostra o log de todos os jobs e passos (até 500 KB por build). Pela API: `GET /api/build/:id/logs`. Se você precisa do detalhe bruto, o GitHub Actions mantém o run enquanto viver a branch e o artefato (30 minutos).

## O build de iOS funciona?

Sim. O workflow usa `pod install` e compila contra `App.xcworkspace` (não `App.xcodeproj`), que é o que é necessário com os pods do Capacitor. Sem certificados, o passo `ios-build` compila no simulador com a assinatura desativada; com `.p12` e `.mobileprovision` no passo de assinatura, arquiva para o dispositivo. Ver [outputs.md](./outputs.md).

## Por que o áudio corta com a tela apagada?

Quase sempre uma destas três: a URL é `blob:` (hls.js, YouTube), o seu HTML pausa em `visibilitychange`, ou o build não traz `foreground` + `streamUrl`. O provider `gecko` nunca terá passagem para o nativo porque o GeckoView não permite `addJavascriptInterface`. Checklist completo em [foreground.md](./foreground.md).

## O que significa cada badge do Audit?

`GENERATED OK` = o elemento está no ZIP que vai ser compilado. `SPEC ONLY, NOT GENERATED` = você pediu mas não foi gerado. `NO GENERADO` = não há implementação (bloqueia o build, como `ads`). Na coluna de provider: `OK (<provider>)`, `WARN (<provider> sin handler declarado...)` ou `WARN (<provider> compila APK en CI...)`. Ver [permissions.md](./permissions.md).

## Quanto pesa o app?

Os limites do servidor são 7 MB para o ícone e 500 KB para o HTML. O APK de `native` é o mais leve porque não arrasta o runtime do Capacitor; com `gecko` o build demora bem mais porque `patch-gecko-gradle.js` baixa o AAR da Mozilla de `maven.mozilla.org` a cada compilação.

## Posso compilar sem o estúdio?

Sim: `POST /api/project` devolve o ZIP com tudo (workflow incluído) e você pode subi-lo para o seu próprio repo do GitHub. O workflow `build-app.yml` é o mesmo que usa o servidor; os inputs são `id`, `platform`, `outputs` e `provider`. Ver [api.md](./api.md).

## Os artefatos ficam guardados para sempre?

Não: vivem no GitHub Actions por 30 minutos e o servidor os limpa igualmente. O histórico local (`GET /api/history`) mantém os metadados e o link enquanto durar a entrada; se expirou, compile de novo.

## O app funciona offline?

A PWA sim: com `pwaEnabled` (vem ativado) o ZIP inclui `manifest.webmanifest` e `sw.js` com cache offline do seu HTML. O app Android mostra a sua web dentro do seu WebView; a cache offline do service worker depende do seu HTML e dos headers do seu servidor. Ver [outputs.md](./outputs.md).

## O que cada escolha de aparência afeta?

`accentColor` entra no manifesto e nas cores nativas, `splashColor` na tela de inicialização, `orientation` no manifesto e na janela de desktop. O detalhe está em [ui-ux.md](./ui-ux.md).

Se algo falhar, comece por [troubleshooting.md](./troubleshooting.md).
