# Выходные данные сборки

Классический `outputType` по-прежнему принимает три значения: `apk`, `aab` и `both`. Выше него расположен `outputs` — список (также принимает текст с запятыми), который имеет приоритет над ним: `apk`, `aab`, `xapk`, `apks`, `ipa`, `exe`, `msi`, `dmg`, `appimage`. В workflow для каждого формата есть отдельный шаг, привязанный к списку, поэтому выполняется только запрошенный формат, а поле `platform` (`android`, `ios` или `both`) определяет, запускать ли джобы Android, iOS или оба. Когда `platform` равно `ios` или `both`, `package.json` в ZIP включает `@capacitor/ios`, чтобы шаг `npx cap add ios` не падал с ошибкой "Could not find the ios platform". Поле `GET /api/v1/build/:id` возвращает `outputs` и `formats`, второе — с тем, что артефакт подтверждает как реально существующее.

## Что скачивается после завершения сборки

У каждого формата свой путь в `GET /api/download/:id/:fmt`; без суффикса подразумевается APK.

- **APK** — `GET /api/download/:id` (или `.../apk`). Устанавливается напрямую на устройство. При provider `flutter` его создаёт джоб `flutter-build`; при provider `cordova` — джоб `cordova-build`; а не джоб Capacitor.
- **AAB** — `GET /api/download/:id/aab`. То, что загружается в Play Console. Появляется только если вы запрашивали его в `outputs`. При provider `flutter` он получается из джоба `flutter-build`; при `cordova` пробуется с `--packageType=bundle` (если версия cordova-android не поддерживает это в debug, шаг не блокирует выполнение, и AAB не создаётся).
- **XAPK** — `GET /api/download/:id/xapk`. Базовый APK плюс `AndroidManifest.json` с пакетом, версией и разрешениями. Только если вы запрашивали `xapk`.
- **APKS** — `GET /api/download/:id/apks`. Bundletool в универсальном режиме, созданный из AAB. Только если вы запрашивали `apks`.
- **IPA** — `GET /api/download/:id/ipa`. Существует только если сборка выполнялась на `macos-latest` с отправленными на шаге подписи iOS файлами `.p12`, `.mobileprovision` и паролем. Иначе артефакта нет, и endpoint возвращает ошибку.
- **EXE и MSI** — `GET /api/download/:id/exe` и `.../msi`. EXE от Electron: джоб на `windows-latest` с `electron-builder`, выполняется только если вы запрашивали этот формат и в ZIP есть `desktop/`. EXE от Tauri: если provider — `tauri`, джоб `tauri-build` выгружает бинарный файл Cargo артефактом `-exe`, даже если вы не запрашивали десктопный формат. MSI: только от Electron.
- **DMG** — `GET /api/download/:id/dmg`. Джоб на `macos-latest`, те же условия, что и у EXE.
- **AppImage** — `GET /api/download/:id/appimage`. Джоб на `ubuntu-latest`, те же условия.

Формат, отсутствующий в списке выше, возвращает `404` со списком поддерживаемых форматов. Артефакты хранятся в GitHub Actions и устаревают через 30 минут; сервер также удаляет их при автоматической очистке. История (`GET /api/history`) сохраняет ссылку, пока существует локальная запись.

Кроме того, ZIP проекта доступен без сборки через `POST /api/project` и с любой конфигурацией: он включает `build-config.json`, `main-manifest.xml`, сгенерированный Java-код, скрипты патчей и workflow.

## Что в ZIP остаётся только исходным кодом

- **Desktop** — если вы включили `desktopEnabled` **или запросили `exe`, `msi`, `dmg` или `appimage` в `outputs`** (в этом случае движок автоматически включает `desktopEnabled`), появляется `desktop/` с проектом Electron (`package.json`, `main.js`, README), а селектор "Desktop .EXE/.APP" в студии записывает в эту папку. Чтобы получить бинарный файл, нужно запросить `exe`, `msi`, `dmg` или `appimage` в `outputs`: тогда workflow запускает `electron-builder` в Windows, macOS или Linux в зависимости от формата. `desktopPlatform` (`win`, `mac`, `both`) проверяется, сохраняется в `build-config.json` и используется генератором `desktop/package.json` для задания таргетов `electron-builder`.
- **TWA** — `twa-manifest.json`, `assetlinks.json` и README с командой bubblewrap. Настоящая Trusted Web Activity собирается отдельно, вашими инструментами.
- **`react-native` и `ionic`** — не создают ничего сверх `provider.json`; получившийся APK — это APK от Capacitor.
## Flutter, Tauri и Cordova в CI

- **Flutter** (`provider: flutter`) — джоб `flutter-build` на `ubuntu-latest` выполняет `flutter create` для создания Android-хоста, затем размещает ваш манифест, исправляет `applicationId`/`namespace` на ваш пакет, переносит `MainActivity.kt` и собирает с помощью `flutter build apk --release` (плюс `appbundle`, если вы запрашивали `aab`). Артефакты: `-apk` и опционально `-aab`. Джоб `compile` от Capacitor при этом provider пропускается, поэтому двойного APK нет.

- **Tauri** (`provider: tauri`) — джоб `tauri-build` на `windows-latest` выполняет `cargo build --release --manifest-path tauri/src-tauri/Cargo.toml` и выгружает бинарный файл артефактом `-exe`. Проект Electron (`desktop/`) при этом provider исключается, чтобы не конфликтовать с именем артефакта, а Android-APK по-прежнему создаёт джоб `compile` (под капотом это всё ещё Capacitor).

- **Cordova** (`provider: cordova`) — джоб `cordova-build` на `ubuntu-latest` выполняет `cordova platform add android` поверх вашего настоящего `config.xml`, внедряет разрешения из `main-manifest.xml` в манифест Cordova, копирует иконку в `mipmap-*` и запускает `cordova build android` (артефакт `-apk` в debug; `-aab` опционально с `continue-on-error`; `-release-apk`, если вы загрузили keystore, через `build.json`). Джоб `compile` от Capacitor при этом provider пропускается: APK — чистый Cordova.

Workflow получает provider как input (`provider`), который сервер передаёт в `workflow_dispatch` вместе с `id`, `platform` и `outputs`.

## PWA внутри проекта

При включённом `pwaEnabled` (по умолчанию включён) ZIP содержит `www/manifest.webmanifest` с названием, цветами и иконкой, а также `www/sw.js` с офлайн-кэшем и фолбэком на `index.html`. Регистрация service worker и тег `manifest` внедряются в ваш `index.html`, если их там не было.

Для этого не нужно ничего размещать на InteeBuild: загрузите папку `www/` на ваш хостинг, и сайт сам по себе станет устанавливаемым как PWA. Отключите это через `pwaEnabled: false`, если на вашем сайте уже есть собственный manifest.

## Карточка Play Store

`POST /api/listing` возвращает текст, готовый для вставки в Play Console, сгенерированный локальными правилами и без внешних сервисов:

```bash
curl -X POST /api/listing -H "Content-Type: application/json" \
  -d '{"appName":"Mi Radio","url":"https://mi-radio.com","packageName":"com.miempresa.radio","permissions":{"foreground":true}}'
```

В ответ приходят `title` (обрезано до 30 символов), `shortDescription` (80), `fullDescription` (до 4000, с характеристиками, выведенными из ваших разрешений и флагов интерфейса), `keywords` (100), `category` (`Herramientas`), `packageName` и `version`. Это черновик: перед публикацией его лучше переписать.

Также доступны `POST /api/security-audit` (текстовая оценка с замечаниями по GDPR и разрешениям) и `GET /api/privacy-policy?appName=&package=` (универсальная политика, заполненная вашими данными).

## QR-код для скачивания

`GET /api/qr/:id` возвращает PNG-изображение с QR-кодом ссылки на скачивание. Изображение генерирует внешний сервис (`api.qrserver.com`); если он не отвечает в течение 8 секунд, endpoint возвращает `502` со ссылкой на скачивание в виде текста, чтобы вы могли показать её сами.

## Минификация

Опция `minify` (или `minify: true` в API) удаляет HTML-комментарии и лишние пробелы из вставляемого кода. Она не трогает ваш JavaScript и не является продакшн-минификатором: её назначение — уменьшить вес встроенного HTML.

## Чего здесь нет

Нет сборки iOS без сертификатов Apple (джоб только проверяет в симуляторе; с `.p12` и `.mobileprovision` он действительно экспортирует IPA), нет магазина и собственной дистрибуции, а также никакого платного плана за всем этим. Что есть — так это лимиты использования сервера: 10 сборок в час на IP и указанные в [production.md](./production.md) ограничения на входные данные.
