package ru.twowix.whatsapp_shell.push

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.first
import java.time.Instant
import ru.twowix.whatsapp_shell.data.DeviceRegistrationClient
import ru.twowix.whatsapp_shell.data.AppPreferences
import ru.twowix.whatsapp_shell.notifications.NotificationHelper
import ru.twowix.whatsapp_shell.util.IntentRouter

/**
 * Production-friendly FCM client side:
 * - onNewToken: сохраняем токен в prefs (и позже регистрируем на backend)
 * - onMessageReceived: парсим data payload и показываем уведомление
 */
class TwowixFirebaseMessagingService : FirebaseMessagingService() {
  private val deviceReg = DeviceRegistrationClient()

  override fun onNewToken(token: String) {
    Log.i("TwowixFCM", "New token: ${token.take(12)}… (${token.length})")
    val prefs = AppPreferences(applicationContext)
    CoroutineScope(Dispatchers.IO).launch {
      runCatching { prefs.setFcmToken(token) }
      val baseUrl = runCatching { prefs.apiBaseUrl.first() }.getOrElse { ru.twowix.whatsapp_shell.BuildConfig.API_BASE_URL_DEFAULT }
      val managerId = runCatching { prefs.managerId.first() }.getOrElse { "" }.trim()
      if (managerId.isNotBlank()) {
        val reg = deviceReg.registerDevice(baseUrl, managerId, token)
        val detail = buildString {
          append(reg.message)
          if (reg.responseBody.isNotBlank()) append(" | ").append(reg.responseBody.take(200))
        }
        prefs.setLastRegistration(
          status = if (reg.ok) "success" else "error",
          response = detail,
          url = reg.finalUrl,
          httpCode = reg.code?.toString().orEmpty()
        )
      } else {
        Log.w("DeviceReg", "managerId is empty; skip register-device (set it in Settings)")
        prefs.setLastRegistration(
          status = "warning",
          response = "managerId is empty; registration skipped",
          url = "",
          httpCode = ""
        )
      }
    }
  }

  override fun onMessageReceived(message: RemoteMessage) {
    val data = message.data.orEmpty()
    Log.i("TwowixFCM", "Message received: keys=${data.keys.sorted()} from=${message.from}")
    if (data.isEmpty()) {
      // На проде ожидаем data payload. Если прилетело без data — не падаем.
      return
    }

    val payload = PushPayload.fromDataMap(data)
    val title = payload.title
    val text = payload.preview ?: data["body"] ?: data["text"]

    // Если targetUrl нет — используем chatId → формула в IntentRouter.
    val targetUrl = payload.bestTargetUrl { chatId -> IntentRouter.buildChatUrl(chatId) }

    val prefs = AppPreferences(applicationContext)
    CoroutineScope(Dispatchers.IO).launch {
      // Уважим настройку: если пользователь отключил уведомления — не показываем.
      val enabled = prefs.notificationsEnabled.first()
      if (!enabled) return@launch

      NotificationHelper.showMessage(
        context = applicationContext,
        title = title,
        text = text,
        unreadCount = payload.unreadCount,
        chatId = payload.chatId,
        targetUrl = targetUrl
      )
      prefs.setLastPushAt(Instant.now().toString())
    }
  }
}

