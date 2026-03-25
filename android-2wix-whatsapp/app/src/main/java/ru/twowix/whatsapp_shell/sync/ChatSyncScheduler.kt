package ru.twowix.whatsapp_shell.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import java.util.concurrent.TimeUnit

object ChatSyncScheduler {
  private const val PERIODIC_NAME = "chat_sync_periodic"
  private const val IMMEDIATE_NAME = "chat_sync_now"

  fun enqueueImmediate(context: Context, reason: String) {
    val req = OneTimeWorkRequestBuilder<ChatSyncWorker>()
      .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
      .setInputData(workDataOf(ChatSyncWorker.KEY_REASON to reason))
      .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
      .build()
    WorkManager.getInstance(context.applicationContext)
      .enqueueUniqueWork(IMMEDIATE_NAME, ExistingWorkPolicy.KEEP, req)
  }

  fun ensurePeriodic(context: Context) {
    val req = PeriodicWorkRequestBuilder<ChatSyncWorker>(30, TimeUnit.MINUTES)
      .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
      .setInputData(workDataOf(ChatSyncWorker.KEY_REASON to "periodic"))
      .build()
    WorkManager.getInstance(context.applicationContext)
      .enqueueUniquePeriodicWork(PERIODIC_NAME, ExistingPeriodicWorkPolicy.KEEP, req)
  }
}
