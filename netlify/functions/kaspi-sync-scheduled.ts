/**
 * Запланированная синхронизация заказов Kaspi: 4 раза в день.
 * Запускается по расписанию (cron) и синхронизирует заказы для всех компаний,
 * у которых включена интеграция и выбран режим «4 раза в день».
 *
 * В netlify.toml или UI Netlify настройте расписание, например:
 * 0 9,13,17,21 * * * (каждый день в 09:00, 13:00, 17:00, 21:00 по UTC)
 */
import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { getDb } from './lib/firebaseAdmin';
import { runKaspiSyncForCompany } from './lib/kaspiSyncRun';

const LOG_PREFIX = '[kaspi-sync-scheduled]';

function log(...args: unknown[]) {
  console.log(LOG_PREFIX, ...args);
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.headers['x-netlify-scheduled'] !== 'true' && event.trigger !== 'schedule') {
    log('Skip: not a scheduled run');
    return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'not scheduled' }) };
  }

  const db = getDb();
  const snap = await db
    .collection('kaspiIntegrations')
    .where('enabled', '==', true)
    .where('syncMode', '==', 'four_times_daily')
    .get();

  const companyIds = snap.docs.map((d) => d.id);
  if (!companyIds.length) {
    log('No companies with four_times_daily sync');
    return { statusCode: 200, body: JSON.stringify({ ok: true, companies: 0 }) };
  }

  log('Running sync for companies:', companyIds.length, companyIds);

  const results: Array<{ companyId: string; ok: boolean; processed: number; error?: string }> = [];
  for (const companyId of companyIds) {
    try {
      const result = await runKaspiSyncForCompany(companyId);
      results.push({
        companyId,
        ok: result.ok,
        processed: result.processed,
        error: result.error
      });
      if (!result.ok && result.error) log(companyId, result.error);
    } catch (e) {
      log(companyId, 'exception', e);
      results.push({ companyId, ok: false, processed: 0, error: String(e) });
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, companies: results.length, results })
  };
};
