# Saídas de uma compilação

O `outputType` clássico continua aceitando três valores: `apk`, `aab` e `both`. Acima dele está `outputs`, uma lista (também aceita texto com vírgulas) que manda sobre ele: `apk`, `aab`, `xapk`, `apks`, `ipa`, `exe`, `msi`, `dmg`, `appimage`. O workflow tem um passo por formato condicionado à lista, então só roda o que você pediu, e o campo `platform` (`android`, `ios` ou `both`) decide se os jobs de Android, os de iOS ou ambos são disparados. Quando `platform` é `ios` ou `both`, o `package.json` do ZIP inclui `@capacitor/ios` para que o passo `npx cap add ios` não falhe com "Could not find the ios platform". O endpoint `GET /api/v1/build/:id` devolve `outputs` e `formats`, o segundo com o que o artefato confirma que existe de verdade.

## O que você baixa quando o build termina

Cada formato tem sua rota em `GET /api/download/:id/:fmt`; sem sufixo, assume-se APK.

- **APK** — `GET /api/download/:id` (ou `.../apk`). Instalável diretamente num dispositivo. Com o provider `flutter`, ele é composto pelo job `flutter-build`; com o provider `cordova`, pelo job `cordova-build`; não pelo do Capacitor.
- **AAB** — `GET /api/download/:id/aab`. O que sobe no Play Console. Só aparece se você pediu em `outputs`. Com o provider `flutter`, sai do job `flutter-build`; com `cordova`, tenta-se com `--packageType=bundle` (se a versão do cordova-android não suportar isso em debug, o passo não bloqueia e não há AAB).
- **XAPK** — `GET /api/download/:id/xapk`. APK base mais `AndroidManifest.json` com pacote, versão e permissões. Só se você pediu `xapk`.
- **APKS** — `GET /api/download/:id/apks`. Bundletool em modo universal, gerado a partir do AAB. Só se você pediu `apks`.
- **IPA** — `GET /api/download/:id/ipa`. Só existe se o build rodou em `macos-latest` com `.p12`, `.mobileprovision` e senha enviados no passo de assinatura iOS. Caso contrário, não há artefato e o endpoint devolve erro.
- **EXE e MSI** — `GET /api/download/:id/exe` e `.../msi`. EXE do Electron: job de `windows-latest` com `electron-builder`, só roda se você pediu esse formato e o ZIP traz `desktop/`. EXE do Tauri: se o provider é `tauri`, o job `tauri-build` sobe o binário do Cargo com o artefato `-exe`, mesmo que você não peça formato de desktop. MSI: só do Electron.
- **DMG** — `GET /api/download/:id/dmg`. Job de `macos-latest`, mesmas condições que o EXE.
- **AppImage** — `GET /api/download/:id/appimage`. Job de `ubuntu-latest`, mesmas condições.

Um formato que não esteja na lista acima devolve `404` com os formatos suportados. Os artefatos vivem no GitHub Actions e expiram aos 30 minutos; o servidor também os apaga na sua limpeza automática. O histórico (`GET /api/history`) mantém o link enquanto durar a entrada local.

Além disso, o ZIP do projeto está disponível sem compilar com `POST /api/project`, e com qualquer configuração: inclui `build-config.json`, `main-manifest.xml`, o código Java gerado, os scripts de patch e o workflow.

## O que é apenas código-fonte no ZIP

- **Desktop** — se você ativar `desktopEnabled` **ou pedir `exe`, `msi`, `dmg` ou `appimage` em `outputs`** (o motor ativa `desktopEnabled` automaticamente nesse caso), aparece `desktop/` com um projeto Electron (`package.json`, `main.js`, README) e o seletor "Desktop .EXE/.APP" do estúdio escreve essa pasta. Para gerar um binário é preciso pedir `exe`, `msi`, `dmg` ou `appimage` em `outputs`: então o workflow roda `electron-builder` no Windows, macOS ou Linux conforme o formato. `desktopPlatform` (`win`, `mac`, `both`) é validado, salvo em `build-config.json` e usado pelo gerador de `desktop/package.json` para definir os targets do `electron-builder`.
- **TWA** — `twa-manifest.json`, `assetlinks.json` e um README com o comando do bubblewrap. A Trusted Web Activity real é construída fora, com as suas ferramentas.
- **`react-native` e `ionic`** — não geram nada além de `provider.json`; o APK que sai é o do Capacitor.
## Flutter, Tauri e Cordova na CI

- **Flutter** (`provider: flutter`) — o job `flutter-build` em `ubuntu-latest` executa `flutter create` para gerar o host Android, depois coloca o seu manifesto, corrige `applicationId`/`namespace` para o seu pacote, move `MainActivity.kt` e compila com `flutter build apk --release` (mais `appbundle` se você pediu `aab`). Artefatos: `-apk` e opcional `-aab`. O job `compile` do Capacitor é pulado com este provider, então não há APK duplo.

- **Tauri** (`provider: tauri`) — o job `tauri-build` em `windows-latest` roda `cargo build --release --manifest-path tauri/src-tauri/Cargo.toml` e sobe o binário como artefato `-exe`. O projeto Electron (`desktop/`) fica de fora com este provider para não conflitar o nome do artefato, e o APK Android continua sendo gerado pelo job `compile` (continua sendo Capacitor por baixo).

- **Cordova** (`provider: cordova`) — o job `cordova-build` em `ubuntu-latest` roda `cordova platform add android` sobre o seu `config.xml` real, injeta os permissões de `main-manifest.xml` no manifesto do Cordova, copia o ícone para os `mipmap-*` e executa `cordova build android` (artefato `-apk` debug; `-aab` opcional com `continue-on-error`; `-release-apk` se você subiu o keystore, via `build.json`). O job `compile` do Capacitor é pulado com este provider: o APK é de Cordova puro.

O workflow recebe o provider como input (`provider`), que o servidor envia no `workflow_dispatch` junto com `id`, `platform` e `outputs`.

## PWA dentro do projeto

Com `pwaEnabled` ativado (vem ativado por padrão), o ZIP inclui `www/manifest.webmanifest` com nome, cores e ícone, e `www/sw.js` com cache offline e fallback para `index.html`. O registro do service worker e a tag `manifest` são injetados no seu `index.html` se ainda não estivessem.

Você não precisa hospedar nada no InteeBuild para isso: suba a pasta `www/` para o seu hosting e a web fica instalável como PWA sozinha. Desative com `pwaEnabled: false` se o seu site já traz o próprio manifest.

## Ficha da Play Store

`POST /api/listing` devolve texto pronto para colar no Play Console, gerado com regras locais e sem serviços externos:

```bash
curl -X POST /api/listing -H "Content-Type: application/json" \
  -d '{"appName":"Mi Radio","url":"https://mi-radio.com","packageName":"com.miempresa.radio","permissions":{"foreground":true}}'
```

A resposta traz `title` (truncado em 30 caracteres), `shortDescription` (80), `fullDescription` (até 4000, com as características derivadas das suas permissões e flags de UI), `keywords` (100), `category` (`Herramientas`), `packageName` e `version`. É um rascunho: vale reescrevê-lo antes de publicar.

Também há `POST /api/security-audit` (pontuação textual com incidentes de GDPR e de permissões) e `GET /api/privacy-policy?appName=&package=` (política genérica preenchida com os seus dados).

## QR de download

`GET /api/qr/:id` devolve uma imagem PNG com o QR do link de download. A imagem é gerada por um serviço externo (`api.qrserver.com`); se não responder em 8 segundos, o endpoint devolve `502` com o link de download em texto para que você possa exibi-lo.

## Minificação

A opção `minify` (ou `minify: true` na API) remove comentários HTML e espaços excedentes do código injetado. Não mexe no seu JavaScript e não é um minificador de produção: serve para que o HTML embutido pese menos.

## O que não existe

Não há build de iOS sem certificados da Apple (o job só valida no simulador; com `.p12` e `.mobileprovision` ele exporta IPA), não há loja nem distribuição própria, nem plano de pagamento algum por trás de tudo isso. O que existe são limites de uso do servidor: 10 builds por hora por IP e os tamanhos de entrada detalhados em [production.md](./production.md).
