/**
 * Человекочитаемые подсказки по кодам ошибок Firestore (запись / чтение).
 */
export function getFirestoreErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: unknown }).code);
    switch (code) {
      case 'permission-denied':
        return 'Нет прав записи. Для автоворонок нужны правила Firestore с коллекцией crmAiBots — выполните: firebase deploy --only firestore:rules';
      case 'unavailable':
        return 'Сервис Firestore временно недоступен. Попробуйте позже.';
      case 'failed-precondition':
        return 'Нарушено условие операции (например, индекс). См. консоль браузера.';
      default:
        break;
    }
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return '';
}
