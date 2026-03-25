package ru.twowix.whatsapp_shell.data.chat

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
  entities = [CachedChatEntity::class, CachedMessageEntity::class, PendingOutgoingMessageEntity::class],
  version = 2,
  exportSchema = false,
)
abstract class ChatDatabase : RoomDatabase() {
  abstract fun cachedChatDao(): CachedChatDao
  abstract fun cachedMessageDao(): CachedMessageDao
  abstract fun pendingOutgoingMessageDao(): PendingOutgoingMessageDao

  companion object {
    @Volatile
    private var INSTANCE: ChatDatabase? = null

    fun get(context: Context): ChatDatabase {
      return INSTANCE ?: synchronized(this) {
        INSTANCE ?: Room.databaseBuilder(
          context.applicationContext,
          ChatDatabase::class.java,
          "twowix_chat_cache.db"
        ).fallbackToDestructiveMigration().build().also { INSTANCE = it }
      }
    }
  }
}
