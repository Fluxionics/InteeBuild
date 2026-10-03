# Providers: какой движок рендерит ваше приложение

Provider определяет, какой `MainActivity` и какой стек рендеринга получит ваше приложение. Его выбирают на шаге **Приложение**, в карточке провайдера, или полем `provider` в API. Значение сохраняется в `provider.json` внутри ZIP, а workflow читает его на шаге `Apply provider WebView (pro)`.

Прежде чем перейти к таблице состояний, важная мысль: **семейств три**. `capacitor`, `native`, `twa` и `gecko` (и алиасы `react-native`/`ionic`) собирают один и тот же проект Gradle: workflow добавляет платформу Android Capacitor и запускает Gradle; единственное отличие — заменяет ли provider `MainActivity`. `cordova` приносит собственный проект и собственный job (`cordova-build`) с настоящим toolchain Cordova. `flutter` и `tauri` тоже приносят свой проект и свой job: Flutter не трогает Gradle Capacitor, а Tauri собирается через Cargo в Windows.

## Сравнительная таблица

| Provider | Что генерирует сегодня | Собирается в CI | Подходит для |
|---|---|---|---|
| **Capacitor** (по умолчанию) | Полный проект Capacitor: `MainActivity extends BridgeActivity`, npm-плагины, InteeBridge, конфигурация Ads | APK + AAB | Полный контроль в экосистеме npm |
| **Native WebView** | Готовая `MainActivity` на Java: WebView, разрешения времени выполнения, RadioService, AudioBridge, DownloadManager, выбор файлов | APK | Лёгкий APK и быстрый запуск без зависимостей |
| **GeckoView** | `MainActivity` с GeckoView + `PermissionDelegate`, запрос файлов, загрузки (`onExternalResponse`) и патч Gradle Mozilla | APK | Чистый движок Mozilla, изоляция от Chromium |
| **TWA** | `twa-manifest.json` + `assetlinks.json` (APK по-прежнему основной путь WebView) | APK | PWA с Digital Asset Links |
| **Cordova** | Настоящий `config.xml` (SDK, ориентация, fullscreen) + платформа `cordova-android` в CI | APK (+AAB) (`cordova-build`) | работа в toolchain Cordova |
| **Flutter** | Проект Flutter: `pubspec.yaml`, `main.dart`, ресурсы, собственный манифест | APK + AAB (`flutter-build`) | если ваше приложение уже живёт во Flutter |
| **Tauri** | `tauri/src-tauri` (Rust): `Cargo.toml`, `tauri.conf.json`, `main.rs`, значки | Настольный EXE (`tauri-build`) | настольные приложения с WebView2 |

Намеренно не реализованы: **NativeScript** (ещё один полный runtime, который надо поддерживать) и **webapkify** (служит только справкой: не собирается). Собственный «WebToApp» из плана — это как раз provider `native`. TWA не запускает bubblewrap в CI: только отдаёт манифесты.

## Реальные состояния

- **`capacitor` (по умолчанию)** — генерирует полный проект Capacitor: `capacitor.config.json`, зависимости `@capacitor/*`, `MainActivity extends BridgeActivity`. Единственный, у кого проверены все патчи: разрешения времени выполнения, специальные доступы, DownloadManager, нативное аудио, Droncito Pack.
- **`native`** — генерирует `native-MainActivity.java` (класс `AppCompatActivity` с `WebView`, избирательным предоставлением разрешений, встроенными запуском `RadioService` и `AudioBridge`, `DownloadListener`, ставящим задачи в `DownloadManager` — с `ibFileName()` из `Content-Disposition` или URL и фолбэком на `ACTION_VIEW` — и `onShowFileChooser`, открывающим `ACTION_GET_CONTENT` с `EXTRA_MIME_TYPES`/`EXTRA_ALLOW_MULTIPLE` и возвращающим `Uri` через `onActivityResult` с `ValueCallback`), а workflow копирует его как `MainActivity.java`. Лёгкий вывод и быстрый запуск ценой отсутствия runtime Capacitor: npm-плагинов нет, а `inteebridge.js` работает только в методах с веб-фолбэком (`share`, `vibrate`, `clipboard`, `storage`, `toast`, `dialog`); зависящие от плагина (`Intee.location()`, `Intee.camera()`, `Intee.notifications.schedule()`) отвечают отказом «недоступно». `InteeAudio` работает, потому что нативный мост вставлен прямо в класс. Загрузки можно отключить через `downloadManager: false` в конфигурации.
- **`gecko`** — генерирует `gecko-MainActivity.java` (класс `AppCompatActivity`, создающий `GeckoView`, открывающий URL и встраивающий разрешения через `PermissionDelegate` от GeckoView: запрашивает Android-разрешения с кодом 4101 и возвращает `grant`/`reject` сессии, плюс запуск `RadioService`, если есть `foreground`) и `patch-gecko-gradle.js`, вставляющий зависимость `org.mozilla.geckoview:geckoview` и репозиторий `https://maven.mozilla.org/maven2` в `build.gradle`. Workflow применяет его на шаге `Apply GeckoView dependencies`, поэтому ничего вручную делать не нужно. Для всего остального APK использует runtime разрешений Capacitor. Выбор файлов идёт через `PromptDelegate.onFilePrompt` (возвращает `GeckoResult<PromptResponse>` и разрешается в `onActivityResult` через `FilePrompt.confirm(Context, Uri[])` или `FilePrompt.dismiss()`), а загрузки — через `ContentDelegate.onExternalResponse`: сначала пробуется `DownloadManager` с `Content-Disposition`/URL, и если URL нельзя скачать повторно, `body` копируется в «Загрузки» в отдельном потоке. Известное ограничение: GeckoView не предоставляет `addJavascriptInterface`, поэтому **`window.InteeAudio` не существует** и моста `Intee.*` при этом provider нет (runtime передачи из `catalog.js` это обнаруживает и ничего не делает: при выключенном экране аудио WebView прерывается). AAR GeckoView весит ~200 МБ, загрузка медленная и происходит при каждой сборке.
- **`twa`** — генерирует `twa-manifest.json` и `assetlinks.json`, чтобы вы собрали Trusted Web Activity через bubblewrap (вложенный README это указывает: `bubblewrap build --manifest=twa-manifest.json`). APK, который собирает workflow, по-прежнему обычное WebView-приложение с runtime Capacitor; это не TWA. Кроме того, отпечаток `sha256_cert_fingerprints` в `assetlinks.json` генерируется из нулей-заглушек: перед загрузкой в `/.well-known/` его нужно заменить на реальный отпечаток вашего сертификата подписи.
- **`cordova`** — записывает настоящий `config.xml` в корень ZIP (`<content src>`, `access`/`allow-intent`, `Orientation`, `Fullscreen`, `BackgroundColor` и настройки `android-minSdkVersion`/`android-targetSdkVersion`/`android-compileSdkVersion` с вашими версиями), а в CI запускает job **`cordova-build`**: `cordova platform add android`, вставка `<uses-permission>`/`<uses-feature>` из `main-manifest.xml` в сгенерированный манифест (плюс `INTERNET` и `usesCleartextTraffic`, если применимо), копирование значка в `mipmap-*` и `cordova build android` (APK debug; AAB, если запрошен, с `continue-on-error`; release, подписанный вашим keystore через `build.json`). Job `compile` Capacitor при этом provider пропускается. Чего он **не** наследует: пакетного runtime `NativePermissions`, `SpecialAccess`, `RadioService`/`AudioBridge` и `InteeBridge` (сайт работает в стандартной `CordovaWebView`); на iOS сборка идёт через Capacitor. Аудит трактует его как `CI_ANDROID` (собирает APK в CI, разрешения — через runtime приложения).
- **`flutter`** — записывает `flutter/pubspec.yaml` (webview_flutter 4 + permission_handler), `flutter/lib/main.dart` (WebView с `loadFlutterAsset('assets/www/index.html')` или `loadRequest` для URL, контроллер инициализируется в `initState`), собственный `AndroidManifest.xml` без `package=` (AGP 8 использует `namespace` из Gradle скелета), `flutter/assets/www/*` с вашим сайтом и README. В CI job `flutter-build` выполняет `flutter create` для генерации Android-хоста, копирует поверх ваш манифест, подставляет `applicationId`/`namespace` вашего пакета, переносит `MainActivity.kt` в правильный пакет и собирает: артефакты `-apk` и (если запрошен `aab`) `-aab`. Job `compile` Capacitor при этом provider пропускается.
- **`tauri`** — записывает `tauri/src-tauri/Cargo.toml`, `tauri/src-tauri/build.rs`, `tauri/src-tauri/tauri.conf.json` (`distDir: ../../www`, CSP с `unsafe-inline` для вставляемых скриптов), `tauri/src-tauri/src/main.rs`, значки (`icons/*.png`, `icon.ico`, `icon.icns`, изготовленные из вашего PNG; если значок не в формате PNG, ключ `bundle.icon` пропускается) и README. В CI job `tauri-build` выполняет `cargo build --release` на `windows-latest` и загружает артефакт `-exe`. Проект Electron (`desktop/`) при этом provider отключается, чтобы не перезаписывать артефакт `.exe`; Android APK из job `compile` остаётся от Capacitor.
- **`react-native`** и **`ionic`** — допустимые значения в `normalizeConfig`, но ничего своего не генерируют: остаётся только `provider.json` с этим именем, а workflow собирает их как Capacitor. В студии они не отображаются.

Переключатели студии отмечают `capacitor`, `native`, `twa`, `gecko`, `cordova`, `flutter` и `tauri` в `READY` (все семь собираются в CI); `react-native` и `ionic` не появляются.

## Как это изменить

Через API:

```bash
curl -X POST /api/build -H "Content-Type: application/json" \
  -d '{"appName":"Mi App","url":"https://mi-web.com","provider":"native"}'
```

В ZIP всегда есть `provider.json`:

```json
{ "provider": "native", "version": "7", "webview": "Native WebView" }
```

## Что по-настоящему отличает `capacitor` от `native`

Capacitor приносит полный мост (`Capacitor`, npm-плагины, `BridgeActivity`) и поэтому поддерживает весь каталог плагинов и `InteeBridge`. Нативный provider меняет три вещи: `MainActivity` — собственный класс, загружающий URL или `file:///android_asset/public/index.html`, разрешения времени выполнения и спецдоступы вызываются прямо из этого класса, а npm-плагинов Capacitor нет.

Если переходите с `capacitor` на `native`, снова проверьте Аудит: каждое разрешение, чей `providerOk` не включает новый provider, переходит в `WARN` (те, что не объявляют этот список, остаются в `OK`), и это снижает показатель готовности, хотя сборку не блокирует.

## Совместимость с разрешениями

Аудит добавляет к каждой строке колонку `provider`:

- `OK (<provider>)` — provider в состоянии `READY`, и у разрешения есть объявленная реализация для его runtime.
- `WARN (<provider> sin handler declarado para este permiso)` — provider в `READY`, но это разрешение не объявляет обработчик для его runtime (APK всё равно собирается).
- `WARN (<provider> compila APK en CI, permisos por runtime de la app)` — для `flutter`, `tauri`, `react-native`, `ionic` и `cordova`: APK собирается по указанному пути, а разрешениями управляет соответствующий runtime.

Наглядный пример того, почему это важно: NFC с `NDEFReader` работает в Chromium (Capacitor и Native), но в Gecko Аудит возвращает `WARN`.

## Реклама (AdMob): текущее состояние

Генератор выдаёт конфигурацию, а не интеграцию. Если отметить `ads` и заполнить `admobAppId`, в ZIP окажется `admob-config.json`, в манифесте будет `meta-data APPLICATION_ID`, а `normalizeConfig` включит плагин `@capacitor-community/admob`.

Что **не** генерируется: инициализация `MobileAds`, `AdView`, а также код interstitial и rewarded. Аудит явно возвращает `NO GENERADO (requiere AdMob App ID + SDK, no incluido)` и трактует это как `fail`, поэтому сборка с отмеченным `ads` блокируется, пока реализация не появится.

## Аутентификация домена (assetlinks)

`assetlinks.json` генерируется всегда, когда есть домен (поле `twaDomain`, домен глубоких ссылок или хост вашего URL) и также копируется в `.well-known/assetlinks.json`. Подходит и для App Links, и для TWA. Помните сказанное выше: отпечаток сертификата в нём — заглушка.

Больше о том, что раскрывает собранное приложение, — в [security.md](./security.md); о том, что реально собирается, — в [outputs.md](./outputs.md).
