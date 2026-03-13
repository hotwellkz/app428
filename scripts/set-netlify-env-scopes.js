#!/usr/bin/env node
/**
 * Устанавливает scope переменных Netlify через CLI:
 * - WAZZUP_API_KEY, FIREBASE_SA_1, FIREBASE_SA_2 → scope "functions"
 * - остальные → scope "builds"
 * Так в Lambda попадают только нужные переменные, лимит 4KB не превышается.
 *
 * Требуется: netlify link и netlify env:list с доступом к проекту.
 * Запуск: node scripts/set-netlify-env-scopes.js
 */

import { spawnSync } from 'child_process';

const FUNCTIONS_SCOPE_KEYS = new Set([
  'WAZZUP_API_KEY',
  'FIREBASE_SA_1',
  'FIREBASE_SA_2',
]);

function runNetlify(args, input) {
  const result = spawnSync('netlify', args, {
    encoding: 'utf8',
    input: input ?? undefined,
  });
  if (result.error) {
    throw result.error;
  }
  return result;
}

function main() {
  console.log('Получаю список переменных Netlify...');
  const listResult = runNetlify(['env:list', '--json']);
  if (listResult.status !== 0) {
    console.error('Ошибка netlify env:list:', listResult.stderr || listResult.stdout);
    process.exit(1);
  }

  let env;
  try {
    env = JSON.parse(listResult.stdout.trim());
  } catch (e) {
    console.error('Не удалось распарсить JSON переменных:', e.message);
    process.exit(1);
  }

  const keys = Object.keys(env);
  console.log(`Найдено переменных: ${keys.length}`);
  console.log('Scope functions будет у:', [...FUNCTIONS_SCOPE_KEYS].filter((k) => keys.includes(k)).join(', ') || '(нет в проекте)');
  console.log('Остальные получат scope builds.\n');

  for (const key of keys) {
    const value = env[key];
    const scope = FUNCTIONS_SCOPE_KEYS.has(key) ? 'functions' : 'builds';
    console.log(`Устанавливаю ${key} → scope ${scope}...`);
    const setResult = spawnSync('netlify', ['env:set', key, value, '--scope', scope, '--force'], {
      encoding: 'utf8',
    });
    if (setResult.status !== 0) {
      console.error(`  Ошибка для ${key}:`, setResult.stderr || setResult.stdout);
    } else {
      console.log(`  OK`);
    }
  }

  console.log('\nГотово. Сделайте Redeploy сайта в Netlify.');
}

main();
