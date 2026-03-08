#!/usr/bin/env node
/**
 * Разбивает Firebase Service Account JSON на части для Netlify env (обход лимита 4KB).
 * Запуск: node scripts/split-firebase-env.js путь/к/файлу.json
 * Выведет значения для FIREBASE_SA_1, FIREBASE_SA_2 (по ~1800 символов).
 */

import fs from 'fs';
const path = process.argv[2] || 'accounting-c3c06-firebase-adminsdk-ggmx6-00fe93f23a.json';

if (!fs.existsSync(path)) {
  console.error('Файл не найден:', path);
  console.error('Использование: node scripts/split-firebase-env.js <path-to-json>');
  process.exit(1);
}

const json = fs.readFileSync(path, 'utf8').replace(/\n/g, '');
const CHUNK = 1800;
const parts = [];
for (let i = 0; i < json.length; i += CHUNK) {
  parts.push(json.slice(i, i + CHUNK));
}

console.log('Скопируйте в Netlify → Environment variables:\n');
parts.forEach((p, i) => {
  console.log(`FIREBASE_SA_${i + 1}:`);
  console.log(p);
  console.log('');
});
