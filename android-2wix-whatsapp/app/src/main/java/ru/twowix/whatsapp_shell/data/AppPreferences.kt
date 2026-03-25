package ru.twowix.whatsapp_shell.data

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "prefs")

class AppPreferences(private val context: Context) {
  private object Keys {
    val NOTIFICATIONS_ENABLED = booleanPreferencesKey("notifications_enabled")
  }

  val notificationsEnabled: Flow<Boolean> =
    context.dataStore.data.map { prefs -> prefs[Keys.NOTIFICATIONS_ENABLED] ?: true }

  suspend fun setNotificationsEnabled(value: Boolean) {
    context.dataStore.edit { it[Keys.NOTIFICATIONS_ENABLED] = value }
  }
}

