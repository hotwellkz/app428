#!/usr/bin/env node
/**
 * Миграция: добавить companyId: "hotwell" во все документы коллекций
 * clients, transactions, messages, categories — где поле отсутствует.
 *
 * ВАЖНО: Перед запуском сделайте backup Firestore:
 *   - Firebase Console → Firestore → Export data, или
 *   - gcloud firestore export gs://BUCKET/export
 * Ничего не удаляет и не перемещает — только добавляет поле companyId.
 *
 * Запуск: node scripts/migrateCompanyId.js
 *
 * Требуется: FIREBASE_SERVICE_ACCOUNT_JSON или FIREBASE_SA_1 + FIREBASE_SA_2 в env.
 */

import fs from 'fs';
import path from 'path';

const DEFAULT_COMPANY_ID = 'hotwell';
const COLLECTIONS = ['clients', 'transactions', 'messages', 'categories'];

function getFirebaseServiceAccountJson() {
  const fromFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (fromFile) {
    const abs = path.isAbsolute(fromFile) ? fromFile : path.join(process.cwd(), fromFile);
    if (fs.existsSync(abs)) {
      return fs.readFileSync(abs, 'utf8');
    }
  }
  const single = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (single) return single;
  const parts = [];
  for (let i = 1; i <= 5; i++) {
    const p = process.env[`FIREBASE_SA_${i}`];
    if (p) parts.push(p);
  }
  if (parts.length === 0) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json or FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SA_1,2 is not set');
  }
  return parts.join('');
}

async function main() {
  const firebaseAdmin = (await import('firebase-admin')).default;
  if (!firebaseAdmin.apps?.length) {
    const json = getFirebaseServiceAccountJson();
    const credential = firebaseAdmin.credential.cert(JSON.parse(json));
    firebaseAdmin.initializeApp({ credential });
  }
  const db = firebaseAdmin.firestore();

  for (const collName of COLLECTIONS) {
    const coll = db.collection(collName);
    const snapshot = await coll.get();
    let updated = 0;
    let batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      if (data.companyId !== undefined && data.companyId !== null) continue;
      batch.update(docSnap.ref, { companyId: DEFAULT_COMPANY_ID });
      updated++;
      batchCount++;
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        console.log(`  [${collName}] committed batch, ${updated} updated so far`);
        batch = db.batch();
        batchCount = 0;
      }
    }
    if (batchCount > 0) {
      await batch.commit();
    }
    console.log(`[${collName}] done: ${updated} documents updated (total ${snapshot.size})`);
  }

  console.log('Migration finished.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
