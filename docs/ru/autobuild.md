# Авто-сборка при Push

InteeBuild может автоматически собирать ваше приложение при каждом `push` в настроенную ветку вашего GitHub-репозитория.

---

## 1. Предварительные требования

- Репозиторий на GitHub (публичный или приватный).
- **Personal Access Token (PAT)** GitHub с правами `repo`, `workflow`, `admin:repo_hook`.
- Сервер InteeBuild настроен с `GITHUB_TOKEN` и `INTEE_BUILDS_REPO` в `.env`.

---

## 2. Конфигурация в репозитории (`.inteebuild/config.json`)

Создайте файл `.inteebuild/config.json` в корне репозитория. Он определяет параметры сборки.

```json
{
  "url": "https://ваш-сайт.com",
  "appName": "МоеПриложение",
  "packageName": "com.mycompany.myapp",
  "outputType": "apk",
  "platform": "android",
  "provider": "capacitor",
  "versionName": "1.0.0",
  "versionCode": 1,
  "compileSdk": 35,
  "targetSdk": 35,
  "minSdk": 23,
  "permissions": {
    "INTERNET": true,
    "CAMERA": false
  },
  "iconBase64": "",
  "keystoreBase64": "",
  "keystorePassword": "",
  "keyPassword": "",
  "outputs": ["apk"]
}
```

> **Примечание**: Все поля опциональны, кроме `url` и `appName`. Если `packageName` не указан, генерируется автоматически. Права отображаются на гранулярные разрешения InteeBuild.

---

## 3. Подключение репозитория в InteeBuild

### Вариант А: Из UI (Studio)

1. Откройте InteeBuild Studio (`index.html`).
2. Перейдите в **Аккаунт → Git-интеграции**.
3. Нажмите **Подключить репозиторий**.
4. Заполните:
   - **Repo**: `user/repo` (напр. `myuser/myapp`).
   - **Ветка**: `main` (или ваша продакшн-ветка).
   - **Token**: Ваш GitHub PAT.
   - **Webhook URL**: Автозаполнится URL вашего InteeBuild + `/api/git/webhook`.
5. Нажмите **Сохранить**.

### Вариант Б: Через API

```bash
curl -X POST https://ваш-inteebuild.com/api/git/connect \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "user/repo",
    "branch": "main",
    "token": "ghp_xxxxxxxxxxxx",
    "webhookUrl": "https://ваш-inteebuild.com/api/git/webhook"
  }'
```

---

## 4. Как работает вебхук

При сохранении интеграции InteeBuild сохраняет конфигурацию. **Вебхук в GitHub НЕ создаётся автоматически** (из-за ограничений прав PAT). Создайте вебхук вручную в GitHub:

1. В вашем репозитории GitHub → **Settings → Webhooks → Add webhook**.
2. **Payload URL**: `https://ваш-inteebuild.com/api/git/webhook`
3. **Content type**: `application/json`
4. **Events**: Выберите **Just the push event**.
5. **Active**: ✓

При `push` в настроенную ветку:
1. GitHub шлёт payload на `/api/git/webhook`.
2. InteeBuild проверяет наличие интеграции для `repo#branch`.
3. Читает `.inteebuild/config.json` из коммита (если есть) или использует дефолты.
4. Запускает сборку через `startBuild()` (локальная очередь → GitHub Actions).
5. Возвращает `{ "ok": true, "buildId": "abcd", "branch": "main" }`.

---

## 5. Полный процесс

```
push в main
    │
    ▼
GitHub Webhook → /api/git/webhook
    │
    ▼
InteeBuild ищет интеграцию (repo + branch)
    │
    ▼
Читает .inteebuild/config.json из коммита (опционально)
    │
    ▼
Ставит в локальную очередь (макс. 3 одновременно)
    │
    ▼
Синхронизирует workflow (.github/workflows/build-app.yml)
    │
    ▼
Загружает проект во временную ветку (build-xxxx)
    │
    ▼
Запускает workflow_dispatch в GitHub Actions
    │
    ▼
GitHub Actions собирает (Gradle / Flutter / Tauri / etc.)
    │
    ▼
Загружает артефакты (APK, AAB, IPA, EXE, DMG…)
    │
    ▼
InteeBuild детектирует завершение (опрос каждые 6с)
    │
    ▼
Сохраняет в историю + уведомляет настроенный вебхук (опционально)
```

---

## 6. Просмотр автоматических сборок

- В Studio: **История** → фильтр по статусу.
- Через API: `GET /api/build/:id` или `GET /api/v1/build/:id`.
- Вебхук уведомлений: Настройте `webhookUrl` в интеграции или конфиге для получения `build.completed` / `build.failed`.

---

## 7. Устранение неполадок

| Проблема | Причина | Решение |
|----------|---------|---------|
| Webhook 404 | Интеграция не найдена | Проверьте точные `repo` и `branch` в InteeBuild |
| Ошибка "config not found" | Нет `.inteebuild/config.json` | Добавьте файл или задайте дефолты в интеграции |
| Rate limit 429 | >10 сборок/час/IP | Подождите или используйте другой IP |
| Workflow отсутствует | Первая сборка в новом репо | Первый push создаёт workflow автоматически |

---

## 8. Справочник API

| Эндпоинт | Метод | Описание |
|----------|-------|----------|
| `/api/git/integrations` | GET | Список интеграций |
| `/api/git/connect` | POST | Создать интеграцию |
| `/api/git/:id` | DELETE | Удалить интеграцию |
| `/api/git/webhook` | POST | Принять вебхук GitHub (внутренний) |
| `/api/build/:id` | GET | Статус сборки (с `phase`, `percent`, `queuePos`, `actionsSteps`) |
| `/api/v1/build/:id` | GET | Статус v1 (аналогично + `buildId`, `apkUrl`, `aabUrl`…) |

---

## 9. Безопасность

- GitHub токен хранится **хешированно (усечённый SHA-256)** в `data/git-integrations.json`. Токен в открытом виде **используется только при создании интеграции** и опционально сохраняется в `rawToken` для удаления вебхука.
- Ветки сборки (`build-*`, `decompile-*`) авто-удаляются через 60 сек после завершения.
- Артефакты и runs Actions очищаются через 30 мин.