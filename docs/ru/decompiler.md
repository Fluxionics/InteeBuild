# Decompiler: восстановление конфигурации из APK

Загрузите APK и извлечь из него пакет, разрешения, манифест и ZIP с содержимым. Используется на шаге «Собирать» в студии (`Descompilador APK`) или через API. Есть два режима с разным охватом: локальный, работающий с AXML и DEX в браузере и на сервере, и облачный, запускающий jadx и apktool в GitHub Actions и возвращающий настоящий Java-код.

Локальный работает мгновенно и не требует GitHub. Облачный занимает одну-три минуты и требует тех же `GITHUB_TOKEN` и `INTEE_BUILDS_REPO`, что и сборки.

## Локальный режим

```bash
curl -X POST /api/decompile -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
```

Также принимается APK в виде тела `application/octet-stream` и поле `buffer`. Минимум — 100 байт, максимум — 100 МБ. Всё обрабатывается на сервере, и бинарный файл не попадает во внешние сервисы.

Ответ выглядит так:

```json
{
  "ok": true,
  "meta": { "packageName": "com.example.app", "appName": "Mi App", "permissions": ["android.permission.CAMERA"], "hasIcon": true, "hasDex": true, "fileCount": 120, "versionName": "1.0.0", "sizeKB": 2048 },
  "axml": { "binary": true, "package": "com.example.app", "permissions": [], "minSdk": 23, "targetSdk": 35 },
  "dex": { "classCount": 900, "methodCount": 5200, "libs": ["capacitor"], "hasCapacitor": true },
  "entries": ["AndroidManifest.xml", "classes.dex", "res/…"],
  "manifestPreview": "<manifest …>…",
  "importConfig": { "appName": "…", "packageName": "…", "url": "https://example.com", "permissions": {} },
  "sourceZipBase64": "UEs…",
  "sourceZipSizeKB": 450,
  "note": "APK real: AXML decodificado (9 permisos) + DEX (900 clases, libs: capacitor) + importConfig con keys reales + ZIP fuente"
}
```

`note` текстом объясняет, что удалось восстановить, и меняется в зависимости от случая:

- APK от InteeBuild: внутри находится `build-config.json`, и он возвращается как есть в виде `importConfig`. Это случай восстановления на 100%.
- Обычный APK: декодируется манифест AXML, читаются `capacitor.config.json`, `www/index.html` или `assets/www/index.html`, если они есть, и разбираются до пяти файлов `classes*.dex` для обнаружения библиотек (Capacitor, Droncito, ARCore, MLKit, web3j, MQTT, GVR, Firebase, AdMob). `importConfig` собирается из прочитанного, а URL заполняется как `https://example.com`.
- Обычный ZIP: перечисляются файлы и упаковывается всё, что есть.

В исходный ZIP попадают файлы меньше 4 МБ, а также `DECODED-AndroidManifest.xml` и JSON-файлы `decompiler-axml.json` и `decompiler-dex.json` с извлечённым. Если файл тяжелее, он остаётся снаружи, чтобы не сломать браузер.

`manifestPreview` содержит первые 8000 символов; если манифест бинарный и в нём нет читаемых строк, возвращается предупреждение, а данные оказываются в `axml.permissions`.

## Облачный режим (jadx + apktool)

```bash
curl -X POST /api/decompile/cloud -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
# → 202 {"ok":true,"id":"ab12cd34","branch":"decompile-ab12cd34","tools":"jadx 1.5.1 + apktool 2.9.3","statusUrl":"…","downloadUrl":"…"}
```

APK загружается как `input/app.apk` во временную ветку `decompile-<id>` репозитория сборок, с workflow `decompile-app.yml`. Этот workflow запускает jadx 1.5.1 для Java-исходников и apktool 2.9.3 для манифеста, ресурсов и smali и выгружает результат артефактом с `retention-days: 7`. Ветка с APK удаляется через 20 минут.

Статус:

```bash
curl /api/decompile/cloud/ab12cd34/status
# → {"id":"…","branch":"…","status":"completed","conclusion":"success","runUrl":"…","artifacts":[{"name":"inteebuild-decompile-ab12cd34","id":1,"sizeKB":812}],"ready":true}
```

`ready` равно `true` только когда запуск успешно завершён и есть артефакты. Пока запуска нет, возвращается `status: "queued"`. Студия опрашивает каждые 5 секунд с пределом в 5 минут.

```bash
curl -L -o fuentes.zip /api/decompile/cloud/ab12cd34/download
```

В ZIP входят `output/sources/**/*.java`, `output/resources/**` с res, smali и manifest, `output/AndroidManifest-decoded.xml` и `output/REPORT.txt`. Если workflow ещё выполняется, endpoint отвечает `409`; если он завершился без артефакта — `404` со ссылкой на логи.

Лимиты облачного режима: 60 МБ (это допускают git-блобы), тот же rate limit — 10 сборок в час на IP, что и у остальных сборок, а артефакты устаревают через 7 дней. Ошибается на APK, обфусцированных коммерческими обфускаторами.

## Рабочий процесс в студии

1. На шаге «Собирать», внутри `Descompilador APK`, выберите файл и нажмите `Descompilar`.
2. Проверьте `packageName`, разрешения, `Manifest preview` и заметки о том, что удалось прочитать.
3. Нажмите кнопку импорта из результата: мастер заполнится именем, пакетом, URL и разрешениями.
4. Пройдите Audit на шаге «Разрешения» перед сборкой.
5. Если нужен настоящий Java-код, нажмите `Decompilar en la nube (jadx + apktool)` и скачайте ZIP с исходниками.

Тот же путь работает и через API: `POST /api/decompile`, `importConfig`, `POST /api/build` с этими полями — и к сборке.

## Чего это не делает

- Не деобфусцирует код. Коммерческие обфускаторы дают код, который jadx возвращает нечитаемым или неполным.
- Не извлекает ключи, сертификаты и обфусцированные ресурсы.
- `importConfig` чужого APK использует `https://example.com` в качестве URL: замените его на настоящий перед сборкой.
- Не превращает APK в полный проект Gradle: возвращаются манифест, конфигурация и ZIP с содержимым, чтобы импортировать всё обратно в InteeBuild.

Если нужно просто осмотреть APK без повторного импорта, `POST /api/inspect` возвращает техническую карточку и `security.score` с более низким лимитом в 30 МБ. Подробности про лимиты и rate limit — в [api.md](./api.md).
