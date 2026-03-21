import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { getCompanyIdForUser, getVoiceIntegration, verifyIdToken } from './lib/firebaseAdmin';
import {
  adminCreateCampaign,
  adminGetCampaignById,
  adminListPendingCampaignItems,
  adminUpdateCampaignStatus
} from './lib/voice/voiceCampaignsAdmin';
import { dispatchVoiceCampaignOnce } from './voice-campaign-sweep';
import { getDb } from './lib/firebaseAdmin';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type Body =
  | {
      action: 'create';
      name: string;
      botId: string;
      fromNumberId: string;
      sourceType: 'csv' | 'manual';
      phones: string[];
      maxConcurrentCalls?: number;
      callsPerMinute?: number;
      timezone?: string;
    }
  | { action: 'start' | 'pause' | 'resume' | 'stop'; campaignId: string }
  | { action: 'dispatch_now'; campaignId: string };

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  try {
    const token = String(event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
    const uid = await verifyIdToken(token);
    const companyId = await getCompanyIdForUser(uid);
    if (!companyId) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'No company access' }) };
    const body = (event.body ? JSON.parse(event.body) : {}) as Body;
    if (body.action === 'create') {
      if (!body.name?.trim() || !body.botId?.trim() || !body.fromNumberId?.trim()) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'name/botId/fromNumberId required' }) };
      }
      const db = getDb();
      const integration = await getVoiceIntegration(companyId);
      const outboundPref = integration?.outboundVoiceProvider;
      const outbound =
        outboundPref === 'telnyx' ? 'telnyx' : outboundPref === 'zadarma' ? 'zadarma' : 'twilio';
      const twilioOk =
        integration &&
        integration.enabled === true &&
        integration.connectionStatus === 'connected' &&
        !!(integration.accountSid?.trim() && integration.authToken?.trim());
      const telnyxOk =
        integration &&
        integration.telnyxEnabled === true &&
        integration.telnyxConnectionStatus === 'connected' &&
        !!(integration.telnyxApiKey?.trim() && integration.telnyxPublicKey?.trim());
      const zadarmaOk =
        integration &&
        integration.zadarmaEnabled === true &&
        integration.zadarmaConnectionStatus === 'connected' &&
        !!(integration.zadarmaKey?.trim() && integration.zadarmaSecret?.trim()) &&
        !!(integration.zadarmaCallbackExtension?.trim());
      const voiceOk =
        outbound === 'telnyx' ? telnyxOk : outbound === 'zadarma' ? zadarmaOk : twilioOk;
      if (!voiceOk) {
        return {
          statusCode: 400,
          headers: CORS,
          body: JSON.stringify({
            error:
              outbound === 'telnyx'
                ? 'Telnyx не подключён для компании (проверьте API Key, Public Key и статус в Интеграциях)'
                : outbound === 'zadarma'
                  ? 'Zadarma не подключена для компании (Key, Secret, extension и проверка в Интеграциях)'
                  : 'Twilio не подключен для компании'
          })
        };
      }
      const botSnap = await db.collection('crmAiBots').doc(body.botId.trim()).get();
      if (!botSnap.exists || String(botSnap.data()?.companyId ?? '') !== companyId) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Бот не найден или не принадлежит компании' }) };
      }
      const cfg = (botSnap.data()?.config as Record<string, unknown> | undefined) ?? {};
      if (cfg.voiceEnabled === false) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'У бота отключен voice режим' }) };
      }
      const numberSnap = await db.collection('voiceNumbers').doc(body.fromNumberId.trim()).get();
      if (!numberSnap.exists || String(numberSnap.data()?.companyId ?? '') !== companyId) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Outbound номер не найден в компании' }) };
      }
      const numProv = String(numberSnap.data()?.provider ?? 'twilio').trim() || 'twilio';
      if (numProv !== outbound) {
        return {
          statusCode: 400,
          headers: CORS,
          body: JSON.stringify({
            error: `Номер относится к провайдеру ${numProv}, а в настройках выбран исходящий провайдер ${outbound}`
          })
        };
      }
      const phones = (body.phones ?? []).map((x) => String(x).trim()).filter(Boolean);
      if (!phones.length) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'phones required' }) };
      const campaignId = await adminCreateCampaign({
        companyId,
        createdBy: uid,
        name: body.name.trim(),
        botId: body.botId.trim(),
        fromNumberId: body.fromNumberId.trim(),
        sourceType: body.sourceType ?? 'manual',
        phones,
        maxConcurrentCalls: body.maxConcurrentCalls ?? 2,
        callsPerMinute: body.callsPerMinute ?? 20,
        timezone: body.timezone ?? 'Asia/Almaty'
      });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, campaignId }) };
    }
    const campaignId = 'campaignId' in body ? String(body.campaignId ?? '').trim() : '';
    if (!campaignId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'campaignId required' }) };
    const campaign = await adminGetCampaignById(campaignId);
    if (!campaign || String(campaign.companyId ?? '') !== companyId) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Campaign not found' }) };
    }
    if (body.action === 'start' || body.action === 'resume') {
      await adminUpdateCampaignStatus(campaignId, 'running');
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    }
    if (body.action === 'pause') {
      await adminUpdateCampaignStatus(campaignId, 'paused');
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    }
    if (body.action === 'stop') {
      await adminUpdateCampaignStatus(campaignId, 'completed');
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    }
    if (body.action === 'dispatch_now') {
      const pending = await adminListPendingCampaignItems({ companyId, campaignId, max: 1 });
      if (!pending.length) {
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, message: 'no pending items' }) };
      }
      const dispatched = await dispatchVoiceCampaignOnce(campaignId, companyId);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, dispatched }) };
    }
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: String(e) }) };
  }
};

