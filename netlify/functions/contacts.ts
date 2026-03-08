import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

function json(statusCode: number, data: object): HandlerResponse {
  return {
    statusCode,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  switch (event.httpMethod) {
    case 'GET':
      return json(200, { success: true, contacts: {} });
    case 'POST': {
      const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : {};
      const contactId = body.contactId || '';
      const customName = body.customName || '';
      return json(200, { success: true, contact: { contactId, customName } });
    }
    case 'PUT': {
      const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : {};
      const customName = body.customName || '';
      const contactId = event.path.split('/').pop() || '';
      return json(200, { success: true, contact: { contactId, customName } });
    }
    case 'DELETE':
      return json(200, { success: true });
    default:
      return json(405, { error: 'Method Not Allowed' });
  }
};
