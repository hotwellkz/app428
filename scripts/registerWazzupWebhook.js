#!/usr/bin/env node
/**
 * Регистрация webhook в Wazzup API.
 * Сайт: https://2wix.ru (Netlify: papaya-seahorse-f4694d)
 * Отправляет PATCH на https://api.wazzup24.com/v3/webhooks
 *
 * Запуск (достаточно только ключа, webhook по умолчанию — 2wix.ru):
 *   WAZZUP_API_KEY=372ddc71cef04d3fa823b8404aa9d36c node scripts/registerWazzupWebhook.js
 *
 * С другим URL webhook:
 *   WAZZUP_API_KEY=<ключ> WAZZUP_WEBHOOK_URI=https://другой-сайт.com/api/wazzup/webhook node scripts/registerWazzupWebhook.js
 */

const WEBHOOKS_URL = 'https://api.wazzup24.com/v3/webhooks';

const apiKey = process.env.WAZZUP_API_KEY;
const webhookUri = process.env.WAZZUP_WEBHOOK_URI || 'https://2wix.ru/api/wazzup/webhook';

if (!apiKey) {
  console.error('Ошибка: задайте переменную окружения WAZZUP_API_KEY');
  console.error('Пример: WAZZUP_API_KEY=your_key node scripts/registerWazzupWebhook.js');
  process.exit(1);
}

const body = {
  webhooksUri: webhookUri,
  subscriptions: {
    messagesAndStatuses: true,
    contactsAndDealsCreation: false,
    channelsUpdates: false,
    templateStatus: false
  }
};

async function register() {
  try {
    const res = await fetch(WEBHOOKS_URL, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      console.error('Ошибка регистрации webhook:', res.status, res.statusText);
      console.error(data);
      process.exit(1);
    }

    console.log('Webhook успешно зарегистрирован.');
    console.log('URL:', webhookUri);
    console.log('Ответ:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Ошибка запроса:', err.message);
    process.exit(1);
  }
}

register();
