# Android Chat Module Spec

## Summary

Цель: перейти от WebView-first к архитектуре `native cached chats first, sync second, web fallback` для `android-2wix-whatsapp`.

Принципы:
- список чатов и треды в native data-модели,
- Room как локальный source для UI,
- backend API как единственный remote contract,
- push применяются в cache idempotent-путём,
- WebView остаётся fallback-слоем для неперенесённых действий.

## Screens

### ChatListScreen
- мгновенный старт из локального кеша,
- сортировка по `lastMessageAt`, unread badges,
- search + filters,
- manual refresh и stale indicator,
- переход в ChatThreadScreen.

### ChatThreadScreen
- история сообщений и отправка текста,
- optimistic send + retry,
- mark read on open,
- paging истории (`before` cursor).

### Filters/Search UI
- query,
- unread-only,
- status/tags chips (часть в V1, часть в V1.1).

### Chats Diagnostics (в Settings)
- last sync,
- source (`local/network/mixed`),
- cached count,
- last push applied,
- clear cache / background refresh.

### Web fallback
- временная точка входа для сложных действий (до native parity).

## States & UX

- cold start,
- offline with cache,
- offline without cache,
- loading,
- empty,
- unread,
- push in background/foreground,
- open from push,
- sending pending,
- send failed/retry,
- mark read,
- sync in progress,
- stale data.

## Components

- ChatsTopBar,
- ChatSearchBar,
- FilterChipsRow,
- ChatListItem,
- UnreadBadge,
- StatusBadge,
- AvatarView,
- OfflineBanner,
- SyncStatusLine,
- MessageBubbleIncoming/Outgoing,
- ComposerInput,
- SendButton,
- Loading placeholders.

## Data Models

- Chat,
- ChatMessage,
- ChatParticipantMeta,
- ChatFilterState,
- SyncState,
- PendingOutgoingMessage,
- PushPayloadMapping.

См. подробные поля в `docs/android-chat-api-contract.md`.

## Scope

### V1 must
- native chat list,
- native chat thread text flow,
- incremental sync,
- mark read,
- optimistic send + retry,
- push->cache update,
- diagnostics.

### V1.1 later
- attachments/upload,
- advanced filters,
- richer media states.

### Later
- voice/media full parity,
- advanced web parity features,
- full web fallback removal.

## Roadmap

1. Этап 2: backend contract finalization (этот этап).
2. Этап 3: native ChatList hardening.
3. Этап 4: native ChatThread V1.
4. Этап 5: push/sync/offline polish.
5. Этап 6: visual parity with web UI.

## Native Chats V1 Final Notes

Что считается завершенным в V1:
- native `ChatList` и `ChatThread` для текстового потока,
- локальный Room cache + incremental sync + push apply,
- send/pending/failed/retry + mark-read,
- offline/stale UX и diagnostics в settings,
- visual parity pass с web-стилем на уровне list/thread/composer/badges.

Что сознательно НЕ входит в V1:
- media/voice/reactions full parity,
- расширенные CRM-фичи вне вкладки чатов,
- перепроектирование backend/auth архитектуры.

Ключевые сценарии для smoke QA:
- cold start, offline with cache, offline without cache,
- open from list, open from push,
- send -> pending -> sent, failed -> retry,
- mark-read on open + consistency list/thread after sync,
- foreground/background push handling,
- empty/offline/stale states и settings diagnostics.

Актуальные артефакты сборки:
- debug APK: `android-2wix-whatsapp/app/build/outputs/apk/debug/app-debug.apk`
- release APK: `android-2wix-whatsapp/app/build/outputs/apk/release/app-release.apk` (если сборка release успешна и signing настроен).
