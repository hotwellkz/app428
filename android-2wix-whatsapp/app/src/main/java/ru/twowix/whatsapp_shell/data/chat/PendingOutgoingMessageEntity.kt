package ru.twowix.whatsapp_shell.data.chat

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "pending_outgoing_messages")
data class PendingOutgoingMessageEntity(
  @PrimaryKey val clientMessageId: String,
  val chatId: String,
  val text: String,
  val createdAt: Long,
  val attemptCount: Int,
  val lastAttemptAt: Long?,
  val lastError: String?,
)
