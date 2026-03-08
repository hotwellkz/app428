/**
 * Идентификатор компании по умолчанию для multi-company архитектуры.
 * Все новые записи в clients, transactions, messages получают этот companyId.
 * Старые записи без companyId считаются принадлежащими этой компании.
 */
export const DEFAULT_COMPANY_ID = 'hotwell';
