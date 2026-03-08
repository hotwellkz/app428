# Миграция legacy-данных в companyId='hotwell'

## По порядку

### 1. Учётные данные Firebase Admin

Один из вариантов:

- **Вариант A.** Положите ключ сервисного аккаунта в корень проекта:
  - `serviceAccountKey.json` или
  - `firebase-service-account.json`
  (скачать: Firebase Console → Project settings → Service accounts → Generate new private key)

- **Вариант B.** Переменная окружения:
  ```bash
  export GOOGLE_APPLICATION_CREDENTIALS=./path/to/serviceAccountKey.json
  ```

- **Вариант C.** JSON в переменной (для CI):
  ```bash
  export FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
  ```

### 2. Dry-run (без записи в Firestore)

```bash
npm run migrate:legacy-to-hotwell:dry
```

Проверьте отчёт: сколько документов будет обновлено по каждой коллекции.

### 3. Реальный запуск миграции

```bash
npm run migrate:legacy-to-hotwell
```

### 4. Индексы Firestore

Уже задеплоены командой:

```bash
npx firebase deploy --only firestore:indexes
```

При необходимости повторите её.

### 5. Проверка после миграции

- Войти под пользователем HotWell → Сотрудники, Склад, Товары, Шаблоны договоров должны показывать старые данные.
- Войти под новой компанией → те же разделы пустые.
