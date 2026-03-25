package ru.twowix.whatsapp_shell.data.chat

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface CachedChatDao {
  @Query("SELECT * FROM cached_chats ORDER BY lastMessageAt DESC, updatedAt DESC")
  fun observeAll(): Flow<List<CachedChatEntity>>

  @Query("SELECT * FROM cached_chats ORDER BY lastMessageAt DESC, updatedAt DESC")
  suspend fun getAll(): List<CachedChatEntity>

  @Query("SELECT * FROM cached_chats WHERE chatId = :chatId LIMIT 1")
  fun observeById(chatId: String): Flow<CachedChatEntity?>

  @Query("SELECT * FROM cached_chats WHERE chatId = :chatId LIMIT 1")
  suspend fun getById(chatId: String): CachedChatEntity?

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun upsert(item: CachedChatEntity)

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun upsertAll(items: List<CachedChatEntity>)

  @Query("DELETE FROM cached_chats")
  suspend fun clear()

  @Query("SELECT COUNT(*) FROM cached_chats")
  suspend fun count(): Int

  @Query("SELECT MAX(sourceTimestamp) FROM cached_chats")
  suspend fun maxSourceTimestamp(): Long?

  @Query("UPDATE cached_chats SET unreadCount = :unread, updatedAt = :updatedAt WHERE chatId = :chatId")
  suspend fun updateUnread(chatId: String, unread: Int, updatedAt: Long)
}
