package ru.twowix.whatsapp_shell.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import ru.twowix.whatsapp_shell.R

object NotificationHelper {
  const val CHANNEL_MESSAGES = "messages"

  fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val existing = nm.getNotificationChannel(CHANNEL_MESSAGES)
    if (existing != null) return

    val channel = NotificationChannel(
      CHANNEL_MESSAGES,
      context.getString(R.string.notification_channel_messages),
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      description = context.getString(R.string.notification_channel_messages_desc)
      enableVibration(true)
      setShowBadge(true)
    }
    nm.createNotificationChannel(channel)
  }

  fun showTestMessage(
    context: Context,
    title: String = "Новое сообщение",
    text: String = "Тестовое уведомление (локально)",
  ) {
    ensureChannels(context)
    val n = NotificationCompat.Builder(context, CHANNEL_MESSAGES)
      .setSmallIcon(android.R.drawable.stat_notify_chat)
      .setContentTitle(title)
      .setContentText(text)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .build()
    NotificationManagerCompat.from(context).notify(1001, n)
  }
}

