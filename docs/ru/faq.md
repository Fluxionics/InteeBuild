# Частые вопросы

Короткие ответы на самые частые вопросы. Каждый ведёт к руководству, где ответ сверяется с кодом.

## Какой provider выбрать?

`capacitor`, если нет причин менять: это единственный со всеми проверенными патчами (runtime-разрешения, специальные доступы, нативное аудио, Droncito Pack). `native`, если нужен самый лёгкий APK; `gecko`, если нужен движок Mozilla; `twa`, `cordova`, `flutter` и `tauri` — для конкретных экосистем. Все сегодня собираются в CI. Детали и лимиты каждого — в [providers.md](./providers.md).

## Собираются ли Flutter и Tauri по-настоящему?

Да. `flutter` запускает джоб `flutter-build` (Ubuntu + `flutter create` + `flutter build apk`) и выдаёт артефакт `-apk`, а если вы просили — и `-aab`. `tauri` запускает `tauri-build` (Windows + `cargo build --release`) и выдаёт `-exe`. Workflow получает provider как input и пропускает или активирует каждый джоб по назначению. См. [outputs.md](./outputs.md).

## Сколько сборок можно делать?

10 в час на IP плюс 10 декомпиляций в час. Лимит применяется на сервере по вашему IP; при превышении API отвечает `429`.

## Где посмотреть полный лог сборки?

На карточке сборки консоль показывает лог всех джобов и шагов (до 500 КБ на сборку). Через API: `GET /api/build/:id/logs`. Если нужен «сырой» детальный лог — GitHub Actions хранит запуск, пока живут ветка и артефакт (30 минут).

## Работает ли сборка iOS?

Да. Workflow использует `pod install` и собирает против `App.xcworkspace` (не `App.xcodeproj`), как и требуется с pods Capacitor. Без сертификатов шаг `ios-build` собирает для симулятора с отключённой подписью; с `.p12` и `.mobileprovision` на шаге подписи — архивирует для устройства. См. [outputs.md](./outputs.md).

## Почему аудио прерывается при выключенном экране?

Почти всегда одно из трёх: URL имеет схему `blob:` (hls.js, YouTube), ваш HTML ставит паузу на `visibilitychange`, или в сборке нет `foreground` + `streamUrl`. У provider `gecko` передачи на нативный слой никогда не будет, потому что GeckoView не разрешает `addJavascriptInterface`. Полный чек-лист — в [foreground.md](./foreground.md).

## Что означает каждый бейдж в Audit?

`GENERATED OK` = элемент есть в ZIP, который пойдёт на сборку. `SPEC ONLY, NOT GENERATED` = вы его запрашивали, но он не сгенерировался. `NO GENERADO` = реализации нет (блокирует сборку, как `ads`). В колонке provider: `OK (<provider>)`, `WARN (<provider> sin handler declarado...)` или `WARN (<provider> compila APK en CI...)`. См. [permissions.md](./permissions.md).

## Сколько весит приложение?

Лимиты сервера — 7 МБ для иконки и 500 КБ для HTML. APK у `native` самый лёгкий, потому что он не тянет рантайм Capacitor; с `gecko` сборка заметно дольше, поскольку `patch-gecko-gradle.js` при каждой сборке скачивает AAR Mozilla с `maven.mozilla.org`.

## Можно собирать без студии?

Да: `POST /api/project` возвращает ZIP со всем (включая workflow), и вы можете загрузить его в собственный репозиторий GitHub. Workflow `build-app.yml` тот же, что использует сервер; inputs — `id`, `platform`, `outputs` и `provider`. См. [api.md](./api.md).

## Хранятся ли артефакты вечно?

Нет: они живут в GitHub Actions 30 минут, после чего сервер удаляет их так же. Локальная история (`GET /api/history`) сохраняет метаданные и ссылку, пока существует запись; если срок истёк — соберите заново.

## Работает ли приложение офлайн?

PWA — да: при `pwaEnabled` (включён по умолчанию) ZIP содержит `manifest.webmanifest` и `sw.js` с офлайн-кэшем вашего HTML. Android-приложение показывает ваш сайт внутри своего WebView; офлайн-кэш service worker зависит от вашего HTML и заголовков вашего сервера. См. [outputs.md](./outputs.md).

## За что отвечает каждый выбор внешнего вида?

`accentColor` попадает в манифест и нативные цвета, `splashColor` — на экран запуска, `orientation` — в манифест и в окно десктопа. Подробности — в [ui-ux.md](./ui-ux.md).

Если что-то не работает — начните с [troubleshooting.md](./troubleshooting.md).
