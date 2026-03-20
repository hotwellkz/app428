import type { Handler } from '@netlify/functions';
import {
  adminClaimCampaignItem,
  adminCreateLinkedRunForCampaignItem,
  adminGetCampaignById,
  adminListDispatchableCampaigns,
  adminListPendingCampaignItems,
  adminMarkCampaignItemDispatchError,
  adminMarkCampaignItemDispatched,
  adminRefreshCampaignCounters
} from './lib/voice/voiceCampaignsAdmin';
import { orchestrateVoiceOutbound } from './lib/voice/voiceOutboundOrchestrator';

export async function dispatchVoiceCampaignOnce(campaignId: string, companyId: string): Promise<number> {
  const campaign = await adminGetCampaignById(campaignId);
  if (!campaign || String(campaign.companyId ?? '') !== companyId) return 0;
  if (String(campaign.status ?? '') !== 'running') return 0;
  const maxConcurrent = Math.max(1, Number(campaign.maxConcurrentCalls ?? 2));
  const callsPerMinute = Math.max(1, Number(campaign.callsPerMinute ?? 20));
  const dispatchLimit = Math.max(1, Math.min(maxConcurrent, callsPerMinute));
  const pending = await adminListPendingCampaignItems({ companyId, campaignId, max: dispatchLimit });
  let dispatched = 0;
  for (const item of pending) {
    const claimed = await adminClaimCampaignItem({ companyId, campaignId, itemId: item.id });
    if (!claimed) continue;
    try {
      const runId = await adminCreateLinkedRunForCampaignItem({
        companyId,
        campaignId,
        campaignItemId: item.id,
        botId: String(campaign.botId ?? ''),
        phone: item.normalizedPhone
      });
      const out = await orchestrateVoiceOutbound(companyId, {
        botId: String(campaign.botId ?? ''),
        linkedRunId: runId,
        toE164: item.normalizedPhone,
        fromNumberId: String(campaign.fromNumberId ?? ''),
        metadata: {
          voiceCampaign: { campaignId, campaignItemId: item.id }
        }
      });
      if (!out.ok) {
        await adminMarkCampaignItemDispatchError({ itemId: item.id, error: out.message });
        continue;
      }
      await adminMarkCampaignItemDispatched({ itemId: item.id, callId: out.callId, linkedRunId: runId });
      dispatched += 1;
    } catch (e) {
      await adminMarkCampaignItemDispatchError({ itemId: item.id, error: String(e) });
    }
  }
  await adminRefreshCampaignCounters(campaignId);
  return dispatched;
}

export const handler: Handler = async () => {
  const rows = await adminListDispatchableCampaigns(10);
  let totalDispatched = 0;
  for (const row of rows) {
    totalDispatched += await dispatchVoiceCampaignOnce(row.id, row.companyId);
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, campaigns: rows.length, dispatched: totalDispatched })
  };
};

