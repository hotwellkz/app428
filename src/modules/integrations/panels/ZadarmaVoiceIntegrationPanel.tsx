import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { IntegrationDetailLayout } from '../components/IntegrationDetailLayout';
import { IntegrationStatusBadge } from '../components/IntegrationStatusBadge';
import type { CatalogIntegrationStatus } from '../types';
import { getIntegrationById } from '../integrationRegistry';
import { useVoiceTelephonyData } from '../hooks/useVoiceTelephonyData';
import { ZadarmaVoiceIntegrationSection } from '../components/ZadarmaVoiceIntegrationSection';

function outboundLabel(pref: string): string {
  if (pref === 'telnyx') return 'Telnyx';
  if (pref === 'zadarma') return 'Zadarma';
  return 'Twilio';
}

export const ZadarmaVoiceIntegrationPanel: React.FC = () => {
  const { user } = useAuth();
  const meta = getIntegrationById('zadarma');
  const { voiceState, zadarmaState, zadarmaNumbers, loading, loadError, refetch } = useVoiceTelephonyData(user?.uid);

  if (!user) {
    return (
      <IntegrationDetailLayout title={meta?.title ?? 'Zadarma'} description={meta?.shortDescription ?? ''}>
        <p className="text-gray-500">Войдите в аккаунт.</p>
      </IntegrationDetailLayout>
    );
  }

  let st: CatalogIntegrationStatus = 'not_connected';
  let stLabel = 'Не подключено';
  if (zadarmaState.configured || zadarmaState.keyMasked) {
    if (zadarmaState.connectionStatus === 'invalid_config' || zadarmaState.connectionError) {
      st = 'error';
      stLabel = 'Ошибка';
    } else if (!zadarmaState.voiceReady) {
      st = 'needs_setup';
      stLabel = 'Требует настройки';
    } else {
      st = 'connected';
      stLabel = voiceState.outboundVoiceProvider === 'zadarma' ? 'Готово (исходящий)' : 'Готово';
    }
  }

  return (
    <IntegrationDetailLayout
      title={meta?.title ?? 'Zadarma'}
      description="Виртуальная АТС Zadarma: входящие и исходящие звонки. Данные и номера изолированы по компании."
      meta={
        <div className="flex flex-wrap items-center gap-2">
          <IntegrationStatusBadge status={st} label={stLabel} />
          {loadError ? <span className="text-xs text-rose-600">{loadError}</span> : null}
          <Link to="/settings/integrations/twilio" className="text-xs text-violet-600 hover:underline">
            Исходящий провайдер по умолчанию: {outboundLabel(voiceState.outboundVoiceProvider)} → сменить
          </Link>
        </div>
      }
    >
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Загрузка…
          </div>
        ) : (
          <ZadarmaVoiceIntegrationSection
            userUid={user.uid}
            outboundVoiceProvider={voiceState.outboundVoiceProvider}
            zadarmaState={zadarmaState}
            zadarmaNumbers={zadarmaNumbers}
            refetch={refetch}
          />
        )}
      </div>
      <p className="text-xs text-gray-500">
        Twilio и Telnyx настраиваются отдельными карточками. Номера для исходящих импортируйте через «Синхронизировать номера» в блоке выше.
      </p>
    </IntegrationDetailLayout>
  );
};
