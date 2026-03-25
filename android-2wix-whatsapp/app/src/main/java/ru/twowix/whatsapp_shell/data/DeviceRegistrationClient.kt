package ru.twowix.whatsapp_shell.data

import android.util.Log
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

/**
 * Регистрация FCM-токена и тест send-chat-push.
 *
 * На проде маршруты `/api/...` должны проксироваться в Netlify Functions (`public/_redirects`).
 * Если `/api/...` отдаёт 404 (старый деплой без правил), повторяем запрос на
 * `/.netlify/functions/<name>` — тот же хост.
 */
class DeviceRegistrationClient(
  private val http: OkHttpClient = OkHttpClient(),
) {
  data class Result(
    val ok: Boolean,
    val code: Int?,
    val message: String,
    val finalUrl: String = "",
    val responseBody: String = "",
  )

  private val json = "application/json; charset=utf-8".toMediaType()

  fun registerDevice(baseUrl: String, managerId: String, token: String): Result {
    val bodyJson = JSONObject()
      .put("managerId", managerId)
      .put("platform", "android")
      .put("token", token)
      .put("deviceModel", android.os.Build.MODEL ?: "")
      .put("appVersion", ru.twowix.whatsapp_shell.BuildConfig.VERSION_NAME)
      .toString()
    return postWithFallback(
      baseUrl = baseUrl,
      apiPath = "/api/mobile/register-device",
      functionName = "mobile-register-device",
      body = bodyJson,
      logTag = "DeviceReg",
    )
  }

  fun unregisterDevice(baseUrl: String, managerId: String, token: String): Result {
    val bodyJson = JSONObject()
      .put("managerId", managerId)
      .put("token", token)
      .toString()
    return postWithFallback(
      baseUrl = baseUrl,
      apiPath = "/api/mobile/unregister-device",
      functionName = "mobile-unregister-device",
      body = bodyJson,
      logTag = "DeviceReg",
    )
  }

  /** Ручной тест push из Settings (тот же контракт, что и Netlify send-chat-push). */
  fun sendChatPushTest(baseUrl: String, managerId: String): Result {
    val body = JSONObject()
      .put("managerId", managerId)
      .put("preview", "Тест push из Settings")
      .put("clientName", "2wix test")
      .put("chatId", "test-chat")
      .put("targetUrl", "https://2wix.ru/whatsapp")
      .put("messageId", "settings-test-" + System.currentTimeMillis())
      .toString()
    return postWithFallback(
      baseUrl = baseUrl,
      apiPath = "/api/send-chat-push",
      functionName = "send-chat-push",
      body = body,
      logTag = "SendChatPush",
    )
  }

  private fun postWithFallback(
    baseUrl: String,
    apiPath: String,
    functionName: String,
    body: String,
    logTag: String,
  ): Result {
    val root = baseUrl.trimEnd('/')
    val primary = "$root$apiPath"
    val first = postRequest(primary, body, logTag)
    if (!first.ok && first.code == 404) {
      val fallback = "$root/.netlify/functions/$functionName"
      Log.w(logTag, "primary 404, retry: $fallback")
      val second = postRequest(fallback, body, logTag)
      return second.copy(
        message = if (second.ok) "${second.message} (fallback)" else second.message
      )
    }
    return first
  }

  private fun postRequest(url: String, body: String, logTag: String): Result {
    val req = Request.Builder()
      .url(url)
      .post(body.toRequestBody(json))
      .build()
    return runCatching {
      http.newCall(req).execute().use { resp ->
        val raw = resp.body?.string().orEmpty()
        val snippet = raw.trim().take(400)
        val code = resp.code
        if (resp.isSuccessful) {
          Log.i(logTag, "POST $url → $code")
          Result(
            ok = true,
            code = code,
            message = "HTTP $code",
            finalUrl = url,
            responseBody = snippet
          )
        } else {
          val msg = "HTTP $code @ $url"
          Log.w(logTag, "$msg body=${snippet.take(120)}")
          Result(
            ok = false,
            code = code,
            message = msg,
            finalUrl = url,
            responseBody = snippet
          )
        }
      }
    }.getOrElse {
      val msg = "${it.javaClass.simpleName}: ${it.message}"
      Log.w(logTag, "POST $url failed: $msg")
      Result(ok = false, code = null, message = msg, finalUrl = url, responseBody = "")
    }
  }
}
