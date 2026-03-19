import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { getDb } from './lib/firebaseAdmin';
import { processAiControlAlertsForCompany } from './lib/aiControlAlerting';

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.headers['x-netlify-scheduled'] !== 'true' && event.trigger !== 'schedule') {
    return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'not scheduled' }) };
  }

  const db = getDb();
  const companiesSnap = await db.collection('companies').where('status', '==', 'active').get();
  const results: Array<{ companyId: string; processed: number; actions: number }> = [];

  for (const c of companiesSnap.docs) {
    const out = await processAiControlAlertsForCompany(db, c.id);
    results.push({ companyId: c.id, processed: out.processed, actions: out.actions.length });
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, companies: results.length, results })
  };
};
