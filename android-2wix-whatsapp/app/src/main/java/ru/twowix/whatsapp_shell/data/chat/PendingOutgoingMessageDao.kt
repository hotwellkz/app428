package ru.twowix.whatsapp_shell.data.chat

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface PendingOutgoingMessageDao {
  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun upsert(item: PendingOutgoingMessageEntity)

  @Query("SELECT * FROM pending_outgoing_messages WHERE clientMessageId = :clientMessageId LIMIT 1")
  suspend fun get(clientMessageId: String): PendingOutgoingMessageEntity?

  @Query("SELECT * FROM pending_outgoing_messages WHERE chatId = :chatId ORDER BY createdAt ASC")
  fun observeByChat(chatId: String): Flow<List<PendingOutgoingMessageEntity>>

  @Query("DELETE FROM pending_outgoing_messages WHERE clientMessageId = :clientMessageId")
  suspend fun delete(clientMessageId: String)

  @Query("SELECT COUNT(*) FROM pending_outgoing_messages")
  suspend fun countAll(): Int

  @Query("DELETE FROM pending_outgoing_messages")
  suspend fun clear()
}
