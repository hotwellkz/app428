package ru.twowix.whatsapp_shell.data

import android.util.Log
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

/**
 * Минимальный client-side слой под backend регистрацию токена.
 * Важно: graceful fallback — если endpoint отсутствует/ошибка сети, приложение не падает.
 *
 * Ожидаемый контракт (backend):
 * POST /api/mobile/register-device
 * {
 *   "managerId": "<manager/company id>",
 *   "platform": "android",
 *   "token": "<fcm token>",
 *   "deviceModel": "...",
 *   "appVersion": "0.1.0"
 * }
 */
class DeviceRegistrationClient(
  private val http: OkHttpClient = OkHttpClient(),
) {
  private val json = "application/json; charset=utf-8".toMediaType()

  fun registerDevice(baseUrl: String, managerId: String, token: String) {
    val url = baseUrl.trimEnd('/') + "/api/mobile/register-device"
    val bodyJson = JSONObject()
      .put("managerId", managerId)
      .put("platform", "android")
      .put("token", token)
      .put("deviceModel", android.os.Build.MODEL ?: "")
      .put("appVersion", ru.twowix.whatsapp_shell.BuildConfig.VERSION_NAME)
      .toString()

    val req = Request.Builder()
      .url(url)
      .post(bodyJson.toRequestBody(json))
      .build()

    runCatching {
      http.newCall(req).execute().use { resp ->
        if (!resp.isSuccessful) {
          Log.w("DeviceReg", "register failed: ${resp.code} ${resp.message}")
        } else {
          Log.i("DeviceReg", "register ok")
        }
      }
    }.onFailure {
      Log.w("DeviceReg", "register error: ${it.javaClass.simpleName}: ${it.message}")
    }
  }

  fun unregisterDevice(baseUrl: String, managerId: String, token: String) {
    val url = baseUrl.trimEnd('/') + "/api/mobile/unregister-device"
    val bodyJson = JSONObject()
      .put("managerId", managerId)
      .put("token", token)
      .toString()
    val req = Request.Builder().url(url).post(bodyJson.toRequestBody(json)).build()
    runCatching {
      http.newCall(req).execute().use { resp ->
        if (!resp.isSuccessful) {
          Log.w("DeviceReg", "unregister failed: ${resp.code} ${resp.message}")
        } else {
          Log.i("DeviceReg", "unregister ok")
        }
      }
    }.onFailure {
      Log.w("DeviceReg", "unregister error: ${it.javaClass.simpleName}: ${it.message}")
    }
  }
}

