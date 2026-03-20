import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { loadVoiceProviderRuntimeConfig } from './lib/voice/providerConfig';
import { validateTwilioInboundRequest } from './lib/voice/twilioInboundValidate';
import { runVoiceGatherAction } from './lib/voice/voiceTurnManager';

const XML_HEADERS: Record<string, string> = {
  'Content-Type': 'text/xml; charset=utf-8',
  'Cache-Control': 'no-store'
};

function errorTwiml(): string {
  const t = 'Произошла ошибка. До свидания.';
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="ru-RU" voice="Polly.Tatyana">${esc(
    t
  )}</Say><Hangup/></Response>`;
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', ...XML_HEADERS }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: XML_HEADERS, body: errorTwiml() };
  }

  const config = loadVoiceProviderRuntimeConfig();

  try {
    const params = validateTwilioInboundRequest(event, config, 'gather');
    const callSid = String(params.CallSid ?? '').trim();
    const speechResult = String(params.SpeechResult ?? params.UnstableSpeechResult ?? '').trim();
    const confidenceStr = params.Confidence;

    if (!callSid) {
      return { statusCode: 200, headers: XML_HEADERS, body: errorTwiml() };
    }

    const xml = await runVoiceGatherAction({
      callSid,
      speechResult,
      confidenceStr,
      config
    });
    return { statusCode: 200, headers: XML_HEADERS, body: xml };
  } catch (e) {
    const msg = String(e);
    console.error('[voice-twilio-gather-action]', msg);
    if (msg.includes('подпись') || msg.includes('X-Twilio-Signature')) {
      return { statusCode: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: 'Forbidden' };
    }
    return { statusCode: 200, headers: XML_HEADERS, body: errorTwiml() };
  }
};
