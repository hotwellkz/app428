/**
 * Канонический id счёта/категории для маршрутизации и записей в Firestore.
 * Должен совпадать везде: Feed edit modal, клик по иконке на /transactions,
 * route /transactions/history/:id, запросы transactions где categoryId, correction docs.
 */
export function getCanonicalCategoryId(category: { id: string }): string {
  const id = category.id;
  return typeof id === 'string' ? id : String(id);
}
