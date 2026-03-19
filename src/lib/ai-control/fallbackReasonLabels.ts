const FALLBACK_REASON_LABELS: Record<string, string> = {
  pipeline_fallback_first_active: 'Подходящая воронка не определилась, выбрана первая активная',
  stage_fallback_to_default_pipeline: 'Этап не определился, применён этап по умолчанию',
  stage_fallback_first_in_pipeline: 'Этап не определился, выбран первый этап воронки',
  assignee_fallback_null: 'Ответственный не назначен автоматически',
  assignee_fallback_missing_or_inactive: 'Рекомендованный ответственный недоступен'
};

export function humanizeFallbackReason(code: string): string {
  const clean = String(code || '').trim();
  return FALLBACK_REASON_LABELS[clean] ?? clean;
}

export function humanizeFallbackReasons(codes: string[] | null | undefined): string[] {
  if (!Array.isArray(codes)) return [];
  return codes.map(humanizeFallbackReason);
}
