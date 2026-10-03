# Solução de problemas

Os casos desta lista são os que mais se repetem. Comece lendo a mensagem completa: a maioria diz exatamente o que falta.

## O botão Compilar não avança

Antes de disparar qualquer coisa, o estúdio chama `POST /api/build-readiness` e, se `canBuild` é `false`, mostra os `warnings` em vermelho e não compila. Os avisos mais habituais:

- `Audio nativo activo pero sin URL del stream: pon tu servidor en Audio nativo` — o template de rádio ou streaming vem com `nativeAudio` ativado e o campo do stream vazio. Preencha-o no passo de Ajustes, cartão de áudio nativo.
- `streamUrl debe empezar con http:// o https://` — falta o esquema na URL do stream.
- `Falta URL o HTML` — não há fonte no passo 1.
- `X requiere Android N+` — uma permissão pede um `targetSdk` mais alto. Suba o SDK ou remova a permissão.

Se a checagem de readiness não responde, o estúdio tenta compilar mesmo assim e mostra o erro real do servidor.

No passo de QA também há uma lista de itens que fica em vermelho. Com um item falhado, ou sem aceitar os termos, o botão de avanço fica desabilitado: é intencional, mas a mensagem de cima diz o que corrigir.

## O build nem sequer começa

- `503 "GitHub no configurado..."` — faltam `GITHUB_TOKEN` ou `INTEE_BUILDS_REPO`. Veja `/api/diag`.
- `429` com `Limite de builds alcanzado (10 por hora)` — o contador é por IP e é compartilhado por `/api/build`, `/api/v1/build` e `/api/decompile/cloud`. Aguarde a hora expirar.
- `400` com mensagem de validação — o texto explica: nome de app, package ID, versão, URL bloqueada, HTML de mais de 500.000 caracteres ou ícone de mais de 7 MB.
- `401` em `/api/v1/build` — já existe pelo menos uma API key e você não está enviando nenhuma. Crie uma com `POST /api/keys`.

## GitHub Actions falhou

Abra o link do run a partir do resultado do build ou de `/api/build/:id`. Erros frequentes:

- **`422 No workflow found with any ref`** — o workflow ainda não está registrado na branch base. O servidor tenta de novo sozinho, até seis vezes com espera crescente; se continuar falhando, aguarde alguns segundos e dispare novamente.
- **Falha de Gradle** — quase sempre SDK ou dependência. Tente `compileSdk` e `targetSdk` 35, que são os valores com os quais o gerador está testado. Os passos do run se chamam `Compile APK`, `Compile Release APK`, `Compile AAB` e `Compile Release AAB`.
- **`package org.mozilla.geckoview does not exist`** — o passo `Apply GeckoView dependencies` não rodou ou o seu patch falhou: no log deve aparecer `geckoview` após `grep -c geckoview android/app/build.gradle`. Se o ZIP é de uma versão anterior do gerador, gere o projeto de novo; se ainda assim não estiver, mude para `capacitor` ou `native`.
- **O workflow termina sem artefato** — a saída pedida (`apk`, `aab` ou `both`) não coincide com o que foi compilado, ou o Gradle não chegou a empacotar. Veja os passos `Compile APK` e `Compile AAB` do run.

## O APK não baixa

1. Verifique que o build chegou a `success`.
2. `/api/download/:id` precisa que o build continue na memória do servidor: se o processo reiniciou, responde `404` mesmo que o artefato exista no GitHub.
3. As branches são apagadas cerca de um minuto após a conclusão, e a varredura automática a cada 30 minutos remove runs e artefatos com mais de 30 minutos. Se expirou, compile de novo.
4. `404 "AAB no encontrado"` significa que você pediu APK; `IPA no encontrado (firma iOS requerida)` significa que não houve certificados da Apple.

## O app abre em branco

- Se você desativou a opção de tráfego HTTP (cleartext), o manifesto sai com `android:usesCleartextTraffic="false"` e uma URL `http://` não carrega: você verá branco. Ative-a de novo ou use HTTPS. Por padrão, o manifesto permite cleartext.
- Verifique que o seu site permita ser embutido: headers `X-Frame-Options` ou `Content-Security-Policy: frame-ancestors` no seu servidor bloqueiam o WebView e você vê uma tela vazia.
- Revise o console do seu site com o app aberto: os erros de JavaScript são os mesmos que no navegador.
- Com o provider `flutter`, o APK vem do job `flutter-build` (veja os seus passos `Build APK`/`Build App Bundle`), não de `Compile APK`. Com o provider `cordova`, vem do job `cordova-build` (passos `Compile Cordova APK`). Com o provider `tauri`, o APK continua sendo o do Capacitor e ainda há um `.exe` do job `tauri-build`. O provider `gecko` sim compila um APK diferente: a `MainActivity` é GeckoView.

## Permissão negada no Android

1. Baixe o projeto com `POST /api/project` e verifique que `main-manifest.xml` inclui a permissão.
2. Conceda a permissão manualmente nas Configurações do Android na primeira vez.
3. Se a sua web pede câmera e você não marcou `cameraMic`, o `WebChromeClient` gerado não inclui esse recurso na lista permitida e responde `deny()`. Marque a permissão e compile de novo.
4. As permissões com `minSdk` alto dão um `warn` no Audit se o seu `targetSdk` for inferior; suba o SDK.

## Audit e readiness em vermelho

- `gpsBackground sin gps` — ative também a localização precisa.
- `SPEC ONLY, NOT GENERATED` numa linha — a permissão está no spec mas não chegou ao manifesto gerado; costuma ser um caso que precisa de outra permissão base.
- `NO GENERADO` — não há implementação para esse elemento (é o que acontece com `ads`). O Audit trata como falha e bloqueia o build.
- Linha com `REQUIRES ANDROID N+` — suba `targetSdk` ou remova a permissão.
- Se o botão de avanço está desabilitado, há um `fail` no Audit: corrija-o em vez de forçar.

## Analisador com pontuação baixa

- Sem HTTPS: o analisador tira 10 pontos e o módulo de segurança desconta 25 sobre a própria pontuação. É o primeiro item a corrigir.
- Sem `viewport`: tira 10 (com ele soma 20); adicione `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- Sem service worker nem manifest: não chegam os 15 e 10 pontos que somariam, e `checks.pwa` fica em `false`.
- Recursos com `http://`: tira 2 por recurso, com um teto de 20. O módulo de segurança os conta à parte.
- Se o score é baixo, aplique o Auto-Fix e revise o diff: a correção é heurística e pode deixar `alt=""` vazio ou forçar `https://` num recurso que não exista.

## Erros no console do navegador

- `ERR_BLOCKED_BY_CLIENT` contra um domínio de anúncios — era um adblocker. Os anúncios já são servidos pelo seu próprio domínio com `/api/ads/:slot`; se ainda aparecer, recarregue com cache forte ou faça o deploy de novo.
- `cdn.tailwindcss.com should not be used in production` — aviso do Tailwind, não quebra nada.
- `No label associated with a form field` — aviso de acessibilidade, não bloqueia nada.
- `Uncaught SyntaxError` ao carregar o editor — recarregue com cache forte.

## Validações do formulário

- Nome: letras, números, espaços, hífens e pontos, de 2 a 40 caracteres.
- Package ID: minúsculas, números e sublinhado, com pelo menos um ponto (`com.miempresa.miapp`).
- Versão: números com pontos (`1.0.0`).
- SDK: se o valor não está na lista de válidos, o servidor o substitui por um válido em vez de rejeitá-lo.
- HTML vazio com origem HTML: é rejeitado; cole o seu código ou use a face de um template.

## Descompilador

- `413` ou "APK demasiado grande" na nuvem: 60 MB é o teto; o local chega a 100 MB.
- `Rate limit: 10/h por IP`: é o mesmo contador dos builds.
- `409 Workflow todavía corriendo`: aguarde e tente o download de novo.
- `404 El workflow terminó sin artefacto`: veja os logs do run; os APKs ofuscados costumam falhar aqui.
- `500 Configura GITHUB_TOKEN...`: falta a mesma configuração que para compilar.

## Diagnóstico do servidor

`/api/diag` percorre token, repo, branch e workflow e para no primeiro que falha, com um `hint` dizendo o que mudar. Se devolver `ok: true` e o build continua falhando, o problema está no run do GitHub: abra os seus logs. O detalhe de cada campo está em [production.md](./production.md).

Se o problema é de permissões, a referência está em [permissions.md](./permissions.md); se é de áudio em segundo plano, em [foreground.md](./foreground.md).
