package ru.twowix.whatsapp_shell.data.chat

import android.content.Context
import java.time.Instant
import java.util.UUID
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import ru.twowix.whatsapp_shell.data.AppPreferences
import ru.twowix.whatsapp_shell.push.PushPayload

class ChatRepository private constructor(
  context: Context,
  private val chatDao: CachedChatDao,
  private val messageDao: CachedMessageDao,
  private val pendingDao: PendingOutgoingMessageDao,
  private val prefs: AppPreferences,
  private val syncClient: ChatSyncClient,
  private val threadApi: ThreadApiClient,
) {
  data class SyncOutcome(
    val ok: Boolean,
    val source: String,
    val count: Int,
    val message: String,
  )

  data class PushApplyOutcome(
    val applied: Boolean,
    val dropped: Boolean,
    val reason: String,
    val needsReconcile: Boolean,
    val chatId: String?,
  )

  private val syncMutex = Mutex()
  private val threadMutexes = mutableMapOf<String, Mutex>()

  private fun threadMutex(chatId: String): Mutex =
    synchronized(threadMutexes) { threadMutexes.getOrPut(chatId) { Mutex() } }

  fun observeChats(): Flow<List<CachedChatEntity>> = chatDao.observeAll()
  fun observeChat(chatId: String): Flow<CachedChatEntity?> = chatDao.observeById(chatId)
  fun observeThread(chatId: String): Flow<List<CachedMessageEntity>> = messageDao.observeThread(chatId)
  fun observePending(chatId: String): Flow<List<PendingOutgoingMessageEntity>> = pendingDao.observeByChat(chatId)

  suspend fun chatCount(): Int = chatDao.count()
  suspend fun pendingCount(): Int = pendingDao.countAll()

  suspend fun clearCache() {
    messageDao.clear()
    pendingDao.clear()
    chatDao.clear()
  }

  suspend fun setActiveThread(chatId: String?) {
    prefs.setActiveChatId(chatId.orEmpty())
  }

  suspend fun syncNow(reason: String): SyncOutcome = syncMutex.withLock {
    val managerId = prefs.managerId.first().trim()
    if (managerId.isBlank()) {
      return SyncOutcome(false, "local", 0, "managerId is empty")
    }
    val baseUrl = prefs.apiBaseUrl.first()
    val since = chatDao.maxSourceTimestamp()?.takeIf { it > 0L }
    val result = syncClient.fetchChats(baseUrl = baseUrl, managerId = managerId, since = since)
    if (!result.ok) {
      return SyncOutcome(false, "local", 0, result.message)
    }

    val now = System.currentTimeMillis()
    var applied = 0
    for (it in result.chats) {
      val incomingLm = if (it.lastMessageAt > 0L) it.lastMessageAt else now
      val incomingSource = if (it.sourceTimestamp > 0L) it.sourceTimestamp else incomingLm
      val current = chatDao.getById(it.chatId)

      // stale network row should not overwrite fresher local state (usually from push/send)
      if (current != null && incomingSource < current.sourceTimestamp && incomingLm < current.lastMessageAt) {
        continue
      }

      chatDao.upsert(
        CachedChatEntity(
          chatId = it.chatId,
          title = it.title.ifBlank { it.phone.ifBlank { current?.title ?: "Чат" } },
          phone = it.phone.ifBlank { current?.phone.orEmpty() },
          preview = it.preview.ifBlank { current?.preview.orEmpty() },
          lastMessageAt = incomingLm,
          unreadCount = it.unreadCount.coerceAtLeast(0),
          avatarUrl = it.avatarUrl ?: current?.avatarUrl,
          status = it.status ?: current?.status,
          tags = it.tags ?: current?.tags,
          updatedAt = now,
          sourceTimestamp = incomingSource,
          isDirty = false,
        )
      )
      applied += 1
    }

    prefs.setLastChatSync(Instant.now().toString(), "network:$reason")
    SyncOutcome(true, "network", applied, result.message)
  }

  suspend fun refreshThread(chatId: String, before: Long? = null): SyncOutcome = threadMutex(chatId).withLock {
    val managerId = prefs.managerId.first().trim()
    if (managerId.isBlank()) return SyncOutcome(false, "local", 0, "managerId is empty")
    val baseUrl = prefs.apiBaseUrl.first()
    val result = threadApi.fetchThread(baseUrl, managerId, chatId, before)
    if (!result.ok) return SyncOutcome(false, "local", 0, result.message)

    val now = System.currentTimeMillis()
    var applied = 0
    var latestCreatedAt = 0L
    var latestPreview = ""

    for (it in result.items) {
      val created = if (it.createdAt > 0L) it.createdAt else now
      if (created > latestCreatedAt) {
        latestCreatedAt = created
        latestPreview = it.text
      }

      val byServer = it.serverMessageId?.let { sid -> messageDao.findByServerMessageId(chatId, sid) }
      val byClient = it.clientMessageId?.let { cid -> messageDao.findByClientMessageId(chatId, cid) }
      val existing = byServer ?: byClient

      if (existing == null) {
        messageDao.upsert(
          CachedMessageEntity(
            messageId = it.messageId,
            serverMessageId = it.serverMessageId,
            clientMessageId = it.clientMessageId,
            chatId = chatId,
            direction = it.direction,
            text = it.text,
            status = it.status,
            createdAt = created,
            errorMessage = null,
            attachmentsJson = it.attachmentsJson,
            updatedAt = now,
          )
        )
        applied += 1
      } else {
        // Merge status upgrade / ids without creating duplicates
        if (existing.status != it.status || existing.serverMessageId != it.serverMessageId || existing.messageId != it.messageId) {
          messageDao.upsert(
            existing.copy(
              messageId = it.messageId ?: existing.messageId,
              serverMessageId = it.serverMessageId ?: existing.serverMessageId,
              status = it.status,
              text = if (existing.text.isBlank()) it.text else existing.text,
              updatedAt = now,
              errorMessage = null,
            )
          )
        }
        it.clientMessageId?.let { cid -> pendingDao.delete(cid) }
      }
    }

    if (latestCreatedAt > 0L) {
      val chat = chatDao.getById(chatId)
      if (chat != null && latestCreatedAt >= chat.lastMessageAt) {
        chatDao.upsert(
          chat.copy(
            preview = latestPreview.ifBlank { chat.preview },
            lastMessageAt = latestCreatedAt,
            updatedAt = now,
            sourceTimestamp = maxOf(chat.sourceTimestamp, latestCreatedAt),
          )
        )
      }
    }

    prefs.setLastThreadSyncAt(Instant.now().toString())
    SyncOutcome(true, "network", applied, result.message)
  }

  suspend fun sendMessage(chatId: String, text: String): SyncOutcome {
    val managerId = prefs.managerId.first().trim()
    if (managerId.isBlank()) return SyncOutcome(false, "local", 0, "managerId is empty")
    val cleanText = text.trim()
    if (cleanText.isBlank()) return SyncOutcome(false, "local", 0, "Message is empty")

    val clientMessageId = UUID.randomUUID().toString()
    val now = System.currentTimeMillis()

    pendingDao.upsert(
      PendingOutgoingMessageEntity(
        clientMessageId = clientMessageId,
        chatId = chatId,
        text = cleanText,
        createdAt = now,
        attemptCount = 0,
        lastAttemptAt = null,
        lastError = null,
      )
    )

    messageDao.upsert(
      CachedMessageEntity(
        messageId = null,
        serverMessageId = null,
        clientMessageId = clientMessageId,
        chatId = chatId,
        direction = "outgoing",
        text = cleanText,
        status = "pending",
        createdAt = now,
        errorMessage = null,
        attachmentsJson = "[]",
        updatedAt = now,
      )
    )

    // Keep list and thread coherent instantly.
    val chat = chatDao.getById(chatId)
    if (chat != null && now >= chat.lastMessageAt) {
      chatDao.upsert(
        chat.copy(
          preview = cleanText,
          lastMessageAt = now,
          updatedAt = now,
          sourceTimestamp = maxOf(chat.sourceTimestamp, now),
          unreadCount = 0,
        )
      )
    }

    return sendPendingInternal(chatId, clientMessageId)
  }

  suspend fun retrySend(chatId: String, clientMessageId: String): SyncOutcome {
    return sendPendingInternal(chatId, clientMessageId)
  }

  private suspend fun sendPendingInternal(chatId: String, clientMessageId: String): SyncOutcome {
    val managerId = prefs.managerId.first().trim()
    if (managerId.isBlank()) return SyncOutcome(false, "local", 0, "managerId is empty")
    val baseUrl = prefs.apiBaseUrl.first()

    val pending = pendingDao.get(clientMessageId)
      ?: return SyncOutcome(false, "local", 0, "pending message not found")

    val result = threadApi.sendMessage(baseUrl, managerId, chatId, pending.text, clientMessageId)
    val now = System.currentTimeMillis()

    if (!result.ok) {
      messageDao.updatePendingResult(
        chatId = chatId,
        clientMessageId = clientMessageId,
        status = "failed",
        serverMessageId = result.serverMessageId,
        messageId = result.serverMessageId,
        error = result.message,
        updatedAt = now,
      )
      pendingDao.upsert(
        pending.copy(
          attemptCount = pending.attemptCount + 1,
          lastAttemptAt = now,
          lastError = result.message,
        )
      )
      prefs.setLastSendError(result.message)
      return SyncOutcome(false, "network", 0, result.message)
    }

    // If server id already exists in thread (possible after race with sync/push), do not duplicate.
    val existingByServer = result.serverMessageId?.let { sid -> messageDao.findByServerMessageId(chatId, sid) }
    if (existingByServer == null) {
      messageDao.updatePendingResult(
        chatId = chatId,
        clientMessageId = clientMessageId,
        status = "sent",
        serverMessageId = result.serverMessageId,
        messageId = result.serverMessageId,
        error = null,
        updatedAt = now,
      )
    } else {
      // pending duplicate can be dropped because canonical server row already exists
      messageDao.updatePendingResult(
        chatId = chatId,
        clientMessageId = clientMessageId,
        status = "sent",
        serverMessageId = existingByServer.serverMessageId,
        messageId = existingByServer.messageId,
        error = null,
        updatedAt = now,
      )
    }

    pendingDao.delete(clientMessageId)
    prefs.setLastSendError("")

    // Reconcile for consistent status/order.
    refreshThread(chatId)
    return SyncOutcome(true, "network", 1, "sent")
  }

  suspend fun markRead(chatId: String) {
    val now = System.currentTimeMillis()
    chatDao.updateUnread(chatId, unread = 0, updatedAt = now)

    val managerId = prefs.managerId.first().trim()
    if (managerId.isBlank()) return
    val baseUrl = prefs.apiBaseUrl.first()
    val lastReadMessageId = messageDao.getThread(chatId).lastOrNull()?.serverMessageId
    val result = threadApi.markRead(baseUrl, managerId, chatId, lastReadMessageId)
    if (result.ok) {
      chatDao.updateUnread(chatId, unread = result.unreadCount.coerceAtLeast(0), updatedAt = System.currentTimeMillis())
    }
  }

  suspend fun applyPushToCache(payload: PushPayload): PushApplyOutcome {
    val chatId = payload.chatId?.trim().orEmpty()
    if (chatId.isBlank()) {
      prefs.setLastDedupeReason("drop: missing chatId")
      return PushApplyOutcome(applied = false, dropped = true, reason = "missing_chatId", needsReconcile = false, chatId = null)
    }

    val now = System.currentTimeMillis()
    val pushTs = payload.timestamp?.takeIf { it > 0L } ?: now
    val sourceId = payload.messageId?.trim().orEmpty()
    val eventId = payload.eventId?.trim().orEmpty()
    val dedupeId = if (eventId.isNotBlank()) eventId else sourceId
    val current = chatDao.getById(chatId)

    if (current != null && pushTs > 0L && pushTs + 2000 < current.lastMessageAt && sourceId.isBlank()) {
      val reason = "drop: stale payload ts=$pushTs < current=${current.lastMessageAt}"
      prefs.setLastDedupeReason(reason)
      return PushApplyOutcome(false, true, reason, false, chatId)
    }

    val serverId = sourceId
    if (serverId.isNotBlank()) {
      val existing = messageDao.findByServerMessageId(chatId, serverId)
      if (existing != null) {
        val reason = "drop: duplicate serverMessageId=$serverId"
        prefs.setLastDedupeReason(reason)
        return PushApplyOutcome(false, true, reason, false, chatId)
      }
    }

    val activeChatId = prefs.activeChatId.first().trim()
    val isActiveThread = activeChatId == chatId

    val title = payload.clientName?.takeIf { it.isNotBlank() }
      ?: current?.title
      ?: payload.phone?.takeIf { it.isNotBlank() }
      ?: "Чат"

    val incomingPreview = payload.preview?.takeIf { it.isNotBlank() } ?: current?.preview.orEmpty()
    val unread = when {
      isActiveThread -> 0
      payload.unreadCount != null -> payload.unreadCount.coerceAtLeast(0)
      else -> (current?.unreadCount?.plus(1) ?: 1)
    }
    val sourceTs = pushTs

    val shouldUpdateList = current == null || pushTs >= current.lastMessageAt || dedupeId.isNotBlank()
    if (shouldUpdateList) {
      chatDao.upsert(
        CachedChatEntity(
          chatId = chatId,
          title = title,
          phone = payload.phone ?: current?.phone.orEmpty(),
          preview = incomingPreview,
          lastMessageAt = maxOf(pushTs, current?.lastMessageAt ?: 0L),
          unreadCount = unread,
          avatarUrl = current?.avatarUrl,
          status = current?.status,
          tags = current?.tags,
          updatedAt = now,
          sourceTimestamp = maxOf(sourceTs, current?.sourceTimestamp ?: 0L),
          isDirty = payload.preview.isNullOrBlank() || payload.clientName.isNullOrBlank()
        )
      )
    }

    if (serverId.isNotBlank()) {
      messageDao.upsert(
        CachedMessageEntity(
          messageId = serverId,
          serverMessageId = serverId,
          clientMessageId = null,
          chatId = chatId,
          direction = "incoming",
          text = payload.preview.orEmpty(),
          status = "sent",
          createdAt = pushTs,
          errorMessage = null,
          attachmentsJson = "[]",
          updatedAt = now,
        )
      )
    }

    if (isActiveThread) {
      // Keep unread consistent while user is inside this chat.
      markRead(chatId)
    }

    val reason = if (shouldUpdateList) "apply: push merged" else "apply: thread-only"
    prefs.setLastPushCacheApply("chatId=$chatId unread=$unread ts=$pushTs at=${Instant.now()}")
    prefs.setLastDedupeReason(reason)

    val needsReconcile = payload.preview.isNullOrBlank() || payload.clientName.isNullOrBlank() || serverId.isBlank()
    return PushApplyOutcome(applied = true, dropped = false, reason = reason, needsReconcile = needsReconcile, chatId = chatId)
  }

  companion object {
    @Volatile
    private var INSTANCE: ChatRepository? = null

    fun get(context: Context): ChatRepository {
      return INSTANCE ?: synchronized(this) {
        INSTANCE ?: run {
          val app = context.applicationContext
          val db = ChatDatabase.get(app)
          ChatRepository(
            context = app,
            chatDao = db.cachedChatDao(),
            messageDao = db.cachedMessageDao(),
            pendingDao = db.pendingOutgoingMessageDao(),
            prefs = AppPreferences(app),
            syncClient = ChatSyncClient(),
            threadApi = ThreadApiClient(),
          ).also { INSTANCE = it }
        }
      }
    }
  }
}
