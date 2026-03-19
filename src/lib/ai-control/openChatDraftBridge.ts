const KEY_PREFIX = 'ai_control_draft_bridge:';

export function stashChatDraft(conversationId: string, text: string): void {
  if (!conversationId || !text.trim()) return;
  const payload = {
    conversationId,
    text,
    createdAt: Date.now()
  };
  try {
    sessionStorage.setItem(`${KEY_PREFIX}${conversationId}`, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export function consumeChatDraft(conversationId: string): string | null {
  if (!conversationId) return null;
  const key = `${KEY_PREFIX}${conversationId}`;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    sessionStorage.removeItem(key);
    const parsed = JSON.parse(raw) as { text?: unknown };
    return typeof parsed.text === 'string' && parsed.text.trim() ? parsed.text : null;
  } catch {
    return null;
  }
}
