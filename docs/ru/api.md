# API для разработчиков

Весь API расположен под `/api` на том же сервере, что и интерфейс. Базовый URL — ваш домен или `http://localhost:8787`. Всё в формате JSON, за исключением endpoint'ов, возвращающих ZIP, обычный текст или PNG.

Если вам нужна навигационная страница с теми же endpoint'ами — это `developer.html`. `GET /api/docs` возвращает сводку API в JSON с версией сервера.

## Аутентификация

API-ключи не обязательны: пока их нет, API открыт. Как только вы создадите первую, `POST /api/v1/build` начнёт её требовать.

```bash
curl -X POST /api/keys -H "Content-Type: application/json" -d '{"name":"ci"}'
# → {"id":"…","key":"ib_…","keyHash":"…","prefix":"ib_…","scopes":["build","decompile","analyze"]}
```

Ключ возвращается только один раз — в этом ответе. На диске остаётся лишь его хеш sha256 (`keyHash`) и префикс (первые десять символов), но не сам секрет. `GET /api/keys` возвращает замаскированный вид (`ib_1a2b3c4…` плюс последние четыре символа хеша), использование, последний вызов и статус; `DELETE /api/keys/:id` выполняет логическое удаление, помечая `revokedAt`, и такой ключ перестаёт работать. Лимит — 10 активных ключей.

Доступ принимается двумя способами: `X-API-Key: ib_…` или `Authorization: Bearer ib_…`.

Нюанс, который стоит знать: `scopes` сохраняются и могут быть ограничены при создании ключа, но ни на одном маршруте они не проверяются. Реальное право доступа — «ключ существует и не отозван».

Также у вас есть `GET /api/keys` для списка и отзыва из собственного клиента.

## Сборка

Есть две точки входа. Студийная не требует ключа и отвечает `id`; версионная может его потребовать и отвечает `buildId`.

```bash
curl -X POST /api/build -H "Content-Type: application/json" \
  -d '{"url":"https://mi-tienda.com","appName":"Mi Tienda","packageName":"com.miempresa.miapp","permissions":{"gps":true,"cameraMic":true}}'
# → 202 {"id":"abc123","branch":"build-abc123","status":"queued"}
```

```bash
curl -X POST /api/v1/build -H "Content-Type: application/json" -H "X-API-Key: ib_…" \
  -d '{"url":"https://mi-tienda.com","name":"Mi Tienda","package":"com.miempresa.miapp","output":"apk","template":"ecommerce"}'
# → 202 {"buildId":"abc123","status":"queued","branch":"build-abc123"}
```

`POST /api/build` принимает полную конфигурацию: `url` или `htmlCode` с `inputType`, `appName`, `packageName`, `outputType` (`apk`/`aab`/`both`), `outputs` (список форматов: `apk`, `aab`, `xapk`, `apks`, `ipa`, `exe`, `msi`, `dmg`, `appimage`), `platform` (`android`/`ios`/`both`), `permissions`, `plugins`, `provider`, `template`, `streamUrl`, `nativeAudio`, `nativeAutoplay`, `orientation`, `iconBase64`, подпись keystore и iOS, `webhookUrl`, `desktopEnabled` и остальные поля, которые нормализуют SDK.

`POST /api/v1/build` намеренно уже: он распознаёт только `url`, `name`/`appName`, `package`/`packageName`, `output`/`outputType`, `outputs`, `platform`, `inputType` + `htmlCode`, `versionName`, `versionCode`, `compileSdk`, `targetSdk`, `minSdk`, `permissions`, `plugins`, `provider`, `template`, `streamUrl`, `nativeAudio`, `nativeAutoplay` и `webhookUrl`. Иконка и флаги интерфейса туда не передаются; используйте `/api/build`, если они вам нужны.

Ошибки, которые вы увидите до того, как что-либо запустится: ненастроенный GitHub возвращает `503` с уведомлением о `.env`; заблокированная по соображениям безопасности URL — `400`; HTML длиннее 500 000 символов — `400`; иконка больше 7 МБ — `400`; а лимит 10 сборок в час на IP — `429`. Этот счётчик общий с облачной декомпиляцией, поэтому один проход декомпиляции тоже расходует ваш квоту сборок.

Во время сборки шаги проходят через `Enviando proyecto a GitHub`, `Sincronizando workflow`, `Subiendo proyecto`, `Lanzando compilacion en GitHub Actions`, `En cola en GitHub Actions` и `Compilando APK` и завершаются `Build completado` или `Build fallido`.

## Запрос состояния и скачивание

Студия опрашивает каждые 3 секунды. Вы можете делать это с любой частотой.

```bash
curl /api/build/abc123
# → {"id":"abc123","status":"building","step":"Compilando APK","runUrl":"https://github.com/…","apkUrl":null,"outputType":"apk"}
```

`status` проходит через `queued` → `building` → `success` или `failed`. Если сборки уже нет в памяти, endpoint смотрит в историю и возвращает запись с `fromHistory: true`; если её нет — `404`.

`GET /api/v1/build/:id` возвращает то же самое в другом виде: относительные к API `apkUrl`, `aabUrl` и `ipaUrl` (или `null`, если этот артефакт не создавался), плюс `outputs` (то, что вы запрашивали) и `formats` (то, что артефакт в GitHub Actions подтверждает как существующее).

```bash
curl /api/v1/build/abc123
# → {"buildId":"abc123","status":"success","apkUrl":"/api/download/abc123","aabUrl":null,"ipaUrl":null,"outputs":["apk"],"formats":["apk"]}
```

Скачивание:

- `GET /api/download/:id` — APK.
- `GET /api/download/:id/aab` — AAB.
- `GET /api/download/:id/ipa` — IPA, только если была подпись Apple.

Все три работают одинаково: ищут артефакт запуска, открывают ZIP, загруженный GitHub Actions, и возвращают отдельный бинарный файл с его расширением (если бинарный файл не найден — возвращают ZIP целиком). Если сборка ещё выполняется, отвечается `404` с сообщением "Build aun en progreso".

Есть условие, о котором стоит помнить: для скачивания сборка должна находиться в памяти сервера. Если процесс был перезапущен, endpoint отвечает `404`, даже если артефакт существует на GitHub. История служит для просмотра состояния и конфигурации, а не для скачивания.

Артефакты раздаются из GitHub Actions и устаревают через 30 минут. `GET /api/apk-info/:id` возвращает карточку артефакта (название, размер в МБ, ссылки на каждый) только после завершения сборки. `GET /api/build/:id/logs` возвращает лог запуска, обрезанный до 80 000 символов, и только если у сборки уже есть `runId`.

Сервер опрашивает GitHub каждые 6 секунд и делает 200 попыток: если они исчерпаны, сборка переходит в `failed` с сообщением "Tiempo de espera agotado consultando GitHub", а ветка удаляется через 60 секунд.

Чтобы запросить проект без сборки:

```bash
curl -X POST /api/project -H "Content-Type: application/json" -d '{"url":"https://mi-tienda.com","template":"ecommerce"}' -o proyecto.zip
```

## Шаблоны

```bash
curl /api/templates
curl /api/templates/radio
curl /api/templates/radio/native
```

Список содержит `id`, `name`, `description`, `hasFace` и краткий audit (`ok`, `total`, `readiness`, `canBuild`). Детализация включает `config` и `faceHtml`. Третья команда генерирует в памяти манифест, файлы Java/XML и audit без сборки. Детали каждого шаблона — в [templates.md](./templates.md).

## Разрешения и readiness

```bash
curl /api/permissions/spec
curl -X POST /api/permissions/audit -H "Content-Type: application/json" -d '{"appName":"Mi Tienda","url":"https://mi-tienda.com","permissions":{"cameraMic":true}}'
curl -X POST /api/permissions/suggest -H "Content-Type: application/json" -d '{"url":"https://mi-tienda.com"}'
curl -X POST /api/build-readiness -H "Content-Type: application/json" -d '{"appName":"Mi Tienda","url":"https://mi-tienda.com","permissions":{"gps":true}}'
```

`spec` возвращает записи Permission Engine (86 в текущей версии). `audit` возвращает по строке на разрешение со `status` (`ok`/`warn`/`fail`), `minSdk`, нативной реализацией и тем, поддерживает ли это provider, плюс `ok`, `total`, `canBuild`, `verifiedAll` и `readiness`. `suggest` принимает `{html}`, `{url}` или `{detectedApis}` и отвечает `{detected, suggested, count}`.

`build-readiness` используется на шаге «Собирать». Он возвращает `readiness` (0-100), `checks`, `audit`, `warnings` и `canBuild`. `canBuild` равно `true` только если audit проходит, есть URL или HTML, а нативный аудио-стрим задан. Типичное предупреждение — "Audio nativo activo pero sin URL del stream: pon tu servidor en Audio nativo", которое блокирует радио, пока вы не укажете `streamUrl`.

**Foreground + WifiLock**: если `permissions.foreground` включён, генератор теперь добавляет `WifiLock` (`WIFI_MODE_FULL_HIGH_PERF`, с `try/catch`), чтобы аудио не прерывалось при выключении экрана из-за энергосбережения WiFi. `WakeLock` (PARTIAL) также остаётся активным. Подробности фонового сервиса — в `foreground.md`.

Поле `provider` в конфигурации теперь корректно переносится в `build-config.json` (раньше оно терялось из-за сломанных экранирований в workflow), и конвейер использует это значение, чтобы решить, внедрять ли нативный/gecko `MainActivity` или мост Capacitor.

`POST /api/manifest-diff` сравнивает то, что вы запрашивали, с тем, что генерируется: возвращает `requested`, `generated`, `missing`, `unexpected` и `rows` со статусом `MATCH` или `MISSING` для каждого разрешения. Пригодится для обнаружения разрешений, не попавших в манифест, до сборки.

## Анализ сайта

```bash
curl "/api/analyze?url=https://mi-tienda.com"
curl -X POST /api/analyze/html -H "Content-Type: application/json" -d '{"html":"<html>…</html>"}'
curl -X POST /api/analyze/fix -H "Content-Type: application/json" -d '{"html":"<html>…</html>"}'
```

`GET /api/analyze` скачивает страницу с тайм-аутом 10 секунд, проверяет HTTPS, viewport, manifest, favicon, theme-color, service worker, ресурсы с `http://`, Open Graph и структурированные данные и возвращает `score` от 0 до 100 с диагностикой. Помимо этого выдаёт `frameworks`, `detectedApis`, `recommendations`, `security` (оценка с замечаниями), `errors`, `optimization` и `autoFix.preview` с первыми 8000 исправленными символами. Если на странице есть manifest, выполняется попытка скачать его, чтобы вернуть `pwa`. Отклоняется HTML длиннее 500 000 символов и заблокированные URL.

`POST /api/analyze/html` выполняет тот же анализ над отправленным HTML с лимитом 600 000 символов и дополнительно возвращает `autoFix.full`. `POST /api/analyze/fix` возвращает `{fixed, originalLength, fixedLength}` без диагностики.

## Инспектор, декомпилятор

```bash
curl -X POST /api/inspect -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
curl -X POST /api/decompile -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
curl -X POST /api/decompile/cloud -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
curl /api/decompile/cloud/abc123/status
curl -L -o salida.zip /api/decompile/cloud/abc123/download
```

`/api/inspect` возвращает техническую карточку (`packageName`, версия, размер, число файлов, `.dex`, `.so`, иконки), обнаруженные разрешения, `riskyPermissions`, `findings` и `security.score`. Принимает до 30 МБ и минимум 100 байт.

`/api/decompile` работает локально: принимает `apkBase64` (с префиксом `data:` или без него) или тело `application/octet-stream`, до 100 МБ. Возвращает `meta`, `importConfig`, `sourceZipBase64` и `manifestPreview`.

`/api/decompile/cloud` загружает APK в ветку `decompile-<id>` и запускает workflow с `jadx 1.5.1 + apktool 2.9.3`. Отвечает `202` с `statusUrl`, `downloadUrl` и уведомлением о том, что APK удаляется из ветки через 20 минут. Лимит — 60 МБ, общий rate limit — 10/час на IP. Статус возвращает `status`, `conclusion`, `runUrl`, `artifacts` и `ready`; клиент ждёт с опросом каждые 5 секунд и пределом 5 минут. В скачиваемом ZIP есть `output/sources` (Java), `output/resources` (res и smali), `AndroidManifest-decoded.xml` и `REPORT.txt`.

## Карточка, безопасность и приватность

```bash
curl -X POST /api/listing -H "Content-Type: application/json" -d '{"appName":"Mi Radio","packageName":"com.miempresa.radio","template":"radio"}'
curl -X POST /api/security-audit -H "Content-Type: application/json" -d '{"appName":"Mi App","url":"https://mi-web.com","permissions":{"cameraMic":true}}'
curl "/api/privacy-policy?appName=Mi%20App&package=com.miempresa.miapp"
```

`/api/listing` возвращает `{ok, listing}` с `title`, `shortDescription`, `fullDescription`, `keywords`, `category` и `packageName`, с лимитами, которые задаёт Play Console.

`/api/security-audit` возвращает `score`, `level`, `audit` разрешений, `issues` (чувствительные разрешения, cleartext) и список `gdpr` из трёх проверок: ссылка на политику конфиденциальности, лишние чувствительные разрешения и собственный keystore. Оценка уменьшается на 20 очков за разрешение в `fail`, 5 за `warn` и 5 за замечание высокого уровня.

`/api/privacy-policy` возвращает обычный текст с переданными вами данными. Это заготовка для заполнения, а не готовый юридический документ.

## Версии и CI/CD

```bash
curl -X POST /api/versions/publish -H "Content-Type: application/json" -d '{"appId":"com.miempresa.miapp","version":"1.0.1","changelog":"fix"}'
curl "/api/check-update?appId=com.miempresa.miapp&version=1.0.0"
curl "/api/versions/com.miempresa.miapp"
curl -X POST /api/cicd -H "Content-Type: application/json" -d '{"repo":"usuario/mi-web","branch":"main","baseUrl":"https://tu-dominio.com"}'
```

`versions/publish` сохраняет до 20 записей на `appId` с `version` (формат `1.0.1`), `changelog` и датой. `check-update` сравнивает с последней опубликованной и отвечает `{updateAvailable, latest, changelog}`. Встроенного OTA-клиента в приложении нет: это реестр, который можно запросить откуда угодно.

`cicd` возвращает содержимое `.github/workflows/inteebuild-auto.yml`, чтобы вы загрузили его в свой репозиторий, вместе с `curl`, запускающим webhook. Настоящая интеграция — `POST /api/git/connect` с `{repo, branch, token, webhookUrl}`, который сохраняет токен с хешем; затем `POST /api/git/webhook` с `{"repository":{"full_name":"usuario/repo"},"ref":"refs/heads/main"}` запускает сборку с переданной конфигурацией или с минимальной, выведенной из репозитория. `GET /api/git/integrations` перечисляет, а `DELETE /api/git/:id` удаляет.

## Webhooks

`webhookUrl` принимает POST с JSON. События: `build.completed`, `build.failed` и `build.error` (ошибка при отправке проекта на GitHub, до того как что-либо запустится).

## Разные утилиты

- `GET /api/health` — `{ok, service, version, githubReady}`.
- `GET /api/diag` — проверяет токен, репозиторий, ветку и workflow в GitHub и возвращает `hint` для каждого шага, чтобы понять, чего не хватает в `.env`.
- `GET /api/history`, `GET /api/history/:id`, `DELETE /api/history/:id` — локальная история. Список возвращает первые 30 записей файла, который в свою очередь хранит максимум 50; `:id` возвращает полную запись с использованной конфигурацией.
- `GET /api/stats` — итоги по статусам и `outputType`, а также средняя длительность завершённых сборок.
- `GET /api/qr/:id` — PNG ссылки на скачивание.
- `GET /api/cleanup?secret=…` — принудительная очистка устаревших артефактов. Требует `CLEANUP_SECRET` в окружении; без него endpoint возвращает `403`.
- `GET /api/ads/:slot` и `GET /api/ad-proxy?u=` — собственная рекламная сеть с кэшем и проксированием креатива (`u` — это URL для скачивания).

Подробнее о лимитах и развёртывании — в [production.md](./production.md); о том, что получается при каждой сборке, — в [outputs.md](./outputs.md).
