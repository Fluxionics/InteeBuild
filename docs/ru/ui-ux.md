# Интерфейс и удобство приложения

Это руководство описывает поля внешнего вида и поведения, которые вы настраиваете на шаге Настроек студии. Все они являются конфигурацией генерации: отмеченное здесь попадает в манифест, `capacitor.config.json`, `colors.xml` или в скрипт, который вставляется в ваш HTML.

Чтобы понять, что делает то или иное поле, простое правило: если его нет в этом списке или оно помечено как бездействующее, проверьте через `POST /api/project` и посмотрите ZIP, прежде чем делать выводы.

## Стиль и внешний вид

**Тема (`appTheme`)** — `system` (по умолчанию), `light` или `dark`. Задаёт светлый или тёмный стиль строки состояния: когда включён плагин StatusBar или режим edge-to-edge, в `capacitor.config.json` оказывается `StatusBar.style`, равное `DARK` для тёмной темы и `LIGHT` в противном случае. Цвета вашего сайта не меняются.

**Начальная анимация (`entryAnimation`)** — `none` (по умолчанию), `fade` или `slide`. Сохраняется в `build-config.json`, но сегодня ни один патч генератора её не применяет: значение записывается, но не превращается в код.

**Цвет акцента (`accentColor`)** — по умолчанию `#4f46e5`. Если изменить его, в ZIP окажется `custom-colors.xml` с `colorPrimary` и `colorAccent`; этот файл workflow копирует в `res/values/colors.xml`. Тот же цвет используется как `theme_color` манифеста PWA и как акцент вставляемого скрипта.

**Цвет строки состояния (`statusBarColor`)** — по умолчанию `#ffffff`. Идёт в `colorPrimaryDark` того же `custom-colors.xml` и в `StatusBar.backgroundColor`, когда плагин StatusBar активен.

**Цвет строки навигации (`navigationBarColor`)** — по умолчанию `#ffffff`. Влияет на то, будет ли сгенерирован `custom-colors.xml`, но ни одного значения этим цветом не записывает: файл содержит только `colorPrimary`, `colorPrimaryDark` и `colorAccent`.

Файл с тремя цветами создаётся, только если хотя бы один отличается от значения по умолчанию; при заводской настройке в ZIP его нет.

**Оформление edge-to-edge (`edgeToEdge`)** — включает `overlaysWebView` в плагине StatusBar, из-за чего ваш контент рисуется под системными строками. В сочетании с `statusBarColor` вы решаете, какой цвет останется сзади.

## Поведение экрана

**Ориентация (`orientation`)** — `any` (по умолчанию), `portrait`, `landscape` или `sensor`. Записывается в манифест как `screenOrientation`.

**Полноэкранный режим (`fullscreen`)** — скрывает верхнюю строку состояния и делает splash погружным.

**Не гасить экран (`keepScreenOn`)** — добавляет `android:keepScreenOn="true"` к активности. Для видео, игр и стриминга; включается в `streaming`, `game`, `delivery`, `fitness` и `emergency`.

**Незашифрованный трафик (`useCleartext`)** — включён по умолчанию. Ставит `android:usesCleartextTraffic="true"` в манифест и `server.cleartext` и `android.allowMixedContent` в `capacitor.config.json`, а также задаёт `androidScheme` равным `http`, если ваш URL — `http://`. Если выключить его, а источник — `http://`, приложение не загрузит ничего.

## Splash

`splashEnabled` записывает конфигурацию `SplashScreen` в `capacitor.config.json` с `launchAutoHide: true`, длительностью и цветом фона. `splashDuration` принимается от 500 до 5000 мс, по умолчанию 2000. `splashColor` дополнительно переиспользуется как `background_color` манифеста PWA.

Поля для изображения splash нет: фон плоский, а значок ставит система. В шаблонах `radio` splash отключён, чтобы приложение открывалось сразу.

## Глубокие ссылки

`deepLinksEnabled` с `deepLinkDomain` добавляет в манифест `intent-filter` с `autoVerify`, а домен также используется для генерации `assetlinks.json` и `.well-known/assetlinks.json`. `deepLinkPaths` допускает до десяти путей. Файл должен быть доступен по вашему домену, чтобы App Links работали: отпечаток сертификата в нём — заглушка, и её нужно заменить (подробнее в [providers.md](./providers.md)).

## Настройки WebView

**Действие кнопки «Назад» (`backButtonBehavior`)** — `back` (по умолчанию) возвращает назад по истории и выходит, если истории больше нет; `exit` вызывает `finishAffinity()`; `confirm` показывает диалог «Выйти из приложения?»; `none` ничего не делает. Патч записывает это в `MainActivity`.

**Пользовательский User-Agent (`userAgent`)** — поле существует, но если его заполнить, активируется только `webContentsDebuggingEnabled: false` в `capacitor.config.json`. UA WebView он не меняет: не рассчитывайте скрыть своё приложение под другим браузером.

**Режим кэша (`cacheMode`)** — `normal`, `no-cache` или `force-cache`. Нормализуется и сохраняется, но ни до одного генератора не доходит: поведение приложения не меняется.

**Пользовательские HTTP-заголовки (`customHeaders`)** — та же ситуация: принимаются и обрезаются, без влияния на генерацию.

**Инъекция JavaScript (`jsInjection`) и стилей (`cssInjection`)** — если их заполнить, в ZIP окажутся `www/inject.js` и `www/inject.css` с этим содержимым. К вашему HTML они не добавляются сами: страница должна ссылаться на них через `<script src="inject.js">` и `<link rel="stylesheet" href="inject.css">`.

**Минификация HTML (`minify`)** — убирает комментарии и лишние пробелы из сгенерированного HTML и комментарии из `catalog.js`. Ваш JavaScript не трогает и не является продакшн-минификатором.

## Отложенные уведомления

`notifyOnOpen`, `notifyOnClose` и `notifyDelayMinutes` вместе с `notifyTitle` и `notifyText` генерируют скрипт, который использует `LocalNotifications`, чтобы запланировать уведомление при открытии, при переходе в фон или через указанное число минут. Два условия: вставляется, только если источник — HTML, и требует включённого плагина уведомлений.

Блок «каналы уведомлений» (`notifChannel`, `notifImportance`, `notifSound`, `notifVibration`) имеет поля в студии, но ни одно из этих четырёх значений при генерации не используется: их не читает ни канал `RadioService`, ни отложенные уведомления. Канал аудиосервиса называется `inteebuild_radio` с низкой важностью и неизменен.

## Функции, вставляемые в ваш сайт

Шаг Настроек содержит блок каталога с функциями, которые выгружаются в `catalog.js` и выполняются внутри WebView поверх вашей страницы:

- **Pull-to-refresh** — проведение вниз при прокрутке вверх перезагружает страницу.
- **Экран офлайн** — неподвижный слой с `offlineMessage` (по умолчанию «Нет соединения. Проверьте интернет.») и кнопкой повтора. Включается через `offlineScreen`, который включён по умолчанию, кроме `lab`.
- **Индикатор загрузки** — `spinner` (слой по центру), `bar` (полоса 3 px сверху) или `none`.
- **Боковая панель** (`drawerEnabled`) — закреплённая кнопка сверху слева, открывающая панель с `drawerItems`: до восьми объектов `{label, url, icon}` в JSON.
- **Нижняя навигация** (`bottomNavEnabled`) — нижняя полоса с до пятью `{label, url, icon}` и автоматическим `padding-bottom` у body.
- **DownloadManager** — нативные загрузки вместо передачи их WebView.
- **Блокировка выделения** (`blockSelection`) — CSS `user-select: none` (за исключением текстовых полей) и запрет контекстного меню.
- **Определение root/jailbreak** (`rootDetection`) — патч `RootCheck` в `MainActivity`.
- **Encrypted Storage** — добавляет `capacitor-secure-storage-plugin` и разрешение `USE_BIOMETRIC`.

`flagSecure` сюда не относится: он применяется в Java, в `MainActivity`.

Если главенствует ваш HTML, помните, что скрипт каталога вставляется в `</body>` после вашего кода, а viewport и charset гарантируются только когда источник — HTML. Если вы загружаете URL, о своём viewport должен позаботиться ваш сайт.

## Доступность и производительность

Ничего этого генератор за вас не делает; это работа вашего HTML:

- `meta viewport` вставляется только в режиме HTML. Если ваш источник — URL, добавьте его на своём сайте.
- Текст с контрастом не ниже 4.5:1 и 3:1 для крупного текста.
- Сенсорные цели от 48 dp и больше.
- Описательный `alt` у изображений. Автоисправление анализатора ставит `alt=""`, что не является описанием.
- Отложенная загрузка изображений и ресурсов через `defer` или `async`. Анализатор отмечает это в `optimization`.

## Как проверить, что изменилось

```bash
curl -X POST /api/project -H "Content-Type: application/json" -d '{"appName":"Mi App","url":"https://mi-web.com","accentColor":"#112233","entryAnimation":"fade","orientation":"portrait"}' -o proyecto.zip
unzip -p proyecto.zip capacitor.config.json
unzip -p proyecto.zip main-manifest.xml | grep -E "screenOrientation|keepScreenOn|cleartext"
unzip -p proyecto.zip www/index.html | tail -5
```

Последняя строка показывает скрипт каталога, приклеенный в конец вашего HTML. Если `entryAnimation` нигде не появляется, значит, он не применяется — вот вам и подтверждение.

Больше о разрешениях — в [permissions.md](./permissions.md), о том, что собирается в каждой сборке, — в [outputs.md](./outputs.md), и об анализаторе — в [analyzer.md](./analyzer.md).
