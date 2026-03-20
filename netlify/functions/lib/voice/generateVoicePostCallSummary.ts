/**
 * Краткая операционная сводка по голосовому диалогу (post-call).
 */
export async function generateVoicePostCallSummary(params: {
  apiKey: string;
  fullTranscript: string;
  toE164: string;
}): Promise<{ summary: string } | { error: string }> {
  const body = params.fullTranscript.trim() || '(пустой транскрипт)';
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Ты аналитик CRM. По транскрипту телефонного разговора (Бот/Клиент) сделай краткую сводку для менеджера на русском.
Укажи: о чём разговор, интерес/отказ/нейтрал, следующий шаг если виден, нюансы. Не больше 8 предложений. Без воды. Номер абонента для справки: ${params.toE164}.`
          },
          { role: 'user', content: body.slice(0, 14000) }
        ],
        temperature: 0.35,
        max_tokens: 500
      })
    });
    if (!response.ok) {
      const t = await response.text();
      return { error: `OpenAI summary: ${response.status} ${t.slice(0, 200)}` };
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const summary = String(data.choices?.[0]?.message?.content ?? '').trim();
    if (!summary) return { error: 'Пустая сводка' };
    return { summary: summary.slice(0, 4000) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'summary_failed' };
  }
}
