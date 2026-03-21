import React, { Suspense, lazy, useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { PageMetadata } from '../../components/PageMetadata';
import { getIntegrationById } from '../../modules/integrations/integrationRegistry';

const WazzupIntegrationPanel = lazy(() =>
  import('../../modules/integrations/panels/WazzupIntegrationPanel').then((m) => ({ default: m.WazzupIntegrationPanel }))
);
const OpenAIIntegrationPanel = lazy(() =>
  import('../../modules/integrations/panels/OpenAIIntegrationPanel').then((m) => ({ default: m.OpenAIIntegrationPanel }))
);
const KaspiIntegrationPanel = lazy(() =>
  import('../../modules/integrations/panels/KaspiIntegrationPanel').then((m) => ({ default: m.KaspiIntegrationPanel }))
);
const TwilioVoiceIntegrationPanel = lazy(() =>
  import('../../modules/integrations/panels/TwilioVoiceIntegrationPanel').then((m) => ({
    default: m.TwilioVoiceIntegrationPanel
  }))
);
const TelnyxVoiceIntegrationPanel = lazy(() =>
  import('../../modules/integrations/panels/TelnyxVoiceIntegrationPanel').then((m) => ({
    default: m.TelnyxVoiceIntegrationPanel
  }))
);

const PANELS: Record<string, React.LazyExoticComponent<React.FC>> = {
  wazzup: WazzupIntegrationPanel,
  openai: OpenAIIntegrationPanel,
  kaspi: KaspiIntegrationPanel,
  twilio: TwilioVoiceIntegrationPanel,
  telnyx: TelnyxVoiceIntegrationPanel
};

const PanelFallback = () => (
  <div className="flex items-center justify-center py-24 text-gray-500 gap-2">
    <Loader2 className="h-5 w-5 animate-spin" />
    Загрузка…
  </div>
);

export const IntegrationDetailPage: React.FC = () => {
  const { integrationId } = useParams<{ integrationId: string }>();
  const { user } = useAuth();

  const def = integrationId ? getIntegrationById(integrationId) : undefined;
  const Panel = integrationId ? PANELS[integrationId] : undefined;

  const title = useMemo(() => def?.title ?? 'Интеграция', [def?.title]);

  if (!integrationId || !def || !Panel) {
    return <Navigate to="/settings/integrations" replace />;
  }

  if (!user) {
    return <Navigate to="/settings/integrations" replace />;
  }

  return (
    <>
      <PageMetadata title={`${title} — интеграции`} description={def.shortDescription} />
      <Suspense fallback={<PanelFallback />}>
        <Panel />
      </Suspense>
    </>
  );
};
