package ru.twowix.whatsapp_shell.data

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "prefs")

class AppPreferences(private val context: Context) {
  private object Keys {
    val NOTIFICATIONS_ENABLED = booleanPreferencesKey("notifications_enabled")
    val NOTIF_PERMISSION_REQUESTED = booleanPreferencesKey("notif_permission_requested")
    val FCM_TOKEN = stringPreferencesKey("fcm_token")
    val API_BASE_URL = stringPreferencesKey("api_base_url")
    val MANAGER_ID = stringPreferencesKey("manager_id")
    val LAST_REG_STATUS = stringPreferencesKey("last_reg_status")
    val LAST_REG_RESPONSE = stringPreferencesKey("last_reg_response")
    val LAST_REG_URL = stringPreferencesKey("last_reg_url")
    val LAST_HTTP_CODE = stringPreferencesKey("last_http_code")
    val LAST_PUSH_AT = stringPreferencesKey("last_push_at")
    val LAST_CHAT_SYNC_AT = stringPreferencesKey("last_chat_sync_at")
    val LAST_CHAT_SYNC_SOURCE = stringPreferencesKey("last_chat_sync_source")
    val LAST_PUSH_CACHE_APPLY = stringPreferencesKey("last_push_cache_apply")
    val LAST_THREAD_SYNC_AT = stringPreferencesKey("last_thread_sync_at")
    val LAST_SEND_ERROR = stringPreferencesKey("last_send_error")
    val LAST_DEDUPE_REASON = stringPreferencesKey("last_dedupe_reason")
    val ACTIVE_CHAT_ID = stringPreferencesKey("active_chat_id")
  }

  val notificationsEnabled: Flow<Boolean> =
    context.dataStore.data.map { prefs -> prefs[Keys.NOTIFICATIONS_ENABLED] ?: true }

  val fcmToken: Flow<String> =
    context.dataStore.data.map { prefs -> prefs[Keys.FCM_TOKEN].orEmpty() }

  val notifPermissionRequested: Flow<Boolean> =
    context.dataStore.data.map { prefs -> prefs[Keys.NOTIF_PERMISSION_REQUESTED] ?: false }

  val apiBaseUrl: Flow<String> =
    context.dataStore.data.map { prefs -> prefs[Keys.API_BASE_URL] ?: ru.twowix.whatsapp_shell.BuildConfig.API_BASE_URL_DEFAULT }

  val managerId: Flow<String> =
    context.dataStore.data.map { prefs -> prefs[Keys.MANAGER_ID].orEmpty() }

  val lastRegistrationStatus: Flow<String> =
    context.dataStore.data.map { prefs -> prefs[Keys.LAST_REG_STATUS].orEmpty() }

  val lastRegistrationResponse: Flow<String> =
    context.dataStore.data.map { prefs -> prefs[Keys.LAST_REG_RESPONSE].orEmpty() }

  val lastRegistrationUrl: Flow<String> =
    context.dataStore.data.map { prefs -> prefs[Keys.LAST_REG_URL].orEmpty() }

  val lastHttpCode: Flow<String> =
    context.dataStore.data.map { prefs -> prefs[Keys.LAST_HTTP_CODE].orEmpty() }

  val lastPushAt: Flow<String> =
    context.dataStore.data.map { prefs -> prefs[Keys.LAST_PUSH_AT].orEmpty() }

  val lastChatSyncAt: Flow<String> =
    context.dataStore.data.map { prefs -> prefs[Keys.LAST_CHAT_SYNC_AT].orEmpty() }

  val lastChatSyncSource: Flow<String> =
    context.dataStore.data.map { prefs -> prefs[Keys.LAST_CHAT_SYNC_SOURCE].orEmpty() }

  val lastPushCacheApply: Flow<String> =
    context.dataStore.data.map { prefs -> prefs[Keys.LAST_PUSH_CACHE_APPLY].orEmpty() }

  val lastThreadSyncAt: Flow<String> =
    context.dataStore.data.map { prefs -> prefs[Keys.LAST_THREAD_SYNC_AT].orEmpty() }

  val lastSendError: Flow<String> =
    context.dataStore.data.map { prefs -> prefs[Keys.LAST_SEND_ERROR].orEmpty() }

  val lastDedupeReason: Flow<String> =
    context.dataStore.data.map { prefs -> prefs[Keys.LAST_DEDUPE_REASON].orEmpty() }

  val activeChatId: Flow<String> =
    context.dataStore.data.map { prefs -> prefs[Keys.ACTIVE_CHAT_ID].orEmpty() }

  suspend fun setNotificationsEnabled(value: Boolean) {
    context.dataStore.edit { it[Keys.NOTIFICATIONS_ENABLED] = value }
  }

  suspend fun setNotifPermissionRequested(value: Boolean) {
    context.dataStore.edit { it[Keys.NOTIF_PERMISSION_REQUESTED] = value }
  }

  suspend fun setFcmToken(value: String) {
    context.dataStore.edit { it[Keys.FCM_TOKEN] = value }
  }

  suspend fun setApiBaseUrl(value: String) {
    context.dataStore.edit { it[Keys.API_BASE_URL] = value.trim().trimEnd('/') }
  }

  suspend fun setManagerId(value: String) {
    context.dataStore.edit { it[Keys.MANAGER_ID] = value.trim() }
  }

  suspend fun setLastRegistration(
    status: String,
    response: String,
    url: String = "",
    httpCode: String = "",
  ) {
    context.dataStore.edit {
      it[Keys.LAST_REG_STATUS] = status.trim()
      it[Keys.LAST_REG_RESPONSE] = response.trim().take(500)
      it[Keys.LAST_REG_URL] = url.trim().take(300)
      it[Keys.LAST_HTTP_CODE] = httpCode.trim().take(16)
    }
  }

  suspend fun setLastPushAt(isoDateTime: String) {
    context.dataStore.edit { it[Keys.LAST_PUSH_AT] = isoDateTime.trim() }
  }

  suspend fun setLastChatSync(isoDateTime: String, source: String) {
    context.dataStore.edit {
      it[Keys.LAST_CHAT_SYNC_AT] = isoDateTime.trim()
      it[Keys.LAST_CHAT_SYNC_SOURCE] = source.trim()
    }
  }

  suspend fun setLastPushCacheApply(value: String) {
    context.dataStore.edit { it[Keys.LAST_PUSH_CACHE_APPLY] = value.trim().take(400) }
  }

  suspend fun setLastThreadSyncAt(isoDateTime: String) {
    context.dataStore.edit { it[Keys.LAST_THREAD_SYNC_AT] = isoDateTime.trim() }
  }

  suspend fun setLastSendError(value: String) {
    context.dataStore.edit { it[Keys.LAST_SEND_ERROR] = value.trim().take(500) }
  }

  suspend fun setLastDedupeReason(value: String) {
    context.dataStore.edit { it[Keys.LAST_DEDUPE_REASON] = value.trim().take(500) }
  }

  suspend fun setActiveChatId(chatId: String) {
    context.dataStore.edit { it[Keys.ACTIVE_CHAT_ID] = chatId.trim() }
  }
}

