# Архитектура раздела «Файлы клиентов»

## Где что хранится

| Что | Где | Примечание |
|-----|-----|------------|
| Список «папок» (клиентов) | **Firestore** `clients` | Фильтр по `companyId`. Источник истины для списка. |
| Список файлов внутри папки | **Supabase Storage** (bucket `clients`) | Путь: `companies/{companyId}/clients/{clientId}/`. Список через `list()`, метаданные не дублируются в Firestore. |
| Тела файлов | **Supabase Storage** bucket `clients` | Только Storage, не Firestore. |

Отдельной Firestore-коллекции для метаданных файлов клиентов **нет**.

## Пути в Supabase Storage

- **Текущая схема (tenant-aware):** `companies/{companyId}/clients/{clientId}/{fileName}`
- **Legacy для HotWell:** `clients/{clientId}/{fileName}` — для обратной совместимости при `companyId === 'hotwell'` список и отображение поддерживают оба варианта (сначала новый путь, при пустоте — legacy).

## Страницы и компоненты

- **`/client-files`** — `AllClientFiles.tsx`: список клиентов из Firestore по `companyId`, для каждого — число файлов из Supabase `list(companies/{companyId}/clients/{clientId})` (и при необходимости legacy).
- **`/clients/:clientId/files`** — `ClientFiles.tsx`: один клиент из Firestore (с проверкой `companyId`), список файлов из Supabase по тому же пути (и legacy для hotwell).

Загрузка новых файлов всегда идёт в путь с `companyId`. Удаление использует сохранённый `path` (работает и для legacy).

## Миграция данных

- **Firestore:** коллекция `clients` уже участвует в общей миграции `companyId='hotwell'`. Отдельный скрипт для «файлов клиентов» не нужен.
- **Supabase:** файлы не перемещаем массово; для HotWell добавлен fallback на legacy-путь `clients/{clientId}`.
