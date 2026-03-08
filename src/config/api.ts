// API через Netlify Functions (same-origin: https://2wix.ru/.netlify/functions/*)
const NETLIFY_FUNCTIONS = '/.netlify/functions';

export const API_CONFIG = {
  BASE_URL: NETLIFY_FUNCTIONS,
  /** API всегда доступен через относительный путь Netlify Functions. */
  isChatApiAvailable(): boolean {
    return true;
  },
  ENDPOINTS: {
    health: '/health',
    whatsapp: {
      status: '/whatsapp-status',
      logout: '/whatsapp-logout',
    },
    chats: '/chats',
    chat: '/chat',
    contacts: '/contacts',
    readStatus: '/read-status',
    sendWhatsAppMessage: '/send-whatsapp-message',
  },
} as const;

// Socket.IO не используется при архитектуре только Netlify Functions
export const SOCKET_CONFIG = {
  url: '',
  options: {
    transports: ['websocket', 'polling'],
    cors: { origin: typeof window !== 'undefined' ? window.location.origin : '', methods: ['GET', 'POST'] },
    timeout: 10000,
    reconnectionDelay: 2000,
    reconnectionAttempts: 5,
  },
} as const;

if (import.meta.env.DEV) {
  console.log('🔗 API (Netlify Functions):', API_CONFIG.BASE_URL);
}
