# Permissões Android

O Permission Engine vive em `server/generator/permissions.js` e define **86 entradas** em `PERMISSION_SPEC`, cada uma com sua permissão de manifesto, se precisa de diálogo runtime, seu `minSdk`, suas dependências e a implementação nativa que é gerada. O mesmo objeto alimenta três coisas: os switches do estúdio, o `GET /api/permissions/spec` e o Audit. Se amanhã for adicionada uma entrada ao spec, ela aparece sozinha na UI.

A regra que sustenta todo o sistema é que declarar uma permissão não é o mesmo que o Android concedê-la. É por isso que o Audit olha o ZIP que será compilado, e não a configuração:

1. **Manifesto** — `main-manifest.xml` contém a linha `uses-permission`.
2. **Runtime** — `NativePermissions.java` e seu patch em `MainActivity.java` chamam `requestPermissions()` com aquele lote.
3. **Ponte WebView** — `WebChromeClient.onPermissionRequest` só faz `grant()` se a permissão estiver no manifesto e além disso tiver sido concedida; caso contrário, `deny()`.

Só o primeiro nível é automático de verdade. Que o diálogo apareça e que seu site reaja bem só se verifica em um dispositivo Android real.

## Como ler o Audit

`POST /api/permissions/audit` (ou o botão de QA no estúdio) retorna uma linha por permissão marcada:

- `GENERATED OK` — está no manifesto e tem implementação gerada. É o único estado que serve para compilar.
- `SPEC ONLY, NOT GENERATED` — você pediu, mas não foi gerado. O Audit marca como `fail` e bloqueia o build.
- `NO GENERADO` — reservado para `ads`: hoje só é emitida a configuração e o `meta-data` do AdMob, não há `AdView` nem inicialização.
- `warn` — compila, mas há algo a revisar: permissão especial de Settings, `minSdk` acima do `targetSdk`, ou provider experimental.
- `fail` — bloqueia. `gpsBackground` sem `gps` é o caso típico.

Cada linha traz um `mechanism`: `runtime` (diálogo normal), `background` (two-step), `special` (concede-se pelas Configurações), `install-time` (concede-se na instalação) ou `missing`.

Os níveis de verdade são três e convém não confundi-los: o Audit testa que o projeto *contém* a permissão; que o Android a *conceda* só se vê no dispositivo; e que a função *funcione* só se vê testando a função. Para a matriz por versão Android existe o template `lab` (Permission Test Lab), que executa cada teste a partir do próprio app.

## Sempre incluídos

`INTERNET`, `ACCESS_NETWORK_STATE` e `ACCESS_WIFI_STATE` são declarados em todos os projetos (entrada `internet` do spec). Sem eles o site não carrega e o app fica em branco. Não aparecem no Audit porque não são escolhidos.

## Notificações — `notifications`

Só são ativadas no Android 13+ (`minSdk` da entrada: 33); abaixo disso a permissão não existia e o sistema não pergunta nada. O que é gerado: `POST_NOTIFICATIONS` no manifesto, os plugins `@capacitor/local-notifications` e `@capacitor/push-notifications` em `package.json` (o estúdio os ativa sozinho ao marcar a caixa) e a ponte `Intee.notifications.schedule({title, body})`. Se você ativar o aviso programado das Configurações sem marcar esta permissão, o manifesto a adiciona mesmo assim.

O teste é direto: compile só com esta opção, instale no Android 13+, aceite o diálogo e programe um aviso com `notifyOnOpen`. Com `targetSdk < 33` o Audit retorna `warn`.

## Áudio em segundo plano — `foreground`, `wakeLock`, `foregroundService`

São três entradas do spec com o mesmo objetivo por ângulos distintos: manter o processo vivo enquanto toca áudio. `foreground` adiciona `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` e `WAKE_LOCK` (sem ele o `PARTIAL_WAKE_LOCK` lança `SecurityException` e o serviço cai), e é o único dos três que gera `RadioService.java`, `AudioBridge.java` e o patch de `MainActivity` que o inicia ao abrir. `foregroundService` declara as três linhas de serviço sem `WAKE_LOCK`, mas não gera serviço algum: traz a permissão e nada mais. `wakeLock` adiciona só `WAKE_LOCK`, sem diálogo. Se você ativar áudio nativo com URL de stream, o motor marca sozinho `foreground` e `wakeLock`, porque sem processo vivo e com a tela apagada o som é cortado. O spec avisa que a Play pede justificativa se o serviço não for de áudio ou de sincronização.

O detalhe, com o HTML que o utiliza, está todo em [foreground.md](./foreground.md).

## Câmera e microfone — `cameraMic`, `microphone`

Estão separados de propósito: a Play audita o microfone separadamente da câmera, e um app que só grava vídeo não deveria pedir `RECORD_AUDIO`.

- `cameraMic` gera `CAMERA`, `NativePermissions.request(CAMERA)` e `@capacitor/camera`.
- `microphone` gera `RECORD_AUDIO` e `MODIFY_AUDIO_SETTINGS`.

A ponte WebView confere `wants(VIDEO)` contra o manifesto e `hasPerm(CAMERA)` contra a concessão antes de fazer `grant()`. Se você não marcou câmera, `getUserMedia({video:true})` retorna `denied` a partir do app: é o comportamento esperado, não um bug.

Os splits finos do grupo são `cameraFlash`, `cameraAutoFocus`, `videoCapture` e `audioRecord`; compartilham a permissão de manifesto, mas são declarados separadamente para que o Audit possa rastrear o que você pediu.

## Armazenamento — `storage`, `readExternalStorage`, `writeExternalStorage`, `manageExternalStorage`

Com `targetSdk` 33 ou superior, `storage` gera `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` e `READ_MEDIA_AUDIO` e omite `READ_EXTERNAL_STORAGE` para não levantar avisos na Play. Com `targetSdk` abaixo disso, cai na permissão legada. `manageExternalStorage` (`MANAGE_EXTERNAL_STORAGE`, API 30+) é o de "todos os arquivos" e vai pelas Configurações, não por diálogo.

O teste: um `<input type="file" accept="image/*">` deve abrir a galeria, e um download do seu site deve aparecer no gerenciador de downloads.

## Localização — `gps`, `gpsBackground` e os splits

`gps` declara `ACCESS_FINE_LOCATION` e `ACCESS_COARSE_LOCATION` sem tocar no segundo plano. `gpsBackground` declara `ACCESS_BACKGROUND_LOCATION` e é uma entrada separada deliberadamente: no Android 11+ o sistema ignora o pedido de background se ele vier no mesmo lote que o foreground, então o runtime o pede em dois passos (`requestBackground()` depois de conceder o foreground).

O Audit retorna `fail` se você marcar background sem foreground. A Play exige ainda justificativa com vídeo demonstrando rastreamento com o app fechado; para lojas, blogs e rádios, nunca se marca.

Os splits `accessFineLocation`, `accessCoarseLocation` e `accessBackgroundLocation` existem para quem quer o nível máximo de detalhe, e `advGeo` adiciona rastreamento com `FusedLocationProvider` e geofencing (requer justificativa na Play).

## Bluetooth — `bluetoothScan`, `bluetoothConnect`, `bluetoothAdvertise`, `bluetooth`

No Android 12+ são três permissões distintas e o estúdio as apresenta como três switches: escanear (`BLUETOOTH_SCAN`), conectar (`BLUETOOTH_CONNECT`) e anunciar (`BLUETOOTH_ADVERTISE`), todas com `minSdk` 31.

`bluetooth` é a entrada legada (`BLUETOOTH` + `BLUETOOTH_ADMIN`) válida até a API 30. Se você a marcar com `targetSdk` 31 ou superior, `normalizeConfig` ativa `bluetoothScan` e `bluetoothConnect` automaticamente, em vez de deixar uma permissão morta. `bluetoothPrivileged` é de apps do sistema e não serve em um app normal.

## Alarmes exatos — escolha um

Há cinco entradas para duas permissões reais, e só uma deve estar marcada por vez:

- `alarmSchedule` → `SCHEDULE_EXACT_ALARM`. É a recomendada: o usuário pode revogá-la pelas Configurações.
- `alarmUse` → `USE_EXACT_ALARM`, só para relógio, alarme ou calendário. A Play revisa manualmente.
- `scheduleExactAlarm` e `useExactAlarm` são os splits dessas mesmas duas.
- `alarm` é o seletor legado; `normalizeConfig` o converte em `scheduleExactAlarm`.

O Audit as resolve para `special` (vão pelas Configurações) e o sistema `SpecialAccess.java` é gerado só se você marcou alguma.

## Telefone e SMS — permissões restritas na Play

`phone` agrupa `CALL_PHONE`, `READ_PHONE_STATE` e `READ_CALL_LOG`; `sms` agrupa `SEND_SMS` e `READ_SMS`. Os splits são `callPhone`, `answerPhone`, `readPhoneState`, `readPhoneNumber`, `readCallLog`, `processOutgoingCalls`, `sendSms`, `readSms`, `receiveSms` e `receiveMms`.

Todos trazem o aviso `Play Store restringido` no spec. Compilam sem problema, mas a Play só os aceita em apps cuja categoria é marcador ou mensageria. Se o seu app não é desses, não os marque.

## Contatos, calendário e sensores

`contacts` e `calendar` são os pacotes de leitura+escrita; seus splits são `readContacts`, `writeContacts`, `readCalendar` e `writeCalendar`.

`sensors` cobre `BODY_SENSORS` e `HIGH_SAMPLING_RATE_SENSORS`; os splits são `bodySensors` (runtime) e `highSamplingRateSensors` (install-time, API 31+). `activityRecognition` precisa de API 29+ e `envSensors` (Droncito) adiciona acelerômetro, giroscópio, barômetro, luz e proximidade com permissões de API 29.

## Rede, contas e WiFi

`nearby` e `nearbyWifiDevices` são a mesma chave (`NEARBY_WIFI_DEVICES`, API 33) vista por dois seletores. `changeWifiState` e `changeNetworkState` são concedidas na instalação. `getAccounts` (`GET_ACCOUNTS`) está marcado como restrito na Play.

## Acessos especiais (não são um diálogo)

- `systemAlert` / `systemAlertWindow` → `SYSTEM_ALERT_WINDOW`, concede-se com `Settings.ACTION_MANAGE_OVERLAY_PERMISSION`.
- `installPackages` / `requestInstallPackages` → `REQUEST_INSTALL_PACKAGES`, com `canRequestPackageInstalls`.
- `powerMgmt` → `WAKE_LOCK` mais `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, que abre as Configurações para tirar o app do economizador de bateria.

O Audit os marca como `warn` com `special`, mesmo que o manifesto esteja correto. É esperado: o usuário tem que conceder essa permissão manualmente.

## Resto do catálogo

- `nfc` — `NFC` sem diálogo, mais `uses-feature` e o filtro `TECH_DISCOVERED` com `nfc_tech_filter.xml` se você marcar.
- `vibration` / `vibrate` — `VIBRATE`, install-time. Os dois seletores apontam para a mesma permissão.
- `biometric` (`USE_BIOMETRIC`, API 28+) e `fingerprint` (`USE_FINGERPRINT`, até API 27): marcar a legada ativa `biometric`.
- `infrared` — `TRANSMIT_IR`, só em dispositivos com IR.
- `ads` — só config do AdMob: o manifesto traz o `meta-data APPLICATION_ID` e o plugin, mas não há código de anúncios. O Audit o retorna como NO GENERADO e bloqueia builds que o selecionem.
- `foregroundService` — as mesmas três permissões de manifesto de `foreground`, sem o serviço.
- `internet` — a entrada base de rede (`INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`): todo projeto a inclui, com ou sem esta caixa.

## Droncito Pack

O Droncito Pack são **18 entradas do spec** (`ar`, `voiceRec`, `envSensors`, `aiSuite`, `powerMgmt`, `adaptiveNotif`, `advSecurity`, `dynamicUI`, `socialAnalytics`, `advGeo`, `dataAnalytics`, `vr`, `blockchain`, `rpa`, `vulnScan`, `emoAI`, `iot`, `mr`) que se resolvem em um único arquivo `DroncitoBridge.java` injetado por patch, mais dependências do Gradle que são adicionadas com `patch-droncito-gradle.js` quando necessário (ARCore, ML Kit, SceneView, GVR). Na web, usam-se com `Intee.ar.*`, `Intee.voice.*`, `Intee.ai.*`, `Intee.chain.*`, `Intee.iot.*` e companhia.

Três avisos que o próprio spec registra: `ar`, `vr` e `mr` aumentam o peso do APK de forma apreciável (ARCore/GVR) e só funcionam em dispositivos compatíveis; `blockchain` guarda chaves no Keystore do Android e convém testá-la em testnet; `iot` adiciona Bluetooth e localização por cima do que você marcar.

## Como funciona o runtime por dentro

1. `NativePermissions.java` é gerado com um array `BATCH[]` exatamente com suas permissões runtime: sem background, sem `MANAGE_EXTERNAL_STORAGE`. `requestAll()` pede só o declarado e não concedido.
2. `ACCESS_BACKGROUND_LOCATION` vai em dois passos: `requestBackground()` é chamado só depois de conceder o foreground.
3. `SpecialAccess.java` abre as Configurações para overlay, instalador, alarmes exatos e gerenciamento de armazenamento. É gerado só se você pediu.
4. `patch-permissions.js` injeta `onPermissionRequest` com grant seletivo (VIDEO para câmera, AUDIO para microfone, GEO para localização) e `deny()` por padrão.
5. O manifesto declara `uses-feature ... required="false"` para câmera, Bluetooth LE, GPS, NFC e microfone, e adiciona o filtro NFC só quando cabe.
6. No log do workflow aparecem `permisos nativos instalados`, `accesos especiales instalados` e `filtro NFC instalado`.

## Ordem de testes recomendada

Uma permissão por build, nesta ordem:

1. HTML mínimo só com `INTERNET`: instalar, abrir e conferir que não pede nada.
2. Câmera: `getUserMedia({video:true})` deve disparar o diálogo.
3. GPS: `navigator.geolocation.getCurrentPosition` deve pedir localização.
4. Notificações no Android 13+: deve perguntar ao abrir.
5. Bluetooth Scan + Connect: `navigator.bluetooth.requestDevice()` deve pedir Bluetooth.

Se um build pede algo que você não marcou, o motor está colocando a mais: abra uma issue com o `build-config.json` e o resultado do Audit.

## Depois do build

Dois endpoints servem para a revisão de release:

- `POST /api/manifest-diff` compara o pedido com o gerado e retorna `MATCH` ou `MISSING` por permissão, mais os inesperados.
- `POST /api/inspect` (máximo 30 MB de APK) retorna a ficha do pacote com um score.

Convém passar pelos dois antes de subir para a Play. O resto do fluxo está em [production.md](./production.md) e os erros frequentes em [troubleshooting.md](./troubleshooting.md).
