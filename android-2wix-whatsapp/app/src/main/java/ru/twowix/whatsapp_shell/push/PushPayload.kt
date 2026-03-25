package ru.twowix.whatsapp_shell.push

/**
 * Контракт data payload для push.
 *
 * Поддерживаемые поля:
 * - chatId
 * - phone
 * - clientName
 * - preview
 * - unreadCount
 * - targetUrl
 * - messageId
 * - type
 */
data class PushPayload(
  val chatId: String? = null,
  val phone: String? = null,
  val clientName: String? = null,
  val preview: String? = null,
  val unreadCount: Int? = null,
  val targetUrl: String? = null,
  val messageId: String? = null,
  val type: String? = null,
) {
  val title: String
    get() = (clientName?.takeIf { it.isNotBlank() } ?: phone?.takeIf { it.isNotBlank() } ?: "Новое сообщение")

  companion object {
    fun fromDataMap(data: Map<String, String>): PushPayload {
      fun get(key: String): String? = data[key]?.trim()?.takeIf { it.isNotEmpty() }
      fun getInt(key: String): Int? = get(key)?.toIntOrNull()

      return PushPayload(
        chatId = get("chatId"),
        phone = get("phone"),
        clientName = get("clientName"),
        preview = get("preview"),
        unreadCount = getInt("unreadCount"),
        targetUrl = get("targetUrl"),
        messageId = get("messageId"),
        type = get("type"),
      )
    }
  }

  fun bestTargetUrl(
    buildChatUrl: (String) -> String,
  ): String? {
    val direct = targetUrl?.trim()?.takeIf { it.isNotEmpty() }
    if (direct != null) return direct
    val cid = chatId?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    return buildChatUrl(cid)
  }
}

