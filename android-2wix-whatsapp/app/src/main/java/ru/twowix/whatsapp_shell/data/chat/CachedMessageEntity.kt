package ru.twowix.whatsapp_shell.data.chat

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
  tableName = "cached_messages",
  indices = [
    Index(value = ["chatId", "createdAt"]),
    Index(value = ["chatId", "serverMessageId"], unique = true),
    Index(value = ["chatId", "clientMessageId"], unique = true)
  ]
)
data class CachedMessageEntity(
  @PrimaryKey(autoGenerate = true) val localId: Long = 0,
  val messageId: String?,
  val serverMessageId: String?,
  val clientMessageId: String?,
  val chatId: String,
  val direction: String,
  val text: String,
  val status: String,
  val createdAt: Long,
  val errorMessage: String?,
  val attachmentsJson: String?,
  val updatedAt: Long,
)
