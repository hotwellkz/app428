#!/usr/bin/env node
/**
 * Миграция WhatsApp-данных: дописывает companyId='hotwell' там, где он отсутствует,
 * и пытается взять companyId из связанного диалога для сообщений.
 *
 * Запуск:
 *   node scripts/migrateWhatsappCompanyId.js           # реальное обновление
 *   node scripts/migrateWhatsappCompanyId.js --dry-run # только отчёт, без записи
 */

const LEGACY_COMPANY_ID = 'hotwell';
const READ_BATCH_SIZE = 500;
const WRITE_BATCH_SIZE = 500;

async function initAdmin() {
  const firebaseAdmin = (await import('firebase-admin')).default;
  if (!firebaseAdmin.apps?.length) {
    try {
      firebaseAdmin.initializeApp({ credential: firebaseAdmin.credential.applicationDefault() });
    } catch (e) {
      console.error(
        'Не удалось инициализировать firebase-admin. Задайте GOOGLE_APPLICATION_CREDENTIALS или FIREBASE_SERVICE_ACCOUNT_JSON.'
      );
      throw e;
    }
  }
  return firebaseAdmin.firestore();
}

async function migrateConversations(db, dryRun) {
  const coll = db.collection('whatsappConversations');
  const report = { collection: 'whatsappConversations', scanned: 0, updated: 0, skipped: 0 };
  let lastDoc = null;
  let pendingWrites = [];

  const flush = async () => {
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

    for (const d of snap.docs) {
      report.scanned += 1;
      const data = d.data() || {};
      if (data.companyId != null) {
        report.skipped += 1;
        continue;
      }
      pendingWrites.push(d.ref);
      if (pendingWrites.length >= WRITE_BATCH_SIZE) {
        await flush();
      }
    }

    await flush();
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < READ_BATCH_SIZE) break;
  }

  await flush();
  return report;
}

async function migrateClients(db, dryRun) {
  const coll = db.collection('whatsappClients');
  const report = { collection: 'whatsappClients', scanned: 0, updated: 0, skipped: 0 };
  let lastDoc = null;
  let pendingWrites = [];

  const flush = async () => {
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

    for (const d of snap.docs) {
      report.scanned += 1;
      const data = d.data() || {};
      if (data.companyId != null) {
        report.skipped += 1;
        continue;
      }
      pendingWrites.push(d.ref);
      if (pendingWrites.length >= WRITE_BATCH_SIZE) {
        await flush();
      }
    }

    await flush();
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < READ_BATCH_SIZE) break;
  }

  await flush();
  return report;
}

async function migrateMessages(db, dryRun) {
  const convSnap = await db.collection('whatsappConversations').get();
  const convCompany = new Map();
  convSnap.forEach((d) => {
    const data = d.data() || {};
    if (data.companyId) {
      convCompany.set(d.id, data.companyId);
    }
  });

  const coll = db.collection('whatsappMessages');
  const report = {
    collection: 'whatsappMessages',
    scanned: 0,
    updated: 0,
    skipped: 0,
    missingConversation: 0
  };
  let lastDoc = null;
  let pendingWrites = [];

  const flush = async () => {
    if (pendingWrites.length === 0) return;
    if (dryRun) {
      report.updated += pendingWrites.length;
      pendingWrites = [];
      return;
    }
    const batch = db.batch();
    for (const { ref, companyId } of pendingWrites) {
      batch.update(ref, { companyId });
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

    for (const d of snap.docs) {
      report.scanned += 1;
      const data = d.data() || {};
      if (data.companyId != null) {
        report.skipped += 1;
        continue;
      }
      const convId = data.conversationId;
      let targetCompany = convCompany.get(convId);
      if (!targetCompany) {
        targetCompany = LEGACY_COMPANY_ID;
        report.missingConversation += 1;
        // Логируем проблемные записи
        console.warn('[migrateWhatsappCompanyId] message without conversation companyId', {
          messageId: d.id,
          conversationId: convId
        });
      }
      pendingWrites.push({ ref: d.ref, companyId: targetCompany });
      if (pendingWrites.length >= WRITE_BATCH_SIZE) {
        await flush();
      }
    }

    await flush();
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < READ_BATCH_SIZE) break;
  }

  await flush();
  return report;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('=== DRY RUN: изменения в Firestore не вносятся ===\n');
  }

  const db = await initAdmin();
  const reports = [];

  reports.push(await migrateClients(db, dryRun));
  reports.push(await migrateConversations(db, dryRun));
  reports.push(await migrateMessages(db, dryRun));

  console.log('\n--- Отчёт миграции WhatsApp ---\n');
  console.log('Коллекция                | Просмотрено | Обновлено | Пропущено | Без conversationId');
  console.log('--------------------------|------------|-----------|-----------|-------------------');
  let totalScanned = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalMissingConv = 0;

  for (const r of reports) {
    const missing = r.missingConversation ?? 0;
    console.log(
      `${r.collection.padEnd(26)} | ${String(r.scanned).padStart(10)} | ${String(r.updated).padStart(9)} | ${String(r.skipped).padStart(9)} | ${String(missing).padStart(17)}`
    );
    totalScanned += r.scanned;
    totalUpdated += r.updated;
    totalSkipped += r.skipped;
    totalMissingConv += missing;
  }

  console.log('--------------------------|------------|-----------|-----------|-------------------');
  console.log(
    `${'ИТОГО'.padEnd(26)} | ${String(totalScanned).padStart(10)} | ${String(totalUpdated).padStart(9)} | ${String(totalSkipped).padStart(9)} | ${String(totalMissingConv).padStart(17)}`
  );
  if (dryRun && totalUpdated > 0) {
    console.log('\nЗапустите без --dry-run, чтобы применить изменения.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

