# Настройка диагностики для React Error #306

## ✅ Выполнено

### 1. ErrorBoundary добавлен
- **Файл**: `src/components/ErrorBoundary.tsx` (создан)
- **Интеграция**: `src/App.tsx` - обернут `<Suspense>` в `<ErrorBoundary>`
- **Функционал**: 
  - Логирует детальную информацию об ошибке
  - Показывает маршрут, где произошла ошибка
  - Специальная обработка для React Error #306
  - В development режиме показывает stack trace

### 2. Sourcemap включен для build
- **Файл**: `vite.config.ts`
- **Изменение**: `sourcemap: true` (временно для диагностики)
- **Результат**: Теперь в production build будут доступны source maps для отладки

### 3. Безопасная обработка renderAttachments
- **Файлы**: 
  - `src/components/transactions/OptimizedTransactionCard.tsx`
  - `src/components/transactions/TransactionCard.tsx`
  - `src/pages/TransactionHistoryPage.tsx`
- **Изменение**: `renderAttachments && renderAttachments()` → `renderAttachments ? renderAttachments() : null`
- **Результат**: Гарантирует, что всегда возвращается валидный React элемент или null

### 4. Безопасная обработка в ContextMenu
- **Файл**: `src/components/ContextMenu.tsx`
- **Изменения**:
  - Проверка на `undefined` для всех action handlers
  - Try-catch для обработки ошибок в действиях
  - Условный рендер кнопок только если handlers определены

## 📋 Следующие шаги для диагностики

### Шаг 1: Собрать проект с sourcemap
```bash
npm run build
```

### Шаг 2: Запустить preview
```bash
npm run preview
```

### Шаг 3: Воспроизвести ошибку
1. Открыть `/transactions/history/<id>`
2. Кликнуть на иконку/действие
3. Проверить консоль браузера - теперь должен быть понятный stack trace

### Шаг 4: Проверить ErrorBoundary
Если ошибка произойдет, ErrorBoundary покажет:
- Маршрут, где произошла ошибка
- Сообщение об ошибке
- В development: полный stack trace

## 🔍 Что проверить в консоли

После воспроизведения ошибки в консоли должно быть:
1. **ErrorBoundary caught an error** - детальная информация
2. **Error stack** - стек ошибки
3. **Component stack** - стек компонентов React
4. **Route** - маршрут, где произошла ошибка
5. **Error message** - сообщение об ошибке

Если ошибка #306, дополнительно будет показано:
- "React Error #306 detected - likely rendering undefined/null as component"
- Список типичных причин

## 🎯 Типичные причины React Error #306

1. **Рендеринг undefined как компонент**: `<Icon />` где `Icon === undefined`
2. **Неправильный onClick**: `onClick={handler(x)}` вместо `onClick={() => handler(x)}`
3. **Children содержат undefined/object**: `{someValue}` где `someValue === undefined`
4. **Отсутствующий контекст/провайдер**: `useContext()` возвращает `undefined`
5. **Lazy import вернул undefined**: `lazy(() => import(...))` не экспортирует default

## 📝 Измененные файлы

1. ✅ `src/components/ErrorBoundary.tsx` - создан
2. ✅ `src/App.tsx` - добавлен ErrorBoundary
3. ✅ `vite.config.ts` - включен sourcemap
4. ✅ `src/components/transactions/OptimizedTransactionCard.tsx` - безопасный renderAttachments
5. ✅ `src/components/transactions/TransactionCard.tsx` - безопасный renderAttachments
6. ✅ `src/pages/TransactionHistoryPage.tsx` - безопасный renderAttachments
7. ✅ `src/components/ContextMenu.tsx` - безопасная обработка handlers

## ⚠️ Важно

После диагностики и исправления проблемы:
- Вернуть `sourcemap: process.env.NODE_ENV === 'development'` в `vite.config.ts`
- Sourcemaps в production увеличивают размер бандла
