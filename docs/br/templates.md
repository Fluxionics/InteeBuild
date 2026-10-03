# Templates

O InteeBuild traz 29 templates. Não são presets decorativos: cada um define uma configuração completa e verificada que permite compilar de primeira. Estão distribuídos em `server/templates/` por família (`core`, `media`, `commerce`, `location`, `social`, `wellness`, `secure`) e são montados em `server/templates/index.js`.

Um template só traz valores padrão. O Permission Engine autocompleta os plugins de que as permissões precisam e o Audit tem que dar `canBuild: true` para que o build seja disparado.

## Como um template é aplicado

`applyTemplate` mescla a configuração do template como base e coloca os valores do usuário por cima: o que você escrever ganha. Os objetos `permissions` e `plugins` são mesclados permissão por permissão, então você pode marcar uma extra sem perder as que o template traz.

Essa mesma mesclagem acontece quando você envia `template` para `POST /api/build` ou para `POST /api/v1/build`. Se você não enviar template, a configuração sai limpa do que você manda em `normalizeConfig`.

## Conteúdo de cada família

**`core`** — web, pwa, blog, portafolio, news, dashboard, empresa, edu.

- `web` é a base mínima: sem permissões, só INTERNET, com pull-to-refresh, tela offline e downloads.
- `pwa` adiciona `notifications` e `storage`, e ativa `webManifest` e `serviceWorker` para sair uma PWA instalável.
- `blog` e `portafolio` adicionam avisos e leitura; `news` ainda restringe a orientação para vertical.
- `dashboard` deixa só notificações; `empresa` adiciona biometria, `flagSecure` e `outputType: aab` para a Play Store; `edu` adiciona câmera e microfone.

**`media`** — radio, streaming, podcast, ai, game.

- `radio` ativa `nativeAudio`, `nativeAutoplay`, `mediaSession` e `audioFocus`, com permissões `foreground`, `wakeLock` e `notifications`, e a tela offline com a mensagem "Sin conexión. El stream necesita internet."
- `streaming` usa `nativeAudio` com orientação por sensor e `keepScreenOn`.
- `podcast` soma `storage` para downloads e `mediaSession` para controles de mídia.
- `ai` habilita microfone e câmera para reconhecimento de voz.
- `game` é horizontal, em tela cheia, com vibração, `wakeLock` e `keepScreenOn`.

**`commerce`** — ecommerce, marketplace, food, realestate. Todos trazem câmera para fotos de produto, GPS e armazenamento; `marketplace` e `food` adicionam notificações, `realestate` adiciona `phone` para ligações diretas.

**`location`** — maps, travel, delivery, eventos.

- `maps` é o mínimo viável com GPS em primeiro plano e nada mais.
- `travel` combina GPS, câmera, armazenamento e avisos de viagem.
- `delivery` adiciona `gpsBackground`, `keepScreenOn` e câmera para comprovações de entrega.
- `eventos` cobre câmera para escanear QR e GPS para localizar o recinto.

**`social`** — comunidad e social. Ambas pedem câmera, armazenamento e notificações; `social` soma GPS para geolocalizar publicações.

**`wellness`** — salud e fitness. Ambas usam `sensors` e `activityRecognition`; `fitness` adiciona GPS, `wakeLock` e `keepScreenOn`.

**`secure`** — finanzas, banking, emergency, lab.

- `finanzas` e `banking` compartilham `biometric` + `notifications`, `flagSecure`, `blockSelection` e `outputType: aab`; `banking` adiciona `screenCaptureSecurity`.
- `emergency` traz GPS em segundo plano, `phone` para ligação automática, câmera e `highPriority` para os avisos.
- `lab` (Permission Test Lab) pede dez permissões de uma vez e sua face de exemplo executa cada teste no dispositivo e reporta o resultado real.

Os três casos que trazem `outputType: aab` são `empresa`, `finanzas` e `banking`, pensados para subir direto para o Play Console. O resto gera APK.

## Faces de exemplo

Cada template pode trazer uma `faceHtml`, uma página de exemplo em HTML. A de rádio, por exemplo, tem dois botões que chamam `InteeAudio.play()` e `InteeAudio.pause()` e caem em um `<audio>` do navegador se a ponte nativa não estiver. A face não é guardada separadamente: ao aplicar o template, o estúdio a grava no campo de HTML e muda a origem para HTML. Se o editor estava vazio, ele faz isso sozinho; se você já tinha seu próprio código, ele pergunta antes de substituí-lo (e você pode voltar para a face quando quiser com o botão de face do editor). Se você preferir sua URL, deixe a face intacta e volte a escolher a origem por URL depois.

Você pode ver a face pela API:

```bash
curl /api/templates            # lista con id, name, description y audit resumido
curl /api/templates/radio      # config completa + faceHtml
```

A listagem de `/api/templates` executa o Audit de cada template com um nome seguro e `https://example.com`, e retorna `ok`, `total`, `readiness` e `canBuild`. Se algum template começar a dar `canBuild: false`, você vê isso aí sem compilar nada.

## Verificação nativa

`GET /api/templates/:id/native` gera os arquivos reais do template em memória e responde com o manifesto, a lista de arquivos, os `.java` e `.xml` incluídos, se está `NativePermissions.java`, se está `RadioService.java`, se está o patch do catálogo, o `provider.json` e o audit. O campo `native100` é `true` quando o audit verifica tudo e permite compilar. É a forma rápida de ver o que cada template vai produzir sem pedir um build.

## Foreground service e áudio

Só três templates pedem `foreground`: `radio`, `streaming` e `podcast`. `wakeLock` aparece nessas mescas mais `game` e `fitness`, e `keepScreenOn` aparece em `streaming`, `game`, `delivery`, `fitness` e `emergency`. `delivery` não pede `foreground`: seu segundo plano ele resolve com `gpsBackground`, que é outra permissão com outro manifesto. **Adicionalmente, o `wifiLock` (`WIFI_MODE_FULL_HIGH_PERF`) é gerado automaticamente para `radio`, `streaming` e `podcast` quando há `foreground`, evitando que o áudio seja cortado por economia de energia do WiFi com a tela apagada.** O detalhe de por que esse código existe e como testá-lo está em [foreground.md](./foreground.md).

## Personalização

Depois de carregar um template você pode mudar o que quiser no modo avançado: permissões individuais, plugins, SDK, orientação, cores, splash e deep links. Se você muda só duas ou três coisas, mande os campos por cima com `template: "radio"` e pronto: não precisa repetir o que já vem.

As configurações reais de cada template ficam em `server/templates/*.js`, então se faltar um caso de uso você pode adicioná-lo ali com o mesmo formato e ele aparecerá em `GET /api/templates`.
