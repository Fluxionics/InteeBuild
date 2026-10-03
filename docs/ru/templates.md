# Шаблоны

InteeBuild поставляется с 29 шаблонами. Это не декоративные пресеты: каждый задаёт полную и проверенную конфигурацию, которая позволяет собрать с первого раза. Они разложены в `server/templates/` по семействам (`core`, `media`, `commerce`, `location`, `social`, `wellness`, `secure`) и собираются в `server/templates/index.js`.

Шаблон лишь задаёт значения по умолчанию. Permission Engine автоматически дополняет плагины, необходимые этим разрешениям, а Аудит должен вернуть `canBuild: true`, чтобы сборка запустилась.

## Как применяется шаблон

`applyTemplate` объединяет конфигурацию шаблона как основу и поверх неё ставит значения пользователя: то, что ввели вы, побеждает. Объекты `permissions` и `plugins` сливаются по одному разрешению за раз, поэтому можно отметить ещё одно, не потеряв те, что приносит шаблон.

То же слияние происходит, когда вы отправляете `template` в `POST /api/build` или в `POST /api/v1/build`. Если шаблон не отправлен, конфигурация берётся напрямую из того, что вы передаёте в `normalizeConfig`.

## Содержимое каждого семейства

**`core`** — web, pwa, blog, portafolio, news, dashboard, empresa, edu.

- `web` — минимальная основа: без разрешений, только INTERNET, с pull-to-refresh, экраном офлайн и загрузками.
- `pwa` добавляет `notifications` и `storage` и включает `webManifest` и `serviceWorker`, чтобы получилась устанавливаемая PWA.
- `blog` и `portafolio` добавляют уведомления и чтение; `news` к тому же ограничивает ориентацию вертикалью.
- `dashboard` оставляет только уведомления; `empresa` добавляет биометрию, `flagSecure` и `outputType: aab` для Play Store; `edu` добавляет камеру и микрофон.

**`media`** — radio, streaming, podcast, ai, game.

- `radio` включает `nativeAudio`, `nativeAutoplay`, `mediaSession` и `audioFocus`, разрешения `foreground`, `wakeLock` и `notifications` и экран офлайн с сообщением «Нет соединения. Для потока нужен интернет.»
- `streaming` использует `nativeAudio` с ориентацией по сенсору и `keepScreenOn`.
- `podcast` добавляет `storage` для загрузок и `mediaSession` для медиауправления.
- `ai` включает микрофон и камеру для распознавания речи.
- `game` — горизонтальная, полноэкранная, с вибрацией, `wakeLock` и `keepScreenOn`.

**`commerce`** — ecommerce, marketplace, food, realestate. Все используют камеру для фотографий товаров, GPS и хранилище; `marketplace` и `food` добавляют уведомления, `realestate` добавляет `phone` для прямых звонков.

**`location`** — maps, travel, delivery, eventos.

- `maps` — минимум: GPS на переднем плане и больше ничего.
- `travel` сочетает GPS, камеру, хранилище и уведомления о поездках.
- `delivery` добавляет `gpsBackground`, `keepScreenOn` и камеру для подтверждений доставки.
- `eventos` включает камеру для сканирования QR-кодов и GPS для определения площадки.

**`social`** — comunidad и social. Оба запрашивают камеру, хранилище и уведомления; `social` добавляет GPS для геолокации публикаций.

**`wellness`** — salud и fitness. Оба используют `sensors` и `activityRecognition`; `fitness` добавляет GPS, `wakeLock` и `keepScreenOn`.

**`secure`** — finanzas, banking, emergency, lab.

- `finanzas` и `banking` используют `biometric` + `notifications`, `flagSecure`, `blockSelection` и `outputType: aab`; `banking` добавляет `screenCaptureSecurity`.
- `emergency` поставляет GPS с фоновым режимом, `phone` для автоматического звонка, камеру и `highPriority` для уведомлений.
- `lab` (Permission Test Lab) запрашивает сразу десять разрешений, а её демо-страница выполняет каждый тест прямо на устройстве и сообщает реальный результат.

Три случая с `outputType: aab` — `empresa`, `finanzas` и `banking` — рассчитаны на прямую загрузку в Play Console. Остальные генерируют APK.

## Демо-страницы

Каждый шаблон может содержать `faceHtml` — демо-страницу на HTML. У radio, например, две кнопки, вызывающие `InteeAudio.play()` и `InteeAudio.pause()`, и они откатываются на `<audio>` браузера, если нативного моста нет. Страница не сохраняется отдельно: при применении шаблона студия записывает её в поле HTML и переключает источник на HTML. Если редактор был пустым, она делает это автоматически; если у вас уже был собственный код, она спросит, прежде чем заменить его (и вернуть демо-страницу можно в любой момент кнопкой страницы в редакторе). Если предпочитаете свой URL, не трогайте демо-страницу и затем снова выберите источник по URL.

Демо-страницу можно получить через API:

```bash
curl /api/templates            # lista con id, name, description y audit resumido
curl /api/templates/radio      # config completa + faceHtml
```

Список `/api/templates` запускает Аудит каждого шаблона с безопасным именем и `https://example.com` и возвращает `ok`, `total`, `readiness` и `canBuild`. Если у какого-то шаблона начнёт появляться `canBuild: false`, вы увидите это здесь, ничего не собирая.

## Нативная проверка

`GET /api/templates/:id/native` генерирует реальные файлы шаблона в памяти и отвечает манифестом, списком файлов, включёнными `.java` и `.xml`, наличием `NativePermissions.java`, наличием `RadioService.java`, наличием патча каталога, `provider.json` и аудитом. Поле `native100` равно `true`, когда аудит проверяет всё и разрешает сборку. Это быстрый способ посмотреть, что даст каждый шаблон, не запрашивая сборку.

## Foreground service и аудио

Только три шаблона запрашивают `foreground`: `radio`, `streaming` и `podcast`. `wakeLock` есть у тех же трёх плюс `game` и `fitness`, а `keepScreenOn` — у `streaming`, `game`, `delivery`, `fitness` и `emergency`. `delivery` не запрашивает `foreground`: фоновый режим он решает через `gpsBackground`, это другое разрешение с другим манифестом. **Дополнительно `wifiLock` (`WIFI_MODE_FULL_HIGH_PERF`) автоматически генерируется для `radio`, `streaming` и `podcast`, когда включён `foreground`: это не даёт аудио оборваться из-за энергосбережения Wi-Fi при выключенном экране.** Подробности о том, зачем нужен этот код и как его проверить, — в [foreground.md](./foreground.md).

## Настройка

После загрузки шаблона в расширенном режиме можно менять что угодно: отдельные разрешения, плагины, SDK, ориентацию, цвета, splash и deep links. Если меняете всего два-три поля, просто передайте их поверх `template: "radio"` — и всё: повторять то, что уже есть в шаблоне, не нужно.

Реальные конфигурации каждого шаблона лежат в `server/templates/*.js`, поэтому если какого-то сценария не хватает, добавьте его там в том же формате — и он появится в `GET /api/templates`.
