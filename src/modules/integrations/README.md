# Интеграции (каталог + detail)

- **Реестр:** `integrationRegistry.ts` — `id`, `title`, `shortDescription`, `category`, `Icon`.
- **Каталог:** `../../pages/IntegrationsCatalogPage.tsx` — поиск, фильтры, карточки; summary через `hooks/useIntegrationsCatalogSummary.ts` (4 лёгких GET, без списков номеров).
- **Страница интеграции:** `../../pages/integrations/IntegrationDetailPage.tsx` — lazy-панели из `panels/*`.
- **Телефония:** общие данные `hooks/useVoiceTelephonyData.ts` (Twilio + Telnyx + Zadarma + номера) для страниц `twilio`, `telnyx`, `zadarma`.

Новая интеграция: добавить запись в `INTEGRATION_REGISTRY`, создать панель в `panels/`, зарегистрировать в `IntegrationDetailPage.tsx` (`PANELS`), при телефонии — строку в `useIntegrationsCatalogSummary.ts` (`byId`).
