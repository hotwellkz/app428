/**
 * Утилиты для защиты от undefined компонентов и импортов
 * Предотвращает React error #306 (rendering undefined/null)
 */

import React from 'react';

/**
 * Проверяет, что компонент не является undefined/null
 * @param component - Компонент для проверки
 * @param componentName - Имя компонента для логирования
 * @returns true если компонент валиден, false иначе
 */
export function validateComponent<T extends React.ComponentType<any>>(
  component: T | undefined | null,
  componentName: string
): component is T {
  if (!component) {
    console.error(`[ComponentGuard] ${componentName} is undefined or null`);
    return false;
  }
  return true;
}

/**
 * Создает fallback компонент для замены undefined компонента
 * @param componentName - Имя компонента
 * @returns Fallback компонент
 */
export function createFallbackComponent(componentName: string): React.FC<any> {
  return (props: any) => {
    console.error(`[ComponentGuard] Rendering fallback for ${componentName}`);
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded text-red-600">
        <p className="font-semibold">Ошибка загрузки компонента</p>
        <p className="text-sm">{componentName} не загружен</p>
      </div>
    );
  };
}

/**
 * Безопасный импорт компонента с fallback
 * @param component - Компонент для проверки
 * @param componentName - Имя компонента
 * @returns Валидный компонент или fallback
 */
export function safeComponent<T extends React.ComponentType<any>>(
  component: T | undefined | null,
  componentName: string
): T {
  if (validateComponent(component, componentName)) {
    return component;
  }
  return createFallbackComponent(componentName) as T;
}

/**
 * Типы для проверки именованных экспортов
 */
export type NamedExport<T> = {
  [K in keyof T]: T[K];
};

/**
 * Проверяет, что модуль содержит ожидаемый именованный экспорт
 * @param module - Модуль для проверки
 * @param exportName - Имя экспорта
 * @returns true если экспорт существует, false иначе
 */
export function validateNamedExport<T>(
  module: any,
  exportName: string
): module is NamedExport<{ [key: string]: T }> {
  if (!module) {
    console.error(`[ComponentGuard] Module is undefined for export ${exportName}`);
    return false;
  }
  if (!(exportName in module)) {
    console.error(`[ComponentGuard] Export ${exportName} not found in module`, Object.keys(module));
    return false;
  }
  if (!module[exportName]) {
    console.error(`[ComponentGuard] Export ${exportName} is null/undefined`);
    return false;
  }
  return true;
}
