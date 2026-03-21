import { getIntegrationById } from './integrationRegistry';

/**
 * Базовый префикс детальных страниц настроек интеграций (см. App.tsx).
 * Сопоставление id → путь держим здесь явно, без «магии» в карточках.
 */
export const INTEGRATION_SETTINGS_BASE = '/settings/integrations';

/**
 * Возвращает путь к экрану настроек интеграции или null, если id не из реестра.
 */
export function getIntegrationSettingsPath(integrationId: string): string | null {
  if (!getIntegrationById(integrationId)) {
    if (import.meta.env.DEV) {
      console.warn('[integrations] Неизвестный integrationId для навигации:', integrationId);
    }
    return null;
  }
  return `${INTEGRATION_SETTINGS_BASE}/${integrationId}`;
}
