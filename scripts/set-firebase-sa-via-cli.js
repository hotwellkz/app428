#!/usr/bin/env node
/**
 * Берёт FIREBASE_SERVICE_ACCOUNT_JSON из Netlify env (scope builds),
 * разбивает на FIREBASE_SA_1 и FIREBASE_SA_2 и устанавливает их со scope "functions".
 * Запуск: node scripts/set-firebase-sa-via-cli.js
 * Требуется: netlify link, netlify login.
 */

import { spawnSync } from 'child_process';

const CHUNK_SIZE = 1800;

const listResult = spawnSync('netlify', ['env:list', '--json'], {
  encoding: 'utf8',
});
if (listResult.status !== 0) {
  console.error('Ошибка netlify env:list:', listResult.stderr || listResult.stdout);
  process.exit(1);
}

let env;
try {
  env = JSON.parse(listResult.stdout.trim());
} catch (e) {
  console.error('Не удалось распарсить env:', e.message);
  process.exit(1);
}

const fullJson = env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!fullJson || typeof fullJson !== 'string') {
  console.error('FIREBASE_SERVICE_ACCOUNT_JSON не найден в Netlify env.');
  process.exit(1);
}

const parts = [];
for (let i = 0; i < fullJson.length; i += CHUNK_SIZE) {
  parts.push(fullJson.slice(i, i + CHUNK_SIZE));
}
console.log('Разбито на', parts.length, 'частей. Устанавливаю FIREBASE_SA_1 и FIREBASE_SA_2 со scope functions...');

for (let i = 0; i < parts.length; i++) {
  const key = `FIREBASE_SA_${i + 1}`;
  const setResult = spawnSync('netlify', ['env:set', key, parts[i], '--scope', 'functions', '--force'], {
    encoding: 'utf8',
  });
  if (setResult.status !== 0) {
    console.error('Ошибка env:set', key, setResult.stderr || setResult.stdout);
    process.exit(1);
  }
  console.log('  OK', key);
}
console.log('Готово. Сделайте Redeploy в Netlify.');
