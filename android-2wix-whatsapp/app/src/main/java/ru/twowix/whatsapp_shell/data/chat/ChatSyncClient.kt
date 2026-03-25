package ru.twowix.whatsapp_shell.data.chat

import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject

class ChatSyncClient(
  private val http: OkHttpClient = OkHttpClient(),
) {
  data class ChatDto(
    val chatId: String,
    val title: String,
    val phone: String,
    val preview: String,
    val lastMessageAt: Long,
    val unreadCount: Int,
    val avatarUrl: String?,
    val status: String?,
    val tags: String?,
    val sourceTimestamp: Long,
  )

  data class SyncResult(
    val ok: Boolean,
    val code: Int?,
    val message: String,
    val chats: List<ChatDto>,
    val finalUrl: String,
    val sourceTimestamp: Long,
  )

  fun fetchChats(baseUrl: String, managerId: String, since: Long?): SyncResult {
    val root = baseUrl.trim().trimEnd('/')
    val primary = "$root/api/mobile/chat-list"
    val first = request(url = primary, managerId = managerId, since = since)
    if (!first.ok && first.code == 404) {
      val fallback = "$root/.netlify/functions/mobile-chat-list"
      val second = request(url = fallback, managerId = managerId, since = since)
      return second.copy(message = if (second.ok) "${second.message} (fallback)" else second.message)
    }
    return first
  }

  private fun request(url: String, managerId: String, since: Long?): SyncResult {
    val httpUrl = url.toHttpUrlOrNull()?.newBuilder()
      ?.addQueryParameter("managerId", managerId)
      ?.apply { if (since != null && since > 0L) addQueryParameter("since", since.toString()) }
      ?.build()
      ?: return SyncResult(false, null, "Invalid url", emptyList(), url, 0L)

    val req = Request.Builder().url(httpUrl).get().build()
    return runCatching {
      http.newCall(req).execute().use { resp ->
        val raw = resp.body?.string().orEmpty()
        val code = resp.code
        if (!resp.isSuccessful) {
          return SyncResult(false, code, "HTTP $code @ ${httpUrl}", emptyList(), httpUrl.toString(), 0L)
        }
        val json = JSONObject(raw)
        val arr = json.optJSONArray("items") ?: JSONArray()
        val items = buildList {
          for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            val chatId = o.optString("chatId").trim()
            if (chatId.isBlank()) continue
            add(
              ChatDto(
                chatId = chatId,
                title = o.optString("title").ifBlank { o.optString("clientName") }.ifBlank { o.optString("phone") },
                phone = o.optString("phone"),
                preview = o.optString("preview"),
                lastMessageAt = o.optLong("lastMessageAt", 0L),
                unreadCount = o.optInt("unreadCount", 0).coerceAtLeast(0),
                avatarUrl = o.optString("avatarUrl").ifBlank { null },
                status = o.optString("status").ifBlank { null },
                tags = when (val tagsAny = o.opt("tags")) {
                  is JSONArray -> {
                    buildList {
                      for (j in 0 until tagsAny.length()) {
                        val t = tagsAny.optString(j).trim()
                        if (t.isNotBlank()) add(t)
                      }
                    }.joinToString(",")
                  }
                  is String -> tagsAny.trim().ifBlank { null }
                  else -> null
                },
                sourceTimestamp = o.optLong("sourceTimestamp", o.optLong("lastMessageAt", 0L))
              )
            )
          }
        }
        val maxTs = json.optLong("sourceTimestamp", items.maxOfOrNull { it.sourceTimestamp } ?: 0L)
        SyncResult(true, code, "HTTP $code", items, httpUrl.toString(), maxTs)
      }
    }.getOrElse {
      SyncResult(false, null, "${it.javaClass.simpleName}: ${it.message}", emptyList(), httpUrl.toString(), 0L)
    }
  }
}
