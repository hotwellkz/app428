#!/usr/bin/env node
/**
 * Резервное копирование Firestore: выгружает указанные коллекции в локальные JSON-файлы.
 *
 * Запуск: node scripts/backupFirestore.js
 *
 * Результат: папка backups/firestore-YYYY-MM-DD-HHmm с файлами:
 *   clients.json, transactions.json, messages.json, ...
 *
 * Требуется: FIREBASE_SERVICE_ACCOUNT_JSON или FIREBASE_SA_1 + FIREBASE_SA_2 в env.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COLLECTIONS = [
  'clients',
  'transactions',
  'messages',
  'categories',
  'users',
  'deals',
  'whatsappClients',
  'whatsappConversations',
  'whatsappMessages'
];

function getFirebaseCredential() {
  const fromFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (fromFile) {
    const abs = path.isAbsolute(fromFile) ? fromFile : path.join(process.cwd(), fromFile);
    if (fs.existsSync(abs)) {
      return { type: 'cert', json: fs.readFileSync(abs, 'utf8') };
    }
  }
  const single = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (single) return { type: 'cert', json: single };
  const parts = [];
  for (let i = 1; i <= 5; i++) {
    const p = process.env[`FIREBASE_SA_${i}`];
    if (p) parts.push(p);
  }
  if (parts.length > 0) return { type: 'cert', json: parts.join('') };
  return null;
}

function serializeValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'object' && value.constructor?.name === 'Timestamp') {
    return { _timestamp: true, seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = serializeValue(v);
    }
    return out;
  }
  return value;
}

async function main() {
  const firebaseAdmin = (await import('firebase-admin')).default;
  if (!firebaseAdmin.apps?.length) {
    let credential;
    const cred = getFirebaseCredential();
    if (cred && cred.type === 'cert') {
      credential = firebaseAdmin.credential.cert(JSON.parse(cred.json));
    } else {
      try {
        credential = firebaseAdmin.credential.applicationDefault();
      } catch (e) {
        console.error(
          'Задайте учётные данные: GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json или FIREBASE_SERVICE_ACCOUNT_JSON (или FIREBASE_SA_1,2). Пример: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node scripts/backupFirestore.js'
        );
        throw e;
      }
    }
    firebaseAdmin.initializeApp({ credential });
  }
  const db = firebaseAdmin.firestore();

  const now = new Date();
  const dirName = `firestore-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const backupDir = path.join(process.cwd(), 'backups', dirName);
  if (!fs.existsSync(path.join(process.cwd(), 'backups'))) {
    fs.mkdirSync(path.join(process.cwd(), 'backups'), { recursive: true });
  }
  fs.mkdirSync(backupDir, { recursive: true });
  console.log('Backup directory:', backupDir);

  for (const collName of COLLECTIONS) {
    try {
      const snapshot = await db.collection(collName).get();
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        ...serializeValue(d.data())
      }));
      const filePath = path.join(backupDir, `${collName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');
      console.log(`[${collName}] ${docs.length} documents -> ${filePath}`);
    } catch (err) {
      console.error(`[${collName}] Error:`, err.message);
    }
  }

  const metaPath = path.join(backupDir, '_backup_meta.json');
  fs.writeFileSync(
    metaPath,
    JSON.stringify({
      createdAt: now.toISOString(),
      collections: COLLECTIONS
    }),
    'utf8'
  );
  console.log('Backup finished. Meta:', metaPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
