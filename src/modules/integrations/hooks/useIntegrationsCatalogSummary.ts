import { useCallback, useEffect, useState } from 'react';
import { getAuthToken } from '../../../lib/firebase/auth';
import {
  API_KASPI_INTEGRATION,
  API_OPENAI_INTEGRATION,
  API_VOICE_INTEGRATION,
  API_WAZZUP_INTEGRATION
} from '../apiEndpoints';
import type { CatalogIntegrationStatus, IntegrationCardModel } from '../types';
import { INTEGRATION_REGISTRY } from '../integrationRegistry';

function wazzupCard(
  data: Record<string, unknown> | null,
  loadError: boolean
): Pick<IntegrationCardModel, 'status' | 'statusLabel' | 'summaryLine' | 'lastCheckedAt'> {
  if (loadError || !data) {
    return {
      status: 'error',
      statusLabel: 'Ошибка загрузки',
      summaryLine: 'Не удалось загрузить статус',
      lastCheckedAt: null
    };
  }
  const configured = data.configured === true;
  const err = typeof data.connectionError === 'string' ? data.connectionError : null;
  const last = typeof data.lastCheckedAt === 'string' ? data.lastCheckedAt : null;
  if (!configured) {
    return {
      status: 'not_connected',
      statusLabel: 'Не подключено',
      summaryLine: 'Укажите API ключ Wazzup',
      lastCheckedAt: last
    };
  }
  if (err) {
    return {
      status: 'error',
      statusLabel: 'Ошибка',
      summaryLine: err.slice(0, 120),
      lastCheckedAt: last
    };
  }
  const wa = data.whatsappChannelId ? 'WA ✓' : 'WA — уточните канал';
  const ig = data.instagramChannelId ? 'IG ✓' : 'IG — уточните канал';
  return {
    status: 'connected',
    statusLabel: 'Подключено',
    summaryLine: `${wa} · ${ig}`,
    lastCheckedAt: last
  };
}

function openaiCard(
  data: Record<string, unknown> | null,
  loadError: boolean
): Pick<IntegrationCardModel, 'status' | 'statusLabel' | 'summaryLine' | 'lastCheckedAt'> {
  if (loadError) {
    return {
      status: 'error',
      statusLabel: 'Ошибка',
      summaryLine: 'Не удалось загрузить',
      lastCheckedAt: null
    };
  }
  const configured = data?.configured === true;
  const masked = typeof data?.apiKeyMasked === 'string' ? data.apiKeyMasked : null;
  if (!configured) {
    return {
      status: 'not_connected',
      statusLabel: 'Не подключено',
      summaryLine: 'Сохраните API ключ OpenAI',
      lastCheckedAt: null
    };
  }
  return {
    status: 'connected',
    statusLabel: 'Ключ сохранён',
    summaryLine: masked ? `Ключ ${masked}` : 'Ключ сохранён',
    lastCheckedAt: null
  };
}

function kaspiCard(
  data: Record<string, unknown> | null,
  loadError: boolean
): Pick<IntegrationCardModel, 'status' | 'statusLabel' | 'summaryLine' | 'lastCheckedAt'> {
  if (loadError) {
    return {
      status: 'error',
      statusLabel: 'Ошибка',
      summaryLine: 'Не удалось загрузить',
      lastCheckedAt: null
    };
  }
  const configured = data?.configured === true;
  const enabled = data?.enabled === true;
  const merchantId = typeof data?.merchantId === 'string' && data.merchantId ? data.merchantId : null;
  const lastSync = typeof data?.lastSyncAt === 'string' ? data.lastSyncAt : null;
  const syncSt = data?.lastSyncStatus as 'success' | 'error' | null | undefined;
  const syncMsg = typeof data?.lastSyncMessage === 'string' ? data.lastSyncMessage : null;
  if (!configured) {
    return {
      status: 'not_connected',
      statusLabel: 'Не подключено',
      summaryLine: 'Укажите API ключ Kaspi',
      lastCheckedAt: null
    };
  }
  let status: CatalogIntegrationStatus = 'connected';
  let label = enabled ? 'Активна' : 'Выключена';
  let line = merchantId ? `Merchant ID сохранён` : 'Настройте Merchant ID при необходимости';
  if (syncSt === 'error' && syncMsg) {
    status = 'error';
    label = 'Ошибка синхр.';
    line = syncMsg.slice(0, 100);
  } else if (lastSync) {
    line = `Синхр.: ${new Date(lastSync).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}`;
  }
  return {
    status,
    statusLabel: label,
    summaryLine: line,
    lastCheckedAt: lastSync
  };
}

function twilioCard(
  voice: Record<string, unknown> | null,
  loadError: boolean
): Pick<IntegrationCardModel, 'status' | 'statusLabel' | 'summaryLine' | 'lastCheckedAt'> {
  if (loadError || !voice) {
    return {
      status: 'error',
      statusLabel: 'Ошибка',
      summaryLine: 'Не удалось загрузить Voice',
      lastCheckedAt: null
    };
  }
  const configured = voice.configured === true;
  const conn = (voice.connectionStatus as string) || 'not_connected';
  const ready = voice.voiceReady === true;
  const outboundPref = String(voice.outboundVoiceProvider ?? 'twilio');
  const outbound =
    outboundPref === 'telnyx' ? 'Telnyx' : outboundPref === 'zadarma' ? 'Zadarma' : 'Twilio';
  const err = typeof voice.connectionError === 'string' ? voice.connectionError : null;
  const last = typeof voice.lastCheckedAt === 'string' ? voice.lastCheckedAt : null;
  if (!configured) {
    return {
      status: 'not_connected',
      statusLabel: 'Не подключено',
      summaryLine: 'Account SID и Auth Token',
      lastCheckedAt: last
    };
  }
  if (err || conn === 'invalid_config') {
    return {
      status: 'error',
      statusLabel: 'Ошибка',
      summaryLine: err || 'Проверьте учётные данные Twilio',
      lastCheckedAt: last
    };
  }
  if (!ready) {
    return {
      status: 'needs_setup',
      statusLabel: 'Требует настройки',
      summaryLine: `Исходящий: ${outbound} · номер по умолчанию или провайдер`,
      lastCheckedAt: last
    };
  }
  return {
    status: 'connected',
    statusLabel: 'Готово',
    summaryLine: `Исходящий: ${outbound} · voice ready`,
    lastCheckedAt: last
  };
}

function telnyxCard(
  telnyx: Record<string, unknown> | null,
  voiceMain: Record<string, unknown> | null,
  loadError: boolean
): Pick<IntegrationCardModel, 'status' | 'statusLabel' | 'summaryLine' | 'lastCheckedAt'> {
  if (loadError || !telnyx) {
    return {
      status: 'error',
      statusLabel: 'Ошибка',
      summaryLine: 'Не удалось загрузить Telnyx',
      lastCheckedAt: null
    };
  }
  const outbound = voiceMain?.outboundVoiceProvider === 'telnyx';
  const ready = telnyx.voiceReady === true;
  const conn = (telnyx.connectionStatus as string) || 'not_connected';
  const err = typeof telnyx.connectionError === 'string' ? telnyx.connectionError : null;
  const blocking = typeof telnyx.blockingReason === 'string' ? telnyx.blockingReason : null;
  const last = typeof telnyx.lastCheckedAt === 'string' ? telnyx.lastCheckedAt : null;
  const webhookOk = telnyx.webhookSignatureOk !== false;

  if (conn === 'invalid_config' || err) {
    return {
      status: 'error',
      statusLabel: 'Ошибка',
      summaryLine: (err || blocking || 'Проверьте ключи и Call Control').slice(0, 120),
      lastCheckedAt: last
    };
  }
  if (!ready) {
    return {
      status: 'needs_setup',
      statusLabel: 'Требует настройки',
      summaryLine: `${outbound ? 'Выбран исходящий Telnyx · ' : ''}${webhookOk ? 'webhook OK' : 'webhook · проверьте подпись'}`.trim(),
      lastCheckedAt: last
    };
  }
  return {
    status: 'connected',
    statusLabel: outbound ? 'Готово (исходящий)' : 'Готово',
    summaryLine: `Voice ready · webhook ${webhookOk ? 'OK' : 'внимание'}`,
    lastCheckedAt: last
  };
}

function zadarmaCard(
  zadarma: Record<string, unknown> | null,
  voiceMain: Record<string, unknown> | null,
  loadError: boolean
): Pick<IntegrationCardModel, 'status' | 'statusLabel' | 'summaryLine' | 'lastCheckedAt'> {
  if (loadError || !voiceMain) {
    return {
      status: 'error',
      statusLabel: 'Ошибка',
      summaryLine: 'Не удалось загрузить статус Zadarma',
      lastCheckedAt: null
    };
  }
  if (!zadarma) {
    return {
      status: 'not_connected',
      statusLabel: 'Не подключено',
      summaryLine: 'Укажите API Key и Secret Zadarma',
      lastCheckedAt: null
    };
  }
  const outbound = voiceMain.outboundVoiceProvider === 'zadarma';
  const ready = zadarma.voiceReady === true;
  const conn = (zadarma.connectionStatus as string) || 'not_connected';
  const err = typeof zadarma.connectionError === 'string' ? zadarma.connectionError : null;
  const blocking = typeof zadarma.blockingReason === 'string' ? zadarma.blockingReason : null;
  const last = typeof zadarma.lastCheckedAt === 'string' ? zadarma.lastCheckedAt : null;
  const webhookOk = zadarma.webhookSignatureOk !== false;
  const configured = zadarma.configured === true;

  if (!configured && !zadarma.keyMasked) {
    return {
      status: 'not_connected',
      statusLabel: 'Не подключено',
      summaryLine: 'Ключи API и extension для callback',
      lastCheckedAt: last
    };
  }
  if (conn === 'invalid_config' || err) {
    return {
      status: 'error',
      statusLabel: 'Ошибка',
      summaryLine: (err || blocking || 'Проверьте ключи и webhook в кабинете Zadarma').slice(0, 120),
      lastCheckedAt: last
    };
  }
  if (!ready) {
    return {
      status: 'needs_setup',
      statusLabel: 'Требует настройки',
      summaryLine: `${outbound ? 'Выбран исходящий Zadarma · ' : ''}${webhookOk ? 'webhook OK' : 'проверьте webhook и подпись'}`.trim(),
      lastCheckedAt: last
    };
  }
  return {
    status: 'connected',
    statusLabel: outbound ? 'Готово (исходящий)' : 'Готово',
    summaryLine: `Voice ready · webhook ${webhookOk ? 'OK' : 'внимание'}`,
    lastCheckedAt: last
  };
}

export function useIntegrationsCatalogSummary(userUid: string | undefined) {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<IntegrationCardModel[]>(() =>
    INTEGRATION_REGISTRY.map((m) => ({
      ...m,
      status: 'not_connected' as const,
      statusLabel: '…',
      summaryLine: null,
      lastCheckedAt: null,
      loading: true
    }))
  );
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!userUid) {
      setLoading(false);
      setCards(
        INTEGRATION_REGISTRY.map((m) => ({
          ...m,
          status: 'not_connected',
          statusLabel: 'Войдите',
          summaryLine: null,
          lastCheckedAt: null
        }))
      );
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      const token = await getAuthToken();
      if (!token || cancelled) {
        setLoading(false);
        return;
      }

      const [wazzupRes, openaiRes, kaspiRes, voiceRes] = await Promise.all([
        fetch(API_WAZZUP_INTEGRATION, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(API_OPENAI_INTEGRATION, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(API_KASPI_INTEGRATION, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(API_VOICE_INTEGRATION, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const wazzupJson = wazzupRes.ok ? ((await wazzupRes.json().catch(() => ({}))) as Record<string, unknown>) : null;
      const openaiJson = openaiRes.ok ? ((await openaiRes.json().catch(() => ({}))) as Record<string, unknown>) : null;
      const kaspiJson = kaspiRes.ok ? ((await kaspiRes.json().catch(() => ({}))) as Record<string, unknown>) : null;
      const voiceJson = voiceRes.ok ? ((await voiceRes.json().catch(() => ({}))) as Record<string, unknown>) : null;
      const telnyxJson =
        voiceJson && typeof voiceJson.telnyx === 'object' && voiceJson.telnyx
          ? (voiceJson.telnyx as Record<string, unknown>)
          : null;
      const zadarmaJson =
        voiceJson && typeof voiceJson.zadarma === 'object' && voiceJson.zadarma
          ? (voiceJson.zadarma as Record<string, unknown>)
          : null;

      if (cancelled) return;

      const w = wazzupCard(wazzupJson, !wazzupRes.ok);
      const o = openaiCard(openaiJson, !openaiRes.ok);
      const k = kaspiCard(kaspiJson as Record<string, unknown> | null, !kaspiRes.ok);
      const t = twilioCard(voiceJson, !voiceRes.ok);
      const tx = telnyxCard(telnyxJson, voiceJson, !voiceRes.ok);
      const zd = zadarmaCard(zadarmaJson, voiceJson, !voiceRes.ok);

      const byId: Record<string, Pick<IntegrationCardModel, 'status' | 'statusLabel' | 'summaryLine' | 'lastCheckedAt'>> = {
        wazzup: w,
        openai: o,
        kaspi: k,
        twilio: t,
        telnyx: tx,
        zadarma: zd
      };

      setCards(
        INTEGRATION_REGISTRY.map((m) => ({
          ...m,
          ...byId[m.id],
          loading: false
        }))
      );
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userUid, refreshKey]);

  return { cards, loading, refetch };
}
