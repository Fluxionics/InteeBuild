# Interface e experiência do app

Este guia cobre os campos de aparência e comportamento que você controla pelo passo Ajustes do estúdio. Todos eles são configuração de geração: o que você marca aqui termina em um manifesto, um `capacitor.config.json`, um `colors.xml` ou em um script que é injetado no seu HTML.

Para saber o que cada campo faz, a regra é simples: se não aparece nesta lista, ou aparece marcado como sem efeito, confira com `POST /api/project` e olhe o ZIP antes de dar qualquer coisa como certa.

## Estilo e aparência

**Tema (`appTheme`)** — `system` (padrão), `light` ou `dark`. Escolha se a barra de status fica em estilo claro ou escuro: quando o plugin StatusBar ou o modo edge-to-edge está ativo, o `capacitor.config.json` sai com `StatusBar.style` em `DARK` se o tema for escuro e em `LIGHT` caso contrário. Não altera as cores do seu próprio site.

**Transição inicial (`entryAnimation`)** — `none` (padrão), `fade` ou `slide`. É salva em `build-config.json`, mas nenhum patch do gerador a aplica hoje: é um valor que fica registrado sem se traduzir em código.

**Cor de destaque (`accentColor`)** — por padrão `#4f46e5`. Se você mudar, o ZIP inclui `custom-colors.xml` com `colorPrimary` e `colorAccent`; esse arquivo é copiado pelo workflow para `res/values/colors.xml`. A mesma cor é usada como `theme_color` do manifesto PWA e como destaque do script injetado.

**Cor da barra de status (`statusBarColor`)** — por padrão `#ffffff`. Vai para `colorPrimaryDark` do mesmo `custom-colors.xml` e para `StatusBar.backgroundColor` quando o plugin StatusBar está ativo.

**Cor da barra de navegação (`navigationBarColor`)** — por padrão `#ffffff`. Serve para decidir se o `custom-colors.xml` é gerado, mas não grava nenhum valor com essa cor: o arquivo contém apenas `colorPrimary`, `colorPrimaryDark` e `colorAccent`.

As três cores só geram o arquivo se alguma delas divergir do valor padrão; com a configuração de fábrica ele não aparece no ZIP.

**Design edge-to-edge (`edgeToEdge`)** — ativa `overlaysWebView` no plugin StatusBar, de modo que seu conteúdo seja desenhado por baixo das barras do sistema. Combinado com `statusBarColor`, você decide que cor fica atrás.

## Comportamento da tela

**Orientação (`orientation`)** — `any` (padrão), `portrait`, `landscape` ou `sensor`. É gravada no manifesto como `screenOrientation`.

**Tela cheia (`fullscreen`)** — oculta a barra de status superior e deixa o splash imersivo.

**Manter a tela ligada (`keepScreenOn`)** — adiciona `android:keepScreenOn="true"` à atividade. Para vídeo, jogos e streaming; trazem `streaming`, `game`, `delivery`, `fitness` e `emergency`.

**Tráfego inseguro (`useCleartext`)** — ativado por padrão. Coloca `android:usesCleartextTraffic="true"` no manifesto e `server.cleartext` e `android.allowMixedContent` em `capacitor.config.json`, além de fixar `androidScheme` em `http` se a sua URL for `http://`. Se você desativar e sua fonte for `http://`, o app não carrega nada.

## Splash

`splashEnabled` grava a configuração de `SplashScreen` em `capacitor.config.json` com `launchAutoHide: true`, a duração e a cor de fundo. `splashDuration` é aceito entre 500 e 5000 ms e por padrão são 2000. `splashColor` é reutilizado ainda como `background_color` do manifesto PWA.

Não há campo de imagem de splash: o fundo é liso e o ícone é colocado pelo sistema. Os templates `radio` trazem o splash desativado para que o app abra direto.

## Links profundos

`deepLinksEnabled` com `deepLinkDomain` adiciona um `intent-filter` com `autoVerify` ao manifesto, e o domínio também é usado para gerar `assetlinks.json` e `.well-known/assetlinks.json`. `deepLinkPaths` aceita até dez rotas. O arquivo precisa ficar no seu domínio para que o App Links funcione: a impressão digital do certificado que ele traz é de preenchimento e precisa ser substituída (mais detalhe em [providers.md](./providers.md)).

## Ajustes da WebView

**Ação do botão Voltar (`backButtonBehavior`)** — `back` (padrão) volta no histórico e sai quando não há mais histórico; `exit` chama `finishAffinity()`; `confirm` mostra um diálogo "Deseja sair do app?"; `none` não faz nada. O patch o grava sobre `MainActivity`.

**User-Agent personalizado (`userAgent`)** — o campo existe, mas se você preencher só ativa `webContentsDebuggingEnabled: false` no `capacitor.config.json`. Não muda o UA da WebView: não conte com isso para esconder seu app atrás de outro navegador.

**Modo de cache (`cacheMode`)** — `normal`, `no-cache` ou `force-cache`. É normalizado e salvo, mas não chega a nenhum gerador: não muda o comportamento do app.

**Cabeçalhos HTTP personalizados (`customHeaders`)** — mesma situação: é aceito e aparado, sem efeito na geração.

**Injeção de JavaScript (`jsInjection`) e de estilos (`cssInjection`)** — se você os preencher, o ZIP inclui `www/inject.js` e `www/inject.css` com esse conteúdo. Eles não são adicionados sozinhos ao seu HTML: sua página tem que referenciá-los com `<script src="inject.js">` e `<link rel="stylesheet" href="inject.css">`.

**Minificar HTML (`minify`)** — remove comentários e espaços sobrando do HTML gerado e comentários de `catalog.js`. Não toca no seu JavaScript e não é um minificador de produção.

## Avisos programados

`notifyOnOpen`, `notifyOnClose` e `notifyDelayMinutes` com `notifyTitle` e `notifyText` geram um script que usa `LocalNotifications` para programar um aviso ao abrir, ao ir para o segundo plano ou após os minutos indicados. Duas condições: só é injetado se a origem for HTML, e precisa do plugin de notificações ativado.

O bloco de "canais de notificação" (`notifChannel`, `notifImportance`, `notifSound`, `notifVibration`) tem campos no estúdio, mas nenhum desses quatro valores é usado na geração: nem o canal do `RadioService` nem os avisos programados os leem. O canal do serviço de áudio se chama `inteebuild_radio` com importância baixa, e é fixo.

## Funções que são injetadas no seu site

O passo Ajustes tem um bloco de catálogo com funções que são despejadas em `catalog.js` e executadas dentro da WebView sobre a sua própria página:

- **Pull-to-refresh** — arrastar para baixo com o scroll no topo recarrega a página.
- **Offline screen** — camada fixa com o `offlineMessage` (por padrão "Sem conexão. Verifique sua internet.") e um botão de nova tentativa. É ativada com `offlineScreen`, que vem ligado exceto em `lab`.
- **Loading indicator** — `spinner` (camada centralizada), `bar` (barra de 3 px no topo) ou `none`.
- **Gaveta lateral** (`drawerEnabled`) — botão fixo no topo à esquerda que abre um painel com os `drawerItems`: até oito objetos `{label, url, icon}` em JSON.
- **Bottom navigation** (`bottomNavEnabled`) — barra inferior com até cinco `{label, url, icon}` e `padding-bottom` automático no body.
- **DownloadManager** — downloads nativos em vez de deixá-los na WebView.
- **Bloqueio de seleção** (`blockSelection`) — CSS de `user-select: none` (com exceção dos campos de texto) e prevenção do menu de contexto.
- **Detecção de root/jailbreak** (`rootDetection`) — patch `RootCheck` em `MainActivity`.
- **Encrypted Storage** — adiciona `capacitor-secure-storage-plugin` e a permissão `USE_BIOMETRIC`.

`flagSecure` não vai por aqui: é aplicado em Java, em `MainActivity`.

Se o seu HTML é quem manda, lembre-se de que o script do catálogo é injetado no `</body>` depois do seu código, e de que o viewport e o charset só são garantidos quando a origem é HTML. Se você carrega uma URL, é o seu site que precisa trazer seu próprio viewport.

## Acessibilidade e desempenho

Nada disso o gerador faz por você; é trabalho do seu HTML:

- O `meta viewport` é injetado só no modo HTML. Se a sua fonte for uma URL, adicione-o no seu site.
- Texto com contraste mínimo de 4.5:1, e 3:1 para texto grande.
- Alvos táteis de 48 dp ou mais.
- `alt` descritivo nas imagens. O Auto-Fix do analisador coloca `alt=""`, que não serve como descrição.
- Carregamento adiado de imagens e recursos com `defer` ou `async`. O analisador marca isso em `optimization`.

## Como conferir o que mudou

```bash
curl -X POST /api/project -H "Content-Type: application/json" -d '{"appName":"Mi App","url":"https://mi-web.com","accentColor":"#112233","entryAnimation":"fade","orientation":"portrait"}' -o proyecto.zip
unzip -p proyecto.zip capacitor.config.json
unzip -p proyecto.zip main-manifest.xml | grep -E "screenOrientation|keepScreenOn|cleartext"
unzip -p proyecto.zip www/index.html | tail -5
```

A última linha mostra o script do catálogo grudado no final do seu HTML. Se `entryAnimation` não aparecer em lugar nenhum, é porque não é aplicado, e aí você tem isso confirmado.

Mais sobre permissões em [permissions.md](./permissions.md), sobre o que cada build compila em [outputs.md](./outputs.md) e sobre o analisador em [analyzer.md](./analyzer.md).
