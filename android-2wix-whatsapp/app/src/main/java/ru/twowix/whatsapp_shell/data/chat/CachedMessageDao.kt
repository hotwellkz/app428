package ru.twowix.whatsapp_shell.data.chat

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface CachedMessageDao {
  @Query("SELECT * FROM cached_messages WHERE chatId = :chatId ORDER BY createdAt ASC, localId ASC")
  fun observeThread(chatId: String): Flow<List<CachedMessageEntity>>

  @Query("SELECT * FROM cached_messages WHERE chatId = :chatId ORDER BY createdAt ASC, localId ASC")
  suspend fun getThread(chatId: String): List<CachedMessageEntity>

  @Query("SELECT MIN(createdAt) FROM cached_messages WHERE chatId = :chatId")
  suspend fun minCreatedAt(chatId: String): Long?

  @Query("SELECT MAX(createdAt) FROM cached_messages WHERE chatId = :chatId")
  suspend fun maxCreatedAt(chatId: String): Long?

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun upsert(item: CachedMessageEntity): Long

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun upsertAll(items: List<CachedMessageEntity>)

  @Query("SELECT * FROM cached_messages WHERE chatId = :chatId AND clientMessageId = :clientMessageId LIMIT 1")
  suspend fun findByClientMessageId(chatId: String, clientMessageId: String): CachedMessageEntity?

  @Query("SELECT * FROM cached_messages WHERE chatId = :chatId AND serverMessageId = :serverMessageId LIMIT 1")
  suspend fun findByServerMessageId(chatId: String, serverMessageId: String): CachedMessageEntity?

  @Query("SELECT * FROM cached_messages WHERE chatId = :chatId AND status = 'pending' ORDER BY createdAt DESC LIMIT 1")
  suspend fun findLatestPending(chatId: String): CachedMessageEntity?

  @Query("UPDATE cached_messages SET status = :status, serverMessageId = :serverMessageId, messageId = COALESCE(:messageId, messageId), errorMessage = :error, updatedAt = :updatedAt WHERE chatId = :chatId AND clientMessageId = :clientMessageId")
  suspend fun updatePendingResult(
    chatId: String,
    clientMessageId: String,
    status: String,
    serverMessageId: String?,
    messageId: String?,
    error: String?,
    updatedAt: Long,
  )

  @Query("DELETE FROM cached_messages")
  suspend fun clear()
}
