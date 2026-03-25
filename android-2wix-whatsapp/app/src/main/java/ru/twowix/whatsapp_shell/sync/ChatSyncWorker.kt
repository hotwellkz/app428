package ru.twowix.whatsapp_shell.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import ru.twowix.whatsapp_shell.data.chat.ChatRepository

class ChatSyncWorker(
  context: Context,
  params: WorkerParameters,
) : CoroutineWorker(context, params) {
  override suspend fun doWork(): Result {
    val reason = inputData.getString(KEY_REASON) ?: "worker"
    val out = ChatRepository.get(applicationContext).syncNow(reason)
    if (out.ok) return Result.success()
    if (out.message.contains("managerId is empty", ignoreCase = true)) return Result.failure()
    return Result.retry()
  }

  companion object {
    const val KEY_REASON = "reason"
  }
}
