# Providers: qual motor renderiza seu app

O provider decide qual `MainActivity` e qual stack de renderização o seu app recebe. Ele é escolhido no passo **Aplicação**, no cartão de provedor, ou pelo campo `provider` da API. O valor é salvo em `provider.json` dentro do ZIP e o workflow o lê no passo `Apply provider WebView (pro)`.

Antes da tabela de estados, a ideia que vale ter clara: **há três famílias**. `capacitor`, `native`, `twa` e `gecko` (e os aliases `react-native`/`ionic`) compilam todos o mesmo projeto Gradle: o workflow adiciona a plataforma Android do Capacitor e executa o Gradle; o único que muda é se o provider substitui a `MainActivity`. `cordova` traz seu próprio projeto e seu próprio job (`cordova-build`) com a toolchain real do Cordova. `flutter` e `tauri` também trazem seu projeto e seu job: o Flutter não toca no Gradle do Capacitor e o Tauri compila com Cargo no Windows.

## Tabela comparativa

| Provider | O que gera hoje | Compila no CI | Ideal para |
|---|---|---|---|
| **Capacitor** (default) | Projeto Capacitor completo: `MainActivity extends BridgeActivity`, plugins npm, InteeBridge, config de Ads | APK + AAB | Controle total com o ecossistema npm |
| **Native WebView** | `MainActivity` Java pronta: WebView, permissões runtime, RadioService, AudioBridge, DownloadManager, file chooser | APK | APK leve e inicialização rápida, sem dependências |
| **GeckoView** | `MainActivity` com GeckoView + `PermissionDelegate`, file prompt, downloads (`onExternalResponse`) e patch Gradle Mozilla | APK | Motor Mozilla puro, isolamento do Chromium |
| **TWA** | `twa-manifest.json` + `assetlinks.json` (o APK continua sendo a rota WebView) | APK | PWA com Digital Asset Links |
| **Cordova** | `config.xml` real (SDK, orientação, fullscreen) + plataforma `cordova-android` no CI | APK (+AAB) (`cordova-build`) | viver na toolchain do Cordova |
| **Flutter** | Projeto Flutter: `pubspec.yaml`, `main.dart`, assets, manifesto próprio | APK + AAB (`flutter-build`) | se seu app já vive em Flutter |
| **Tauri** | `tauri/src-tauri` (Rust): `Cargo.toml`, `tauri.conf.json`, `main.rs`, ícones | EXE de desktop (`tauri-build`) | apps de desktop com WebView2 |

Não estão implementados de propósito: **NativeScript** (outro runtime completo para manter) e **webapkify** (serve apenas de referência: não compila). O "WebToApp próprio" do plano é justamente o provider `native`. O TWA não roda o bubblewrap no CI: só entrega os manifestos.

## Estados reais

- **`capacitor` (por padrão)** — gera o projeto Capacitor completo: `capacitor.config.json`, dependências `@capacitor/*`, `MainActivity extends BridgeActivity`. É o único com todos os patches testados: permissões runtime, acessos especiais, DownloadManager, áudio nativo, Droncito Pack.
- **`native`** — gera `native-MainActivity.java` (uma `AppCompatActivity` com `WebView`, concessão seletiva de permissões, inicialização de `RadioService` e `AudioBridge` embutidos, `DownloadListener` que enfileira no `DownloadManager` — com `ibFileName()` a partir do `Content-Disposition` ou da URL, e fallback para `ACTION_VIEW` — e `onShowFileChooser` que abre `ACTION_GET_CONTENT` com `EXTRA_MIME_TYPES`/`EXTRA_ALLOW_MULTIPLE` e retorna os `Uri` por `onActivityResult` com `ValueCallback`) e o workflow o copia como `MainActivity.java`. Saída leve e inicialização rápida, em troca de não ter o runtime do Capacitor: os plugins npm não existem e `inteebridge.js` só funciona nos métodos com fallback web (`share`, `vibrate`, `clipboard`, `storage`, `toast`, `dialog`); os que dependem de um plugin (`Intee.location()`, `Intee.camera()`, `Intee.notifications.schedule()`) retornam "não disponível". O `InteeAudio` funciona sim, porque a ponte nativa é injetada na própria classe. Os downloads podem ser desativados com `downloadManager: false` na config.
- **`gecko`** — gera `gecko-MainActivity.java` (uma `AppCompatActivity` que cria um `GeckoView`, abre a URL e embute os permissões com um `PermissionDelegate` do GeckoView: pede as permissões Android com código 4101 e retorna `grant`/`reject` para a sessão, mais a inicialização do `RadioService` se houver `foreground`) e `patch-gecko-gradle.js`, que injeta a dependência `org.mozilla.geckoview:geckoview` e o repositório `https://maven.mozilla.org/maven2` nos `build.gradle`. O workflow o aplica no passo `Apply GeckoView dependencies`, então compila sem tocar em nada manualmente. O APK usa o runtime de permissões do Capacitor para todo o resto. O file chooser passa por `PromptDelegate.onFilePrompt` (retorna um `GeckoResult<PromptResponse>` e o resolve a partir de `onActivityResult` com `FilePrompt.confirm(Context, Uri[])` ou `FilePrompt.dismiss()`), e os downloads por `ContentDelegate.onExternalResponse`: primeiro tenta o `DownloadManager` com `Content-Disposition`/URL e, se a URL não puder ser baixada de novo, copia o `body` para Downloads em uma thread. Limitação conhecida: o GeckoView não expõe `addJavascriptInterface`, então **não existe `window.InteeAudio`** nem a ponte `Intee.*` neste provider (o runtime de transferência do `catalog.js` detecta e fica sem fazer nada: com a tela apagada o áudio da WebView é cortado). O AAR do GeckoView pesa ~200 MB, o download é lento e acontece em cada build.
- **`twa`** — gera `twa-manifest.json` e `assetlinks.json` para que você construa a Trusted Web Activity com o bubblewrap (o README incluído indica: `bubblewrap build --manifest=twa-manifest.json`). O APK que o workflow compila continua sendo o app WebView normal com runtime Capacitor; não é uma TWA. Além disso, a impressão `sha256_cert_fingerprints` do `assetlinks.json` é gerada com zeros de preenchimento: é preciso substituí-la pela impressão real do seu certificado de assinatura antes de subi-la para `/.well-known/`.
- **`cordova`** — grava um `config.xml` real na raiz do ZIP (`<content src>`, `access`/`allow-intent`, `Orientation`, `Fullscreen`, `BackgroundColor` e as preferences `android-minSdkVersion`/`android-targetSdkVersion`/`android-compileSdkVersion` com suas versões) e no CI roda o job **`cordova-build`**: `cordova platform add android`, injeção dos `<uses-permission>`/`<uses-feature>` do `main-manifest.xml` no manifesto gerado (mais `INTERNET` e `usesCleartextTraffic` se aplicável), ícone copiado para os `mipmap-*`, e `cordova build android` (APK debug; AAB se você pediu, com `continue-on-error`; release assinado com seu keystore via `build.json`). O job `compile` do Capacitor é pulado com este provider. O que **não** herda: o runtime em lote `NativePermissions`, `SpecialAccess`, `RadioService`/`AudioBridge` nem `InteeBridge` (a web roda na `CordovaWebView` padrão); no iOS a compilação continua pelo Capacitor. O Audit o trata como `CI_ANDROID` (compila APK no CI, permissões pelo runtime do app).
- **`flutter`** — grava `flutter/pubspec.yaml` (webview_flutter 4 + permission_handler), `flutter/lib/main.dart` (WebView com `loadFlutterAsset('assets/www/index.html')` ou `loadRequest` para URL, controlador inicializado em `initState`), um `AndroidManifest.xml` próprio sem `package=` (o AGP 8 usa o `namespace` do Gradle do scaffold), `flutter/assets/www/*` com o seu site e um README. No CI o job `flutter-build` executa `flutter create` para gerar o host Android, copia seu manifesto por cima, ajusta `applicationId`/`namespace` para o seu pacote, move `MainActivity.kt` para o pacote correto e compila: artefatos `-apk` e (se você pediu `aab`) `-aab`. O job `compile` do Capacitor é pulado com este provider.
- **`tauri`** — grava `tauri/src-tauri/Cargo.toml`, `tauri/src-tauri/build.rs`, `tauri/src-tauri/tauri.conf.json` (`distDir: ../../www`, CSP com `unsafe-inline` para os scripts injetados), `tauri/src-tauri/src/main.rs`, ícones (`icons/*.png`, `icon.ico`, `icon.icns` fabricados a partir do seu PNG; se seu ícone não for PNG, a chave `bundle.icon` é omitida) e um README. No CI o job `tauri-build` roda `cargo build --release` em `windows-latest` e sobe o artefato `-exe`. O projeto Electron (`desktop/`) fica desativado com este provider para não pisar no artefato `.exe`; o APK Android que sai do job `compile` continua sendo o do Capacitor.
- **`react-native`** e **`ionic`** — são valores válidos em `normalizeConfig`, mas não geram nada próprio: só fica `provider.json` com esse nome, e o workflow os compila como se fossem Capacitor. Não aparecem no estúdio.

Os switches do estúdio marcam `capacitor`, `native`, `twa`, `gecko`, `cordova`, `flutter` e `tauri` em `READY` (os sete compilam no CI); `react-native` e `ionic` não aparecem.

## Como mudar

Pela API:

```bash
curl -X POST /api/build -H "Content-Type: application/json" \
  -d '{"appName":"Mi App","url":"https://mi-web.com","provider":"native"}'
```

O ZIP sempre traz `provider.json`:

```json
{ "provider": "native", "version": "7", "webview": "Native WebView" }
```

## O que muda de verdade entre `capacitor` e `native`

O Capacitor traz a ponte completa (`Capacitor`, plugins npm, `BridgeActivity`) e por isso suporta todo o catálogo de plugins e o `InteeBridge`. O provider nativo muda três coisas: o `MainActivity` é uma classe própria que carrega a URL ou `file:///android_asset/public/index.html`, as permissões runtime e os acessos especiais são invocados diretamente dessa classe, e os plugins npm do Capacitor não existem.

Se você vem de `capacitor` e muda para `native`, revise o Audit de novo: cada permissão cujo `providerOk` não incluir o novo provider passa para `WARN` (as que não declaram essa lista continuam em `OK`), e isso faz o readiness baixar, embora não bloquee o build.

## Compatibilidade com permissões

O Audit adiciona uma coluna `provider` por linha:

- `OK (<provider>)` — o provider está em `READY` e a permissão tem implementação declarada para seu runtime.
- `WARN (<provider> sin handler declarado para este permiso)` — o provider está em `READY`, mas essa permissão não declara handler para seu runtime (o APK compila mesmo assim).
- `WARN (<provider> compila APK en CI, permisos por runtime de la app)` — para `flutter`, `tauri`, `react-native`, `ionic` e `cordova`: o APK é montado pela rota indicada e as permissões são gerenciadas pelo runtime correspondente.

Um exemplo concreto de por que isso importa: NFC com `NDEFReader` funciona no Chromium (Capacitor e Native), mas no Gecko o Audit retorna `WARN`.

## Anúncios (AdMob): estado atual

O gerador emite configuração, não integração. Se você marcar `ads` e preencher `admobAppId`, o ZIP inclui `admob-config.json`, o manifesto traz o `meta-data APPLICATION_ID`, e `normalizeConfig` ativa o plugin `@capacitor-community/admob`.

O que **não** é gerado: inicialização de `MobileAds`, `AdView`, nem código de interstitial nem de rewarded. O Audit retorna isso explicitamente como `NO GENERADO (requiere AdMob App ID + SDK, no incluido)` e o trata como `fail`, então um build com `ads` marcado fica bloqueado até que exista a implementação.

## Autenticação de domínio (assetlinks)

`assetlinks.json` é gerado sempre que há um domínio (campo `twaDomain`, domínio de deep links ou o hostname da sua URL) e também é copiado para `.well-known/assetlinks.json`. Serve tanto para App Links quanto para TWA. Lembre-se do que foi dito acima: a impressão do certificado que ele traz é de preenchimento.

Mais sobre o que o app gerado expõe em [security.md](./security.md); sobre o que realmente compila, em [outputs.md](./outputs.md).
