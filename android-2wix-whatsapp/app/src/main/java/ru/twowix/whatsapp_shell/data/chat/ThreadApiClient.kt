package ru.twowix.whatsapp_shell.data.chat

import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

class ThreadApiClient(
  private val http: OkHttpClient = OkHttpClient(),
) {
  data class ThreadMessageDto(
    val messageId: String?,
    val serverMessageId: String?,
    val clientMessageId: String?,
    val chatId: String,
    val direction: String,
    val text: String,
    val status: String,
    val createdAt: Long,
    val attachmentsJson: String,
  )

  data class ThreadResult(
    val ok: Boolean,
    val code: Int?,
    val message: String,
    val items: List<ThreadMessageDto>,
    val hasMore: Boolean,
    val nextBefore: Long?,
  )

  data class SendResult(
    val ok: Boolean,
    val code: Int?,
    val message: String,
    val serverMessageId: String?,
    val status: String,
    val createdAt: Long,
  )

  data class MarkReadResult(
    val ok: Boolean,
    val code: Int?,
    val message: String,
    val unreadCount: Int,
  )

  fun fetchThread(baseUrl: String, managerId: String, chatId: String, before: Long?): ThreadResult {
    val root = baseUrl.trim().trimEnd('/')
    val first = doFetch("$root/api/mobile/chat-thread", managerId, chatId, before)
    if (!first.ok && first.code == 404) {
      return doFetch("$root/.netlify/functions/mobile-chat-thread", managerId, chatId, before)
    }
    return first
  }

  fun sendMessage(baseUrl: String, managerId: String, chatId: String, text: String, clientMessageId: String): SendResult {
    val root = baseUrl.trim().trimEnd('/')
    val payload = JSONObject()
      .put("managerId", managerId)
      .put("chatId", chatId)
      .put("text", text)
      .put("clientMessageId", clientMessageId)
      .toString()
    val first = doPost("$root/api/mobile/send-message", payload)
    if (!first.ok && first.code == 404) {
      return doPost("$root/.netlify/functions/mobile-send-message", payload)
    }
    return first
  }

  fun markRead(baseUrl: String, managerId: String, chatId: String, lastReadMessageId: String?): MarkReadResult {
    val root = baseUrl.trim().trimEnd('/')
    val body = JSONObject()
      .put("managerId", managerId)
      .put("chatId", chatId)
      .apply {
        if (!lastReadMessageId.isNullOrBlank()) put("lastReadMessageId", lastReadMessageId)
      }
      .toString()
    val first = doMarkRead("$root/api/mobile/mark-read", body)
    if (!first.ok && first.code == 404) {
      return doMarkRead("$root/.netlify/functions/mobile-mark-read", body)
    }
    return first
  }

  private fun doFetch(url: String, managerId: String, chatId: String, before: Long?): ThreadResult {
    val httpUrl = url.toHttpUrlOrNull()?.newBuilder()
      ?.addQueryParameter("managerId", managerId)
      ?.addQueryParameter("chatId", chatId)
      ?.apply { if (before != null && before > 0L) addQueryParameter("before", before.toString()) }
      ?.build()
      ?: return ThreadResult(false, null, "Invalid url", emptyList(), false, null)

    val req = Request.Builder().url(httpUrl).get().build()
    return runCatching {
      http.newCall(req).execute().use { resp ->
        val raw = resp.body?.string().orEmpty()
        if (!resp.isSuccessful) return ThreadResult(false, resp.code, "HTTP ${resp.code}", emptyList(), false, null)
        val json = JSONObject(raw)
        val arr = json.optJSONArray("items") ?: JSONArray()
        val items = buildList {
          for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            add(
              ThreadMessageDto(
                messageId = o.optString("messageId").ifBlank { null },
                serverMessageId = o.optString("serverMessageId").ifBlank { null },
                clientMessageId = o.optString("clientMessageId").ifBlank { null },
                chatId = o.optString("chatId").ifBlank { chatId },
                direction = o.optString("direction").ifBlank { "incoming" },
                text = o.optString("text"),
                status = o.optString("status").ifBlank { "sent" },
                createdAt = o.optLong("createdAt", 0L),
                attachmentsJson = o.optJSONArray("attachments")?.toString() ?: "[]"
              )
            )
          }
        }
        ThreadResult(
          ok = true,
          code = resp.code,
          message = "HTTP ${resp.code}",
          items = items,
          hasMore = json.optBoolean("hasMore", false),
          nextBefore = if (json.has("nextBefore") && !json.isNull("nextBefore")) json.optLong("nextBefore") else null
        )
      }
    }.getOrElse {
      ThreadResult(false, null, "${it.javaClass.simpleName}: ${it.message}", emptyList(), false, null)
    }
  }

  private fun doPost(url: String, body: String): SendResult {
    val req = Request.Builder()
      .url(url)
      .post(body.toRequestBody("application/json; charset=utf-8".toMediaType()))
      .build()
    return runCatching {
      http.newCall(req).execute().use { resp ->
        val raw = resp.body?.string().orEmpty()
        val json = runCatching { JSONObject(raw) }.getOrElse { JSONObject() }
        val serverMessageId = json.optString("serverMessageId").ifBlank { null }
        val status = json.optString("status").ifBlank { if (resp.isSuccessful) "sent" else "failed" }
        val createdAt = json.optLong("createdAt", System.currentTimeMillis())
        if (!resp.isSuccessful) {
          return SendResult(false, resp.code, json.optString("message").ifBlank { "HTTP ${resp.code}" }, serverMessageId, status, createdAt)
        }
        SendResult(true, resp.code, "HTTP ${resp.code}", serverMessageId, status, createdAt)
      }
    }.getOrElse {
      SendResult(false, null, "${it.javaClass.simpleName}: ${it.message}", null, "failed", System.currentTimeMillis())
    }
  }

  private fun doMarkRead(url: String, body: String): MarkReadResult {
    val req = Request.Builder()
      .url(url)
      .post(body.toRequestBody("application/json; charset=utf-8".toMediaType()))
      .build()
    return runCatching {
      http.newCall(req).execute().use { resp ->
        val raw = resp.body?.string().orEmpty()
        val json = runCatching { JSONObject(raw) }.getOrElse { JSONObject() }
        if (!resp.isSuccessful) {
          return MarkReadResult(false, resp.code, json.optString("message").ifBlank { "HTTP ${resp.code}" }, 0)
        }
        MarkReadResult(true, resp.code, "HTTP ${resp.code}", json.optInt("unreadCount", 0))
      }
    }.getOrElse {
      MarkReadResult(false, null, "${it.javaClass.simpleName}: ${it.message}", 0)
    }
  }
}
