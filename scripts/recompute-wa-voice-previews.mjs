#!/usr/bin/env node
/**
 * Опциональный backfill Firestore: для диалогов с lastMessagePreview "[медиа]" и
 * lastMessageMediaKind "audio" выставить voice + текст «Голосовое сообщение…».
 *
 * Запуск:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *   node scripts/recompute-wa-voice-previews.mjs
 *
 * При >500 совпадений запустите скрипт ещё раз (обновлённые документы отфильтруются).
 */

import admin from 'firebase-admin';
import { readFileSync } from 'node:fs';

const COLLECTION = 'whatsappConversations';

function formatMmSs(totalSec) {
  const s = Math.floor(Number(totalSec));
  if (!Number.isFinite(s) || s < 0) return '';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

async function main() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) {
    console.error('Укажите GOOGLE_APPLICATION_CREDENTIALS');
    process.exit(1);
  }
  const sa = JSON.parse(readFileSync(credPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  const db = admin.firestore();
  const snap = await db.collection(COLLECTION).where('lastMessagePreview', '==', '[медиа]').limit(500).get();

  let updated = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.lastMessageMediaKind !== 'audio') continue;
    const durRaw = d.lastMessageAttachmentDurationSec;
    const durLabel = typeof durRaw === 'number' && Number.isFinite(durRaw) ? formatMmSs(durRaw) : '';
    const nextPreview = durLabel ? `Голосовое сообщение · ${durLabel}` : 'Голосовое сообщение';
    await doc.ref.update({
      lastMessageMediaKind: 'voice',
      lastMessagePreview: nextPreview
    });
    updated += 1;
  }

  console.log(JSON.stringify({ ok: true, matchedPreview: snap.size, updated }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
