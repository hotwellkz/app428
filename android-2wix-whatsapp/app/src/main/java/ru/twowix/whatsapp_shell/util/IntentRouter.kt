package ru.twowix.whatsapp_shell.util

import android.content.Intent
import android.net.Uri
import ru.twowix.whatsapp_shell.BuildConfig

/**
 * Единая точка для маршрутизации intent → URL.
 * Позже сюда просто подключится FCM (по нажатию на пуш) без изменения WebView-слоя.
 */
object IntentRouter {
  const val EXTRA_TARGET_URL = "targetUrl"
  const val EXTRA_CHAT_ID = "chatId"

  fun routeFromIntent(intent: Intent?): WebTarget {
    if (intent == null) return WebTarget(BuildConfig.START_URL, source = "launcher")

    val targetUrl = intent.getStringExtra(EXTRA_TARGET_URL)?.trim().orEmpty()
    if (targetUrl.isNotEmpty()) {
      return WebTarget(normalizeUrl(targetUrl), source = "intent.targetUrl")
    }

    val chatId = intent.getStringExtra(EXTRA_CHAT_ID)?.trim().orEmpty()
    if (chatId.isNotEmpty()) {
      return WebTarget(buildChatUrl(chatId), source = "intent.chatId")
    }

    // Если это android deep link (data uri) — тоже поддержим как "targetUrl"
    val data: Uri? = intent.data
    if (data != null) {
      return WebTarget(normalizeUrl(data.toString()), source = "intent.data")
    }

    return WebTarget(BuildConfig.START_URL, source = "launcher")
  }

  /**
   * Пока точного URL для конкретного чата может не быть.
   * Здесь оставлена централизованная формула, чтобы её можно было заменить без правок UI.
   */
  fun buildChatUrl(chatId: String): String {
    // Вариант 1 (по умолчанию): query param (можно заменить на hash/route)
    val base = BuildConfig.START_URL.trimEnd('/')
    val encoded = Uri.encode(chatId)
    return "$base?chatId=$encoded"
  }

  private fun normalizeUrl(url: String): String {
    // Разрешаем только https:// и относительные пути от 2wix
    val trimmed = url.trim()
    return when {
      trimmed.startsWith("http://") -> trimmed.replaceFirst("http://", "https://")
      trimmed.startsWith("https://") -> trimmed
      trimmed.startsWith("/") -> BuildConfig.API_BASE_URL_DEFAULT.trimEnd('/') + trimmed
      else -> trimmed
    }
  }
}

