# Android Native Chats API Contract (V1)

Contract version: `2026-03-android-chat-v1`

## 1. Auth and identity rules

- Обязательный идентификатор во всех chat-endpoints: `managerId`.
- Источник `managerId` на Android: пользовательская настройка (и далее может быть привязана к auth-сессии).
- Backend обязан фильтровать данные по `managerId` (через ownership в `whatsappClients.managerId`).
- Если чат не принадлежит `managerId` -> `403 forbidden`.
- `managerId` пустой/невалидный -> `400 invalid_request`.

> Текущее состояние: mobile endpoints используют manager-scoping через Firestore query по `whatsappClients.managerId`.

---

## 2. Unified error model

```json
{
  "ok": false,
  "code": "invalid_request",
  "message": "managerId is required",
  "details": {}
}
```

### HTTP status map
- `400` invalid request / invalid json / invalid params
- `401` unauthenticated (reserved for future auth)
- `403` forbidden (chat belongs to another manager)
- `404` chat/message not found
- `409` conflict (duplicate send, stale update, idempotency conflict)
- `429` throttled (reserved)
- `500` internal_error
- `501` not_implemented (intentional stubs)

---

## 3. Data types and field semantics

### Chat fields
- `chatId: string` (non-null) — stable conversation id.
- `title: string` (non-null) — display title (`clientName` fallback `phone`).
- `clientName: string` (non-null, may equal title).
- `phone: string` (non-null, can be empty for some channels).
- `preview: string` (non-null, may be empty).
- `unreadCount: number` (>=0) — server truth for badges.
- `lastMessageAt: number` (unix ms) — ordering anchor.
- `sourceTimestamp: number` (unix ms) — sync cursor timestamp (server side).
- `status: string` — e.g. `active|archived|closed`.
- `tags: string[]` — optional filter dimensions.
- `avatarUrl: string|null`.

### Message fields
- `messageId: string` (server document id).
- `serverMessageId: string` (provider id or fallback messageId).
- `chatId: string`.
- `direction: "incoming"|"outgoing"`.
- `text: string` (non-null; empty allowed only for media placeholders).
- `status: "pending"|"sent"|"delivered"|"read"|"failed"`.
- `createdAt: number` (unix ms).
- `attachments: Attachment[]` (empty array if none).

### Send mapping fields
- `clientMessageId: string` — client-generated UUID, idempotency key per `(managerId, chatId)`.
- `serverMessageId: string` — canonical id assigned by backend/provider.

### Unread/read rules
- Source of truth: backend conversation unread state.
- Android может optimistic-reset локально на `mark-read`, но обязан синхронизироваться с server response.

---

## 4. Incremental sync semantics

Chosen model for V1: **mixed timestamp + cursor**
- snapshot paging: `cursor = lastMessageAt`
- incremental: `since = sourceTimestamp`

### Snapshot mode
`GET /api/mobile/chat-list?managerId=...&limit=50&cursor=...`
- returns ordered page,
- `hasMore`, `nextCursor`.

### Incremental mode
`GET /api/mobile/chat-list?managerId=...&since=...`
- returns changed chats since timestamp,
- `deleted` tombstones array (currently always empty; contract reserved),
- new `sourceTimestamp`.

### Tombstones
- `deleted: [{ chatId, deletedAt, reason }]`
- Android removes/archives local items accordingly.

---

## 5. Endpoint contracts

## A) GET `/api/mobile/chat-list`

### Query
- `managerId` (required)
- `limit` (optional, default 50, max 100)
- `cursor` (optional, unix ms) snapshot paging cursor
- `since` (optional, unix ms) incremental mode switch

### Response 200
```json
{
  "ok": true,
  "contractVersion": "2026-03-android-chat-v1",
  "mode": "snapshot",
  "items": [
    {
      "chatId": "conv_123",
      "title": "Иван",
      "clientName": "Иван",
      "phone": "+77001234567",
      "preview": "Здравствуйте",
      "lastMessageAt": 1765000000000,
      "unreadCount": 2,
      "avatarUrl": null,
      "status": "active",
      "tags": ["vip"],
      "sourceTimestamp": 1765000000000
    }
  ],
  "deleted": [],
  "sourceTimestamp": 1765000000000,
  "hasMore": false,
  "nextCursor": null,
  "count": 1,
  "meta": {
    "unreadTotal": 2,
    "totalChats": 1
  }
}
```

---

## B) GET `/api/mobile/chat-list?since=...` (incremental)

### Response 200
```json
{
  "ok": true,
  "contractVersion": "2026-03-android-chat-v1",
  "mode": "incremental",
  "items": [],
  "deleted": [
    { "chatId": "conv_deleted", "deletedAt": 1765000010000, "reason": "archived" }
  ],
  "sourceTimestamp": 1765000010000,
  "hasMore": false,
  "nextCursor": null,
  "count": 0,
  "meta": { "unreadTotal": 0, "totalChats": 0 }
}
```

---

## C) GET `/api/mobile/chat-thread`

### Query
- `managerId` (required)
- `chatId` (required)
- `before` (optional unix ms; older-than cursor)
- `limit` (optional default 50 max 100)

### Response 200
```json
{
  "ok": true,
  "contractVersion": "2026-03-android-chat-v1",
  "chatId": "conv_123",
  "items": [
    {
      "messageId": "msg_1",
      "serverMessageId": "wz_abc",
      "chatId": "conv_123",
      "direction": "incoming",
      "text": "Здравствуйте",
      "status": "read",
      "createdAt": 1765000000000,
      "attachments": []
    }
  ],
  "hasMore": false,
  "nextBefore": null,
  "threadMeta": {
    "status": "active",
    "unreadCount": 0,
    "lastReadMessageId": "msg_1"
  }
}
```

---

## D) POST `/api/mobile/send-message`

### Request
```json
{
  "managerId": "manager-1",
  "chatId": "conv_123",
  "text": "Добрый день",
  "clientMessageId": "6cb4b9a9-0fb4-4858-8d2e-1d0d4e4a0e7b"
}
```

### Response 200 (target contract)
```json
{
  "ok": true,
  "chatId": "conv_123",
  "clientMessageId": "6cb4b9a9-0fb4-4858-8d2e-1d0d4e4a0e7b",
  "serverMessageId": "wz_778899",
  "status": "sent",
  "createdAt": 1765000020000
}
```

### Idempotency
- Повтор с тем же `(managerId, chatId, clientMessageId)` должен вернуть тот же `serverMessageId`.
- Если payload отличается при том же ключе -> `409 conflict`.

Текущее состояние: endpoint реализован для text-send + idempotency storage (`mobileSendIdempotency`).

---

## E) POST `/api/mobile/mark-read`

### Request
```json
{
  "managerId": "manager-1",
  "chatId": "conv_123",
  "lastReadMessageId": "msg_1"
}
```

### Response 200
```json
{
  "ok": true,
  "chatId": "conv_123",
  "unreadCount": 0,
  "markedAt": 1765000030000,
  "lastReadMessageId": "msg_1"
}
```

Semantics:
- backend updates canonical unread state,
- list/thread should converge to `unreadCount=0`.

---

## F) GET `/api/mobile/chat-meta`

### Query
- `managerId` required

### Response 200
```json
{
  "ok": true,
  "managerId": "manager-1",
  "unreadTotal": 12,
  "waitingCount": 7,
  "activeChats": 25,
  "sourceTimestamp": 1765000040000
}
```

---

## G) POST `/api/mobile/upload` (V1.1)

### Planned request (draft)
- multipart or pre-signed flow,
- `managerId`, `chatId`, file payload.

### Planned response
```json
{
  "ok": true,
  "uploadId": "upl_123",
  "url": "https://...",
  "mimeType": "image/jpeg",
  "size": 12345
}
```

Текущее состояние: endpoint остаётся `501` (V1.1 scope).

---

## 6. Send / Read / Sync behavior

### Optimistic send
1. Android inserts local pending message with `clientMessageId`.
2. Calls `/mobile/send-message`.
3. On success maps local pending -> `serverMessageId` and status `sent`.
4. On error keeps failed with retry affordance.

### Retry and duplicate protection
- retry must reuse same `clientMessageId`.
- server treats as idempotent replay.

### Push-before-sync race
- if push arrives first, Android applies cache patch (idempotent by `messageId`/`eventId` where possible),
- then incremental sync reconciles authoritative state.

### Mark-read truth model
- canonical unread belongs to backend conversation.
- Android optimistic update allowed, but must accept server override after sync.

---

## 7. Push to cache implications

Expected push payload:
```json
{
  "type": "message",
  "chatId": "conv_123",
  "phone": "+77001234567",
  "clientName": "Иван",
  "preview": "Новый текст",
  "unreadCount": "3",
  "targetUrl": "https://2wix.ru/whatsapp?chatId=conv_123",
  "messageId": "evt_123"
}
```

Rules:
- apply to list cache immediately,
- mark dirty if payload incomplete,
- enqueue background sync.

Merge/precedence rules (implemented in Android repository):
- duplicate push by `eventId/messageId` is dropped,
- stale push without stable ids (`timestamp << local lastMessageAt`) is dropped,
- if chat is currently open, push keeps `unreadCount=0` and triggers mark-read reconcile,
- push should not overwrite fresher list row from sync/send,
- server sync remains final source of truth.

---

## 8. Test payloads and edge cases

### Empty list
```json
{ "ok": true, "items": [], "deleted": [], "sourceTimestamp": 0, "hasMore": false, "nextCursor": null, "count": 0 }
```

### Failed send (retryable)
```json
{ "ok": false, "code": "transport_error", "message": "provider timeout", "retryable": true }
```

### Duplicate send conflict
```json
{ "ok": false, "code": "conflict", "message": "clientMessageId already used with different payload" }
```

### Chat not found
```json
{ "ok": false, "code": "chat_not_found", "message": "chat does not exist" }
```

---

## 9. Current implementation readiness

Implemented now:
- `GET /api/mobile/chat-list`
- `GET /api/mobile/chat-thread`
- `POST /api/mobile/send-message`
- `POST /api/mobile/mark-read`
- `GET /api/mobile/chat-meta`
- `POST /api/mobile/upload` (stub 501)

Open questions before ChatThread V1 full production:
- auth model (token-based vs managerId-only),
- tombstones source for archived/deleted chats,
- full idempotent send storage,
- attachment transport strategy.
