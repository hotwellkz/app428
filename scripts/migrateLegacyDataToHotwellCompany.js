#!/usr/bin/env node
/**
 * Миграция legacy-данных: дописывает companyId='hotwell' всем документам,
 * у которых поле companyId отсутствует. Документы с уже заполненным companyId не трогает.
 *
 * Запуск:
 *   node scripts/migrateLegacyDataToHotwellCompany.js           # реальное обновление
 *   node scripts/migrateLegacyDataToHotwellCompany.js --dry-run # только отчёт, без записи
 *
 * Учётные данные (один из вариантов):
 *   - GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json
 *   - FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
 *   - FIREBASE_SA_1 + FIREBASE_SA_2 + ... (части JSON для обхода лимита env)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LEGACY_COMPANY_ID = 'hotwell';

const COLLECTIONS_TO_MIGRATE = [
  'employees',
  'products',
  'productFolders',
  'productMovements',
  'warehouseDocuments',
  'contractTemplates',
  'clients',
  'transactions',
  'messages',
  'categories',
  'deals'
];

const READ_BATCH_SIZE = 500;
const WRITE_BATCH_SIZE = 500;

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
  const cwd = process.cwd();
  const toTry = [
    'serviceAccountKey.json',
    'firebase-service-account.json',
    'service-account.json'
  ];
  const dirFiles = fs.readdirSync(cwd, { withFileTypes: true });
  for (const d of dirFiles) {
    if (d.isFile() && d.name.endsWith('.json') && d.name !== 'package.json' && d.name !== 'package-lock.json' && d.name !== 'firebase.json' && d.name !== 'firestore.indexes.json' && d.name !== 'tsconfig.json' && !d.name.startsWith('tsconfig.')) {
      toTry.push(d.name);
    }
  }
  for (const name of toTry) {
    const full = path.join(cwd, name);
    if (fs.existsSync(full)) {
      try {
        const json = fs.readFileSync(full, 'utf8');
        const parsed = JSON.parse(json);
        if (parsed.project_id && parsed.private_key && parsed.client_email) {
          return { type: 'cert', json };
        }
      } catch (_) {}
    }
  }
  return null;
}

async function migrateCollection(db, collectionName, dryRun) {
  const report = { collection: collectionName, scanned: 0, updated: 0, skipped: 0 };
  const coll = db.collection(collectionName);
  let lastDoc = null;
  let pendingWrites = [];

  const flushWrites = async () => {
    if (pendingWrites.length === 0) return;
    if (dryRun) {
      report.updated += pendingWrites.length;
      pendingWrites = [];
      return;
    }
    const batch = db.batch();
    for (const ref of pendingWrites) {
      batch.update(ref, { companyId: LEGACY_COMPANY_ID });
    }
    await batch.commit();
    report.updated += pendingWrites.length;
    pendingWrites = [];
  };

  while (true) {
    let q = coll.limit(READ_BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      report.scanned += 1;
      const data = doc.data();
      const hasCompanyId = data != null && (data.companyId !== undefined && data.companyId !== null);
      if (hasCompanyId) {
        report.skipped += 1;
        continue;
      }
      pendingWrites.push(doc.ref);
      if (pendingWrites.length >= WRITE_BATCH_SIZE) {
        await flushWrites();
      }
    }

    await flushWrites();
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < READ_BATCH_SIZE) break;
  }

  await flushWrites();
  return report;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('=== DRY RUN: изменения в Firestore не вносятся ===\n');
  }

  const firebaseAdmin = (await import('firebase-admin')).default;
  if (!firebaseAdmin.apps?.length) {
    const cred = getFirebaseCredential();
    if (!cred || cred.type !== 'cert') {
      try {
        firebaseAdmin.initializeApp({ credential: firebaseAdmin.credential.applicationDefault() });
      } catch (e) {
        console.error(
          'Задайте учётные данные: GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json, FIREBASE_SERVICE_ACCOUNT_JSON или положите serviceAccountKey.json в корень проекта.'
        );
        throw e;
      }
    } else {
      const parsed = JSON.parse(cred.json);
      const credential = firebaseAdmin.credential.cert(parsed);
      firebaseAdmin.initializeApp({ credential, projectId: parsed.project_id });
    }
  }

  const db = firebaseAdmin.firestore();
  const reports = [];

  for (const collName of COLLECTIONS_TO_MIGRATE) {
    try {
      const report = await migrateCollection(db, collName, dryRun);
      reports.push(report);
    } catch (err) {
      console.error(`[${collName}] Ошибка:`, err.message);
      reports.push({
        collection: collName,
        scanned: 0,
        updated: 0,
        skipped: 0,
        error: err.message
      });
    }
  }

  console.log('\n--- Отчёт миграции ---\n');
  console.log('Коллекция              | Просмотрено | Обновлено | Пропущено (уже есть companyId)');
  console.log('-----------------------|-------------|-----------|----------------------------------');
  let totalScanned = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  for (const r of reports) {
    const errStr = r.error ? ` ERROR: ${r.error}` : '';
    console.log(
      `${r.collection.padEnd(22)} | ${String(r.scanned).padStart(11)} | ${String(r.updated).padStart(9)} | ${String(r.skipped).padStart(10)}${errStr}`
    );
    totalScanned += r.scanned;
    totalUpdated += r.updated;
    totalSkipped += r.skipped;
  }
  console.log('-----------------------|-------------|-----------|----------------------------------');
  console.log(`${'ИТОГО'.padEnd(22)} | ${String(totalScanned).padStart(11)} | ${String(totalUpdated).padStart(9)} | ${String(totalSkipped).padStart(10)}`);
  if (dryRun && totalUpdated > 0) {
    console.log('\nЗапустите без --dry-run, чтобы применить изменения.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
