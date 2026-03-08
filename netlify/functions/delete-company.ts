import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { verifyIdToken, getUserRole, deleteCompanyData } from './lib/firebaseAdmin';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : '';
  if (!token) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({ message: 'Authorization required' })
    };
  }

  let uid: string;
  try {
    uid = await verifyIdToken(token);
  } catch {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({ message: 'Invalid token' })
    };
  }

  const role = await getUserRole(uid);
  if (role !== 'global_admin') {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({ message: 'Forbidden: global_admin only' })
    };
  }

  let body: { companyId?: string };
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {};
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({ message: 'Invalid JSON body' })
    };
  }

  const companyId = body.companyId;
  if (!companyId || typeof companyId !== 'string') {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({ message: 'companyId required' })
    };
  }

  try {
    await deleteCompanyData(companyId);
    // Опционально: удалить файлы Supabase Storage (нужны SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseKey) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);
        const prefix = `companies/${companyId}`;
        const buckets = ['clients', 'transactions', 'attachments'];
        for (const bucket of buckets) {
          const paths: string[] = [];
          const listAll = async (path: string) => {
            const { data } = await supabase.storage.from(bucket).list(path, { limit: 1000 });
            if (!data?.length) return;
            for (const item of data) {
              const fullPath = path ? `${path}/${item.name}` : item.name;
              if (item.id != null) paths.push(fullPath);
              if (item.name && !item.name.includes('.')) await listAll(fullPath);
            }
          };
          await listAll(prefix);
          if (paths.length > 0) await supabase.storage.from(bucket).remove(paths);
        }
      } catch (e) {
        console.error('Supabase storage cleanup failed:', e);
      }
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({ message })
    };
  }
};
