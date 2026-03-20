export type VoiceProviderReadiness = 'ready' | 'limited' | 'experimental' | 'unknown';

export type VoiceProviderCatalogItem = {
  providerId: string;
  supportedCountries: string[];
  localCallerIdSupported: boolean;
  readiness: VoiceProviderReadiness;
};

const CATALOG: Record<string, VoiceProviderCatalogItem> = {
  twilio: {
    providerId: 'twilio',
    supportedCountries: ['KZ', 'RU', 'US', 'DE', 'AE'],
    localCallerIdSupported: false,
    readiness: 'limited'
  },
  mock: {
    providerId: 'mock',
    supportedCountries: [],
    localCallerIdSupported: false,
    readiness: 'experimental'
  }
};

export function getVoiceProviderCatalogItem(providerId: string | null | undefined): VoiceProviderCatalogItem {
  const id = String(providerId ?? '').trim().toLowerCase();
  return (
    CATALOG[id] ?? {
      providerId: id || 'unknown',
      supportedCountries: [],
      localCallerIdSupported: false,
      readiness: 'unknown'
    }
  );
}
