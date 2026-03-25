package ru.twowix.whatsapp_shell.data.chat

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cached_chats")
data class CachedChatEntity(
  @PrimaryKey val chatId: String,
  val title: String,
  val phone: String,
  val preview: String,
  val lastMessageAt: Long,
  val unreadCount: Int,
  val avatarUrl: String?,
  val status: String?,
  val tags: String?,
  val updatedAt: Long,
  val sourceTimestamp: Long,
  val isDirty: Boolean = false,
)
