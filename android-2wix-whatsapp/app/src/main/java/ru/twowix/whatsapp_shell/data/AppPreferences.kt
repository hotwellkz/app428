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
    val FCM_TOKEN = stringPreferencesKey("fcm_token")
    val API_BASE_URL = stringPreferencesKey("api_base_url")
    val MANAGER_ID = stringPreferencesKey("manager_id")
  }

  val notificationsEnabled: Flow<Boolean> =
    context.dataStore.data.map { prefs -> prefs[Keys.NOTIFICATIONS_ENABLED] ?: true }

  val fcmToken: Flow<String> =
    context.dataStore.data.map { prefs -> prefs[Keys.FCM_TOKEN].orEmpty() }

  val apiBaseUrl: Flow<String> =
    context.dataStore.data.map { prefs -> prefs[Keys.API_BASE_URL] ?: ru.twowix.whatsapp_shell.BuildConfig.API_BASE_URL_DEFAULT }

  val managerId: Flow<String> =
    context.dataStore.data.map { prefs -> prefs[Keys.MANAGER_ID].orEmpty() }

  suspend fun setNotificationsEnabled(value: Boolean) {
    context.dataStore.edit { it[Keys.NOTIFICATIONS_ENABLED] = value }
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
}

