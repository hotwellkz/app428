package ru.twowix.whatsapp_shell.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import ru.twowix.whatsapp_shell.R
import ru.twowix.whatsapp_shell.MainActivity
import ru.twowix.whatsapp_shell.util.IntentRouter

object NotificationHelper {
  const val CHANNEL_MESSAGES = "messages"
  private const val GROUP_MESSAGES = "group_messages"

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

  fun canPostNotifications(context: Context): Boolean {
    if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      return context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) ==
        android.content.pm.PackageManager.PERMISSION_GRANTED
    }
    return true
  }

  fun showMessage(
    context: Context,
    title: String,
    text: String?,
    unreadCount: Int?,
    chatId: String?,
    targetUrl: String?,
  ) {
    ensureChannels(context)
    if (!canPostNotifications(context)) return

    val intent = Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      if (!targetUrl.isNullOrBlank()) {
        putExtra(IntentRouter.EXTRA_TARGET_URL, targetUrl)
      } else if (!chatId.isNullOrBlank()) {
        putExtra(IntentRouter.EXTRA_CHAT_ID, chatId)
      }
    }

    val pending = PendingIntent.getActivity(
      context,
      stableRequestCode(chatId, targetUrl),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
    )

    val builder = NotificationCompat.Builder(context, CHANNEL_MESSAGES)
      .setSmallIcon(android.R.drawable.stat_notify_chat)
      .setContentTitle(title)
      .setContentText(text ?: "")
      .setStyle(NotificationCompat.BigTextStyle().bigText(text ?: ""))
      .setAutoCancel(true)
      .setContentIntent(pending)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setGroup(GROUP_MESSAGES)
      .setNumber((unreadCount ?: 1).coerceAtLeast(1))

    if (unreadCount != null && unreadCount > 0) {
      builder.setSubText("Непрочитанных: $unreadCount")
    }

    val notificationId = stableNotificationId(chatId, targetUrl)
    NotificationManagerCompat.from(context).notify(notificationId, builder.build())

    // Summary (чтобы grouping работал аккуратно при множестве уведомлений)
    val summary = NotificationCompat.Builder(context, CHANNEL_MESSAGES)
      .setSmallIcon(android.R.drawable.stat_notify_chat)
      .setContentTitle(context.getString(R.string.notification_channel_messages))
      .setContentText("Новые сообщения")
      .setStyle(NotificationCompat.InboxStyle())
      .setGroup(GROUP_MESSAGES)
      .setGroupSummary(true)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .build()
    NotificationManagerCompat.from(context).notify(999000, summary)
  }

  fun showTestMessage(
    context: Context,
    title: String = "Новое сообщение",
    text: String = "Тестовое уведомление (локально)",
  ) {
    showMessage(
      context = context,
      title = title,
      text = text,
      unreadCount = null,
      chatId = null,
      targetUrl = null
    )
  }

  private fun stableNotificationId(chatId: String?, targetUrl: String?): Int {
    val key = chatId?.takeIf { it.isNotBlank() } ?: targetUrl?.takeIf { it.isNotBlank() } ?: "generic"
    return (key.hashCode() and 0x7fffffff) % 1000000 + 1000
  }

  private fun stableRequestCode(chatId: String?, targetUrl: String?): Int {
    val key = "tap:" + (chatId?.takeIf { it.isNotBlank() } ?: targetUrl?.takeIf { it.isNotBlank() } ?: "generic")
    return (key.hashCode() and 0x7fffffff) % 1000000 + 2000
  }
}

