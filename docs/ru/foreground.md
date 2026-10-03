# Фоновое аудио

Самый частый сценарий в InteeBuild — радио, подкаст или стриминг, который продолжает звучать при свёрнутом приложении и выключенном экране. Это руководство описывает, что для этого генерирует проект, как это проверить и что делать, если звук прерывается.

Есть два пути, и лучше выбрать один:

- **Нативное аудио (рекомендуется).** В HTML только кнопки, вызывающие `window.InteeAudio`; поток воспроизводит `RadioService.java` с помощью `MediaPlayer` и `MediaSession`. То, что делает WebView, перестаёт иметь значение.
- **Аудио из WebView.** Ваша страница управляет обычным `<audio>` или `<video>`. При включённом `foreground` проект вставляет runtime в `catalog.js`, который при скрытии страницы (приложение свёрнуто или экран выключен) передаёт воспроизведение в `RadioService` с текущей позицией и возвращает его в WebView при возвращении. Пока приложение видно, управляет ваш плеер, как обычно.

Шаблоны `radio`, `streaming` и `podcast` включают `nativeAudio`.

## Минимальная настройка

В студии, карточка **Аудио 100% нативное** (шаг Настройки): отметьте нативное воспроизведение и вставьте URL потока. Через API:

```json
{
  "appName": "Mi Radio",
  "url": "https://mi-radio.com",
  "template": "radio",
  "permissions": { "foreground": true, "wakeLock": true, "notifications": true },
  "nativeAudio": true,
  "nativeAutoplay": true,
  "streamUrl": "https://tu-servidor.com:8000/stream"
}
```

При заполненных `nativeAudio` и `streamUrl` `normalizeConfig` принудительно включает `foreground` и `wakeLock`, поэтому отмечать их вручную не нужно. Без `streamUrl` показатель готовности возвращает `canBuild: false` с предупреждением `Audio nativo activo pero sin URL del stream`: без URL нативно нечего воспроизводить, и эта блокировка намеренная.

## Что появляется в ZIP

Манифест (проверяется в `main-manifest.xml`):

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<service android:name=".RadioService"
         android:exported="false"
         android:foregroundServiceType="dataSync|mediaPlayback" />
```

Файлы:

- `RadioService.java` — канал `inteebuild_radio` с `IMPORTANCE_LOW`, `startForeground(1, notificación)` и `onStartCommand`, возвращающий `START_STICKY`, чтобы система воскрешала сервис. Запрашивает поток через `MediaPlayer` и отправляет заголовок `Icy-MetaData: 0`, чтобы Shoutcast не вставлял метаданные в MP3. `PARTIAL_WAKE_LOCK` и `WifiLock` (`WIFI_MODE_FULL_HIGH_PERF`, чтобы Wi-Fi не уходил в энергосбережение при выключенном экране и буфер потока не иссякал) запрашиваются через `try/catch`: если разрешения нет, звук продолжает идти без локов вместо падения сервиса, а при паузе или уничтожении они освобождаются. В `onCompletion` переподключается, только если URL похож на живой поток; MP3 проигрывается и останавливается.
- `AudioBridge.java` — предоставляет `window.InteeAudio` с `play(url)`, `playAt(url, ms)`, `pause()`, `isPlaying()`, `isActive()` и `keepAwake(bool)`. Генерируется вместе с `foreground`, даже если нативное аудио не используется, потому что это цель передачи.
- `patch-main-activity.js` и `patch-audio.js` — вставляют запуск сервиса и мост в `MainActivity.java`. `patch-audio.js` трогает только `MainActivity extends BridgeActivity`; в provider `native` мост уже встроен в класс, а в `gecko` запуск сервиса тоже встроен в `gecko-MainActivity.java`, но мост нет (см. ограничение ниже).
- `www/catalog.js` — помимо интерфейса каталога, содержит runtime передачи (опознаётся по `window.__ibFg`).

В логе workflow должно появиться `--- audio service installed ---`, за ним `1` и `--- native audio installed ---`. Если видите `0`, патч не применился: проверьте `build-config.json` и `permissions.foreground`.

## Автоматическая передача `<audio>` страницы

При отмеченном `foreground` runtime из `catalog.js` делает следующее на каждой странице (в том числе на удалённом URL, потому что патч вставляет его в `onPageFinished`):

1. Слушает `play`, `pause` и `ended` у `<audio>` и `<video>` и запоминает URL, позицию и играет ли сейчас.
2. При скрытии страницы, если что-то играло, вызывает `InteeAudio.playAt(url, posición)` и ставит ваш элемент на паузу. WebView замораживается при выключенном экране, но `MediaPlayer` сервиса продолжает работать с wakelock и WifiLock.
3. При возвращении, если сервис ещё активен (`isActive()`), ставит нативное на паузу, возвращает элемент в оценочную позицию и вызывает `play()`. Если вы остановили аудио из уведомления, оно не возобновится.

Ограничения, которые всё равно за вами:

- **Provider `gecko`: моста `InteeAudio` нет.** GeckoView не предоставляет `addJavascriptInterface`, поэтому `AudioBridge` нельзя прикрепить к WebView. Сервис `RadioService` компилируется и может запуститься (хук встроен в `gecko-MainActivity.java`), но в вашем HTML нет `window.InteeAudio`: кнопки откатываются на веб-`<audio>`, а при выключенном экране звук прерывается, потому что runtime передачи из `catalog.js` обнаруживает отсутствие моста и ничего не делает. Для фонового радио с выключенным экраном используйте `capacitor`, `native` или `twa`.
- URL `blob:` (hls.js, встроенный YouTube и всё, что идёт через Media Source Extensions) нельзя передать нативному плееру: при выключенном экране они прерываются. Используйте прямой URL потока или нативное аудио.
- Iframe не трогаются.
- Если ваш HTML ставит паузу в `visibilitychange`, уберите этот слушатель: передача и ваша пауза конфликтуют.

## Ваша HTML-страница


```html
<button onclick="nPlay()">Play</button>
<button onclick="nPause()">Pausa</button>
<script>
  const STREAM = 'https://tu-servidor.com:8000/stream';

  function nPlay() {
    if (window.InteeAudio) InteeAudio.play(STREAM);
    else {
      const a = document.createElement('audio');
      a.src = STREAM; a.play();
    }
  }
  function nPause() {
    if (window.InteeAudio) InteeAudio.pause();
  }
</script>
```

Если вместо нативного аудио вы используете `<audio>` страницы, есть четыре правила, которые почти всегда нарушаются:

1. `src` на `https://`, если только вы не включили незашифрованный HTTP-трафик.
2. Не вызывать `audio.pause()` в `visibilitychange`, `pagehide` и `blur`.
3. Первый `play()` должен идти от касания пользователя: автозапуск заблокирован в WebView.
4. Переподключение в `error`, `stalled` и `ended`. Потоки Shoutcast и Icecast сами по себе падают время от времени, и без повторных попыток тишина похожа на обрыв приложения.

Минимальное переподключение:

```html
<script>
  const a = document.getElementById('player');
  let wantPlay = false;

  document.getElementById('play').onclick = () => {
    if (a.paused) { wantPlay = true; a.load(); a.play().catch(() => {}); }
    else { wantPlay = false; a.pause(); }
  };

  ['error', 'stalled', 'suspend'].forEach(ev => a.addEventListener(ev, () => {
    if (!wantPlay) return;
    setTimeout(() => { a.load(); a.play().catch(() => {}); }, 3000);
  }));

  a.addEventListener('ended', () => {
    if (!wantPlay) return;
    a.load(); a.play().catch(() => {});
  });

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
      wantPlay = true; a.load(); a.play().catch(() => {});
    });
    navigator.mediaSession.setActionHandler('pause', () => { wantPlay = false; a.pause(); });
  }
</script>
```

## Проверка на устройстве

1. Соберите с шаблоном Radio и заполненным `streamUrl`. Перед установкой проверьте в ZIP, что `main-manifest.xml` содержит `RadioService` и `FOREGROUND_SERVICE_MEDIA_PLAYBACK`.
2. Откройте приложение: должно появиться уведомление с кнопкой Play. Если уведомления нет, сервис не запустился — не продолжайте остальные проверки.
3. Нажмите play и сверните: аудио продолжает играть.
4. Выключите экран на 30 секунд: аудио продолжает играть (`WAKE_LOCK` плюс `PARTIAL_WAKE_LOCK` плеера).
5. Убедитесь, что уведомление нельзя смахнуть (`setOngoing(true)`), а его кнопки и кнопки на экране блокировки управляют потоком.

## Если всё равно прерывается

- **Прерывается при выключении экрана** — почти всегда URL `blob:` (hls.js, YouTube), который нельзя передать нативному плееру, либо ваш HTML ставит паузу в `visibilitychange`. С прямой URL и без собственных пауз `WAKE_LOCK` уже включается автоматически вместе с `foreground`.
- **Прерывается при возвращении из фона и не запускается сам** — система поставила элемент на паузу; нажмите play. Если остановили вы из уведомления, это ожидаемое поведение.
- **Уведомление не появляется** — сервис не запустился. Проверьте `servicio instalado: 1` в логе.
- **Прерывается через минуты при видимом уведомлении** — агрессивная оптимизация батареи от производителя. В «Настройках», Приложения, ваше приложение, Батарея: без ограничений и разрешить фоновую активность.
- **Прерывается при сворачивании без уведомления** — в сборке нет Foreground. Пересоберите с `foreground + wakeLock + notifications`.
- **Play отклоняет AAB** — почти всегда `ACCESS_BACKGROUND_LOCATION` без обоснования. Радио оно не нужно.
- **`onPermissionRequest` предоставляет всё** — старый патч с `grant-all`; перегенерируйте проект.

## Связанные ошибки компиляции

`androidx.media.app.NotificationCompat does not exist` появляется в ZIP, собранных более ранней версией workflow. Сервис использует только классы фреймворка (`Notification.MediaStyle`, `MediaPlayer`, `MediaSession`) и не требует androidx-зависимостей для медиа: соберите заново и проверьте `--- audio nativo instalado ---` в логе.

Если `grep -c RadioService` даёт `0` в сгенерированном проекте, не устанавливайте этот APK: сервиса нет. Если `grep -c InteeAudio` даёт `0`, JS-мост не вставлен, и ваши кнопки откатятся на веб-фолбэк, который при выключенном экране прерывается. Единственное ожидаемое исключение — provider `gecko`, где `InteeAudio` не может существовать (GeckoView это запрещает); в этом случае счётчик `0` намеренный, и передача работать не будет.

## Перед публикацией

- Применён шаблон Radio и `streamUrl` с вашим сервером в карточке нативного аудио.
- `main-manifest.xml` с `FOREGROUND_SERVICE_MEDIA_PLAYBACK` и `RadioService`.
- `RadioService.java`, `AudioBridge.java`, `patch-audio.js` присутствуют в ZIP.
- Аудит с `foreground`, `wakeLock` и `notifications` в состоянии `GENERATED` и `verified: true`.
- Страница использует `window.InteeAudio.play(url)`.
- Поток на `https://` с действительным сертификатом.
- Тест 30 секунд с выключенным экраном пройден на целевом устройстве.

Связанная часть про разрешения — в [permissions.md](./permissions.md); если сборка не проходит — [troubleshooting.md](./troubleshooting.md).
