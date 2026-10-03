# Разрешения Android

Permission Engine находится в `server/generator/permissions.js` и определяет **86 записей** в `PERMISSION_SPEC`, каждая со своим разрешением в манифесте, признаком необходимости диалога во время выполнения, своим `minSdk`, зависимостями и генерируемой нативной реализацией. Тот же объект питает три вещи: переключатели в студии, `GET /api/permissions/spec` и Аудит. Если завтра в spec добавят запись, она сама появится в интерфейсе.

Правило, на котором держится вся система: объявить разрешение — не значит, что Android его предоставит. Поэтому Аудит смотрит на ZIP, который будет собираться, а не на конфигурацию:

1. **Манифест** — `main-manifest.xml` содержит строку `uses-permission`.
2. **Во время выполнения** — `NativePermissions.java` и его патч в `MainActivity.java` вызывают `requestPermissions()` с этим набором.
3. **Мост WebView** — `WebChromeClient.onPermissionRequest` делает `grant()` только если разрешение есть в манифесте и к тому же было предоставлено; иначе `deny()`.

По-настоящему автоматичен только первый уровень. Появляется ли диалог и корректно ли реагирует ваша веб-страница, проверяется на реальном Android-устройстве.

## Как читать Аудит

`POST /api/permissions/audit` (или кнопка QA в студии) возвращает строку на каждое отмеченное разрешение:

- `GENERATED OK` — есть в манифесте и имеет сгенерированную реализацию. Единственное состояние, пригодное для сборки.
- `SPEC ONLY, NOT GENERATED` — вы его запросили, но он не был сгенерирован. Аудит помечает его `fail` и блокирует сборку.
- `NO GENERADO` — зарезервировано для `ads`: сегодня выдаётся только конфигурация и `meta-data` AdMob, без `AdView` и инициализации.
- `warn` — собирается, но есть что проверить: спецразрешение из «Настроек», `minSdk` выше `targetSdk` или экспериментальный provider.
- `fail` — блокирует. Типичный случай — `gpsBackground` без `gps`.

У каждой строки есть `mechanism`: `runtime` (обычный диалог), `background` (двухшаговый), `special` (предоставляется в «Настройках»), `install-time` (предоставляется при установке) или `missing`.

Уровней проверки три, и их не стоит путать: Аудит проверяет, что проект *содержит* разрешение; *предоставляет* ли его Android — видно только на устройстве; работает ли функция — видно только при проверке самой функции. Для матрицы по версиям Android есть шаблон `lab` (Permission Test Lab), который выполняет каждый тест прямо из приложения.

## Всегда включены

`INTERNET`, `ACCESS_NETWORK_STATE` и `ACCESS_WIFI_STATE` объявляются во всех проектах (запись `internet` в spec). Без них веб-страница не загрузится, а приложение останется пустым. В Аудите они не появляются, потому что их не выбирают.

## Уведомления — `notifications`

Включаются только на Android 13+ (`minSdk` записи: 33); ниже разрешения не существовало и система ничего не спрашивает. Что генерируется: `POST_NOTIFICATIONS` в манифесте, плагины `@capacitor/local-notifications` и `@capacitor/push-notifications` в `package.json` (студия включает их сама при установке флажка) и мост `Intee.notifications.schedule({title, body})`. Если включить отложенное уведомление в «Настройках», не отмечая это разрешение, манифест добавит его всё равно.

Проверка прямая: соберите только с этой опцией, установите на Android 13+, примите диалог и запланируйте уведомление через `notifyOnOpen`. При `targetSdk < 33` Аудит возвращает `warn`.

## Фоновое аудио — `foreground`, `wakeLock`, `foregroundService`

Это три записи spec с одной целью, но с разных сторон: удержать процесс живым, пока звучит аудио. `foreground` добавляет `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` и `WAKE_LOCK` (без него `PARTIAL_WAKE_LOCK` бросает `SecurityException` и сервис падает), и это единственный из трёх, кто генерирует `RadioService.java`, `AudioBridge.java` и патч `MainActivity`, запускающий сервис при открытии. `foregroundService` объявляет три строки сервиса без `WAKE_LOCK`, но не генерирует никакого сервиса: даёт разрешение и больше ничего. `wakeLock` добавляет только `WAKE_LOCK`, без диалога. Если включить нативное аудио с URL потока, движок сам отмечает `foreground` и `wakeLock`, потому что без живого процесса и при выключенном экране звук прервётся. В spec есть предупреждение: Play требует обоснования, если сервис не относится к аудио или синхронизации.

Подробности с HTML, который это использует, — в [foreground.md](./foreground.md).

## Камера и микрофон — `cameraMic`, `microphone`

Они намеренно разделены: Play проверяет микрофон отдельно от камеры, а приложение, которое только записывает видео, не должно запрашивать `RECORD_AUDIO`.

- `cameraMic` генерирует `CAMERA`, `NativePermissions.request(CAMERA)` и `@capacitor/camera`.
- `microphone` генерирует `RECORD_AUDIO` и `MODIFY_AUDIO_SETTINGS`.

Перед `grant()` мост WebView сверяет `wants(VIDEO)` с манифестом, а `hasPerm(CAMERA)` — с предоставленным разрешением. Если камеру не отмечали, `getUserMedia({video:true})` вернёт `denied` прямо из приложения: это ожидаемое поведение, а не баг.

Мелкие разбивки группы — `cameraFlash`, `cameraAutoFocus`, `videoCapture` и `audioRecord`; они делят одно разрешение манифеста, но объявляются отдельно, чтобы Аудит мог отследить, что именно вы запросили.

## Хранилище — `storage`, `readExternalStorage`, `writeExternalStorage`, `manageExternalStorage`

При `targetSdk` 33 и выше `storage` генерирует `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` и `READ_MEDIA_AUDIO` и пропускает `READ_EXTERNAL_STORAGE`, чтобы не вызывать предупреждений в Play. При более низком `targetSdk` используется устаревшее разрешение. `manageExternalStorage` (`MANAGE_EXTERNAL_STORAGE`, API 30+) — это «все файлы»; оно предоставляется через «Настройки», а не диалогом.

Проверка: `<input type="file" accept="image/*">` должен открывать галерею, а загрузка с вашего сайта — появляться в менеджере загрузок.

## Геолокация — `gps`, `gpsBackground` и разбивки

`gps` объявляет `ACCESS_FINE_LOCATION` и `ACCESS_COARSE_LOCATION`, не трогая фоновый режим. `gpsBackground` объявляет `ACCESS_BACKGROUND_LOCATION` и намеренно является отдельной записью: на Android 11+ система игнорирует фоновый запрос, если он идёт в том же наборе, что и передний план, поэтому во время выполнения он запрашивается в два шага (`requestBackground()` после предоставления foreground).

Аудит возвращает `fail`, если отметить background без foreground. Play к тому же требует обоснования с видео, демонстрирующим отслеживание при закрытом приложении; для магазинов, блогов и радио это никогда не отмечают.

Разбивки `accessFineLocation`, `accessCoarseLocation` и `accessBackgroundLocation` нужны для тех, кто хочет максимальную детализацию, а `advGeo` добавляет отслеживание через `FusedLocationProvider` и геозоны (требует обоснования в Play).

## Bluetooth — `bluetoothScan`, `bluetoothConnect`, `bluetoothAdvertise`, `bluetooth`

На Android 12+ это три разных разрешения, и студия показывает их как три переключателя: сканирование (`BLUETOOTH_SCAN`), подключение (`BLUETOOTH_CONNECT`) и объявление (`BLUETOOTH_ADVERTISE`), все с `minSdk` 31.

`bluetooth` — устаревшая запись (`BLUETOOTH` + `BLUETOOTH_ADMIN`), действительная до API 30. Если отметить её при `targetSdk` 31 и выше, `normalizeConfig` автоматически включит `bluetoothScan` и `bluetoothConnect` вместо мёртвого разрешения. `bluetoothPrivileged` предназначено для системных приложений и в обычном приложении не работает.

## Точные будильники — выберите одно

Для двух реальных разрешений есть пять записей, и отмечать следует только одну за раз:

- `alarmSchedule` → `SCHEDULE_EXACT_ALARM`. Рекомендуемое: пользователь может отозвать его в «Настройках».
- `alarmUse` → `USE_EXACT_ALARM`, только для часов, будильника или календаря. Play проверяет его вручную.
- `scheduleExactAlarm` и `useExactAlarm` — разбивки этих же двух.
- `alarm` — устаревший селектор; `normalizeConfig` превращает его в `scheduleExactAlarm`.

Аудит сводит их к `special` (предоставляются в «Настройках»), а система `SpecialAccess.java` генерируется, только если отмечено хотя бы одно.

## Телефон и SMS — ограничения в Play

`phone` объединяет `CALL_PHONE`, `READ_PHONE_STATE` и `READ_CALL_LOG`; `sms` объединяет `SEND_SMS` и `READ_SMS`. Разбивки: `callPhone`, `answerPhone`, `readPhoneState`, `readPhoneNumber`, `readCallLog`, `processOutgoingCalls`, `sendSms`, `readSms`, `receiveSms` и `receiveMms`.

Все они несут предупреждение `Play Store restringido` в spec. Они собираются без проблем, но Play принимает их только в приложениях категории «мессенджер» или «знаки». Если ваше приложение не из таких, не отмечайте их.

## Контакты, календарь и сенсоры

`contacts` и `calendar` — это пакеты «чтение + запись»; их разбивки — `readContacts`, `writeContacts`, `readCalendar` и `writeCalendar`.

`sensors` охватывает `BODY_SENSORS` и `HIGH_SAMPLING_RATE_SENSORS`; разбивки — `bodySensors` (runtime) и `highSamplingRateSensors` (install-time, API 31+). `activityRecognition` требует API 29+, а `envSensors` (Droncito) добавляет акселерометр, гироскоп, барометр, датчик света и приближения с разрешениями API 29.

## Сеть, аккаунты и Wi-Fi

`nearby` и `nearbyWifiDevices` — это один и тот же ключ (`NEARBY_WIFI_DEVICES`, API 33), рассматриваемый из двух селекторов. `changeWifiState` и `changeNetworkState` предоставляются при установке. `getAccounts` (`GET_ACCOUNTS`) помечен в Play как ограниченное.

## Специальные доступы (это не диалог)

- `systemAlert` / `systemAlertWindow` → `SYSTEM_ALERT_WINDOW`, предоставляется через `Settings.ACTION_MANAGE_OVERLAY_PERMISSION`.
- `installPackages` / `requestInstallPackages` → `REQUEST_INSTALL_PACKAGES`, через `canRequestPackageInstalls`.
- `powerMgmt` → `WAKE_LOCK` плюс `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, что открывает «Настройки», чтобы исключить приложение из энергосбережения.

Аудит помечает их `warn` со `special`, даже если манифест в порядке. Это ожидаемо: пользователь должен выдать это разрешение вручную.

## Остальной каталог

- `nfc` — `NFC` без диалога, плюс `uses-feature` и фильтр `TECH_DISCOVERED` с `nfc_tech_filter.xml`, если его отметить.
- `vibration` / `vibrate` — `VIBRATE`, install-time. Оба селектора указывают на одно разрешение.
- `biometric` (`USE_BIOMETRIC`, API 28+) и `fingerprint` (`USE_FINGERPRINT`, до API 27): отметка legacy включает `biometric`.
- `infrared` — `TRANSMIT_IR`, только на устройствах с ИК-портом.
- `ads` — только конфигурация AdMob: в манифесте есть `meta-data APPLICATION_ID` и плагин, но кода рекламы нет. Аудит возвращает его как NO GENERADO и блокирует сборки, где он выбран.
- `foregroundService` — те же три разрешения манифеста, что и у `foreground`, но без сервиса.
- `internet` — базовая сетевая запись (`INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`): включается в любой проект, с этим флажком или без него.

## Droncito Pack

Droncito Pack — это **18 записей spec** (`ar`, `voiceRec`, `envSensors`, `aiSuite`, `powerMgmt`, `adaptiveNotif`, `advSecurity`, `dynamicUI`, `socialAnalytics`, `advGeo`, `dataAnalytics`, `vr`, `blockchain`, `rpa`, `vulnScan`, `emoAI`, `iot`, `mr`), которые сводятся к одному файлу `DroncitoBridge.java`, вставляемому патчем, плюс зависимости Gradle, добавляемые `patch-droncito-gradle.js` при необходимости (ARCore, ML Kit, SceneView, GVR). С веб-страницы они используются через `Intee.ar.*`, `Intee.voice.*`, `Intee.ai.*`, `Intee.chain.*`, `Intee.iot.*` и так далее.

Три предупреждения, которые есть в самом spec: `ar`, `vr` и `mr` заметно увеличивают вес APK (ARCore/GVR) и работают только на поддерживаемых устройствах; `blockchain` хранит ключи в Keystore Android, и его лучше проверять в тестовой сети; `iot` добавляет Bluetooth и геолокацию поверх того, что вы отметили.

## Как устроен runtime изнутри

1. `NativePermissions.java` генерируется с массивом `BATCH[]`, содержащим ровно ваши runtime-разрешения: без background и без `MANAGE_EXTERNAL_STORAGE`. `requestAll()` запрашивает только объявленное и ещё не предоставленное.
2. `ACCESS_BACKGROUND_LOCATION` выполняется в два шага: `requestBackground()` вызывается только после предоставления foreground.
3. `SpecialAccess.java` открывает «Настройки» для наложения поверх, установщика, точных будильников и управления хранилищем. Генерируется, только если это запрошено.
4. `patch-permissions.js` вставляет `onPermissionRequest` с избирательным предоставлением (VIDEO — камере, AUDIO — микрофону, GEO — геолокации) и `deny()` по умолчанию.
5. Манифест объявляет `uses-feature ... required="false"` для камеры, Bluetooth LE, GPS, NFC и микрофона и добавляет фильтр NFC только когда нужно.
6. В логе workflow появляются `permisos nativos instalados`, `accesos especiales instalados` и `filtro NFC instalado`.

## Рекомендуемый порядок тестирования

По одному разрешению за сборку, в таком порядке:

1. Минимальный HTML только с `INTERNET`: установить, открыть и убедиться, что ничего не запрашивается.
2. Камера: `getUserMedia({video:true})` должен вызвать диалог.
3. GPS: `navigator.geolocation.getCurrentPosition` должен запросить геолокацию.
4. Уведомления на Android 13+: должны спросить при открытии.
5. Bluetooth Scan + Connect: `navigator.bluetooth.requestDevice()` должен запросить Bluetooth.

Если сборка запрашивает что-то, что вы не отмечали, движок лишнее добавляет сам: создайте issue с `build-config.json` и результатом Аудита.

## После сборки

Два эндпоинта служат для релизной проверки:

- `POST /api/manifest-diff` сравнивает запросы с тем, что сгенерировано, и возвращает `MATCH` или `MISSING` для каждого разрешения, плюс неожиданные.
- `POST /api/inspect` (максимум 30 МБ APK) возвращает карточку пакета с оценкой.

Оба стоит прогнать перед загрузкой в Play. Остальной процесс — в [production.md](./production.md), частые ошибки — в [troubleshooting.md](./troubleshooting.md).
