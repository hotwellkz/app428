import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';

// Vite подставляет import.meta.env.* на этапе сборки. В Netlify переменные должны быть в Environment Variables до запуска build.

/** Локальная конфигурация Firebase для разработки (используется, если нет VITE_FIREBASE_*) */
const LOCAL_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAICwewb9nIfENQH-gOJgkpQXZKBity9ck',
  authDomain: 'accounting-c3c06.firebaseapp.com',
  projectId: 'accounting-c3c06',
  storageBucket: 'accounting-c3c06.firebasestorage.app',
  messagingSenderId: '670119019137',
  appId: '1:670119019137:web:f5c57a1a6f5ef05c720380'
};

const decodeApiKey = (value?: string): string | undefined => {
  if (!value) return undefined;
  try {
    if (typeof globalThis.atob === 'function') {
      return globalThis.atob(value);
    }
    const globalWithBuffer = globalThis as typeof globalThis & {
      Buffer?: { from: (input: string, encoding: string) => { toString: (enc: string) => string } };
    };
    if (globalWithBuffer.Buffer) {
      return globalWithBuffer.Buffer.from(value, 'base64').toString('utf-8');
    }
  } catch {
    return value;
  }
  return value;
};

function getFirebaseConfig() {
  const apiKey =
    decodeApiKey(import.meta.env.VITE_FIREBASE_API_KEY_BASE64) ??
    import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;

  const fromEnv = {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId
  };

  // Для локальной разработки: если переменные окружения не заданы — используем локальный конфиг
  if (isConfigValid(fromEnv)) {
    return fromEnv;
  }
  return LOCAL_FIREBASE_CONFIG;
}

function isConfigValid(config: ReturnType<typeof getFirebaseConfig>): boolean {
  return Boolean(
    config.apiKey &&
      config.authDomain &&
      config.projectId &&
      config.storageBucket &&
      config.messagingSenderId &&
      config.appId
  );
}

function getMissingEnvVars(config: ReturnType<typeof getFirebaseConfig>): string[] {
  const names = [
    'VITE_FIREBASE_API_KEY or VITE_FIREBASE_API_KEY_BASE64',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  ];
  const values = [
    config.apiKey,
    config.authDomain,
    config.projectId,
    config.storageBucket,
    config.messagingSenderId,
    config.appId
  ];
  return names.filter((_, i) => !values[i]);
}

const firebaseConfig = getFirebaseConfig();

if (!isConfigValid(firebaseConfig)) {
  const firebaseEnvKeys = Object.keys(import.meta.env).filter((k) => k.startsWith('VITE_FIREBASE'));
  console.warn('Firebase: using fallback config. ENV keys present:', firebaseEnvKeys);
  const missing = getMissingEnvVars(firebaseConfig);
  console.warn(
    'Firebase env variables missing:',
    missing.join(', '),
    '— Set them in Netlify (Site settings → Environment variables) and redeploy.'
  );
}

// Fallback на пустые строки, чтобы initializeApp не падал при частичном конфиге (для отладки)
const configForInit = {
  apiKey: firebaseConfig.apiKey ?? '',
  authDomain: firebaseConfig.authDomain ?? '',
  projectId: firebaseConfig.projectId ?? '',
  storageBucket: firebaseConfig.storageBucket ?? '',
  messagingSenderId: firebaseConfig.messagingSenderId ?? '',
  appId: firebaseConfig.appId ?? ''
};

// Инициализация один раз (защита от двойной инициализации при HMR и динамических импортах)
const app: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(configForInit);

export { app };

export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error('Error setting auth persistence:', err);
});

export const db = getFirestore(app);
export const storage = getStorage(app);

export { getStorage, ref, uploadBytesResumable, getDownloadURL };
