package ru.twowix.whatsapp_shell.ui.settings

import android.webkit.CookieManager
import android.webkit.WebStorage
import android.webkit.WebView
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import ru.twowix.whatsapp_shell.BuildConfig
import ru.twowix.whatsapp_shell.data.AppPreferences
import ru.twowix.whatsapp_shell.notifications.NotificationHelper

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
  onBack: () -> Unit,
  onRequestPostNotifications: () -> Unit,
) {
  val context = LocalContext.current
  val prefs = remember { AppPreferences(context.applicationContext) }
  val scope = rememberCoroutineScope()

  val notificationsEnabled by prefs.notificationsEnabled.collectAsState(initial = true)

  Scaffold(
    topBar = {
      TopAppBar(
        title = { Text(text = "Настройки") },
        navigationIcon = {
          IconButton(onClick = onBack) {
            Icon(
              imageVector = androidx.compose.material.icons.Icons.Default.ArrowBack,
              contentDescription = "Назад"
            )
          }
        },
      )
    }
  ) { padding ->
    Column(
      modifier = Modifier
        .fillMaxSize()
        .padding(padding)
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
      ) {
        Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
          Text(text = "Уведомления", style = MaterialTheme.typography.titleMedium)
          Text(
            text = "Локальный флаг (FCM будет подключён позже).",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
        Switch(
          checked = notificationsEnabled,
          onCheckedChange = { checked ->
            // Android 13+: попросим permission при включении
            if (checked) onRequestPostNotifications()
            scope.launch { prefs.setNotificationsEnabled(checked) }
          }
        )
      }

      Button(
        onClick = {
          NotificationHelper.showTestMessage(
            context = context,
            title = "2wix: тест",
            text = "Тестовое уведомление"
          )
        },
        modifier = Modifier.fillMaxWidth()
      ) {
        Text(text = "Тестовое уведомление")
      }

      Button(
        onClick = {
          clearWebSession(context)
        },
        modifier = Modifier.fillMaxWidth()
      ) {
        Text(text = "Очистить cache/cookies")
      }

      Button(
        onClick = {
          resetWebSession(context)
        },
        modifier = Modifier.fillMaxWidth()
      ) {
        Text(text = "Logout / reset session")
      }

      Spacer(modifier = Modifier.height(8.dp))

      Text(text = "Build", style = MaterialTheme.typography.titleMedium)
      Text(text = "versionName: ${BuildConfig.VERSION_NAME}", style = MaterialTheme.typography.bodyMedium)
      Text(text = "startUrl: ${BuildConfig.START_URL}", style = MaterialTheme.typography.bodyMedium)
      Text(text = "apiBaseUrl: ${BuildConfig.API_BASE_URL_DEFAULT}", style = MaterialTheme.typography.bodyMedium)
    }
  }
}

private fun clearWebSession(context: android.content.Context) {
  // Cookies
  val cm = CookieManager.getInstance()
  cm.removeAllCookies(null)
  cm.flush()

  // DOM storage
  WebStorage.getInstance().deleteAllData()

  // WebView cache (best-effort)
  runCatching {
    WebView(context).apply {
      clearCache(true)
      clearHistory()
      clearFormData()
    }.destroy()
  }
}

private fun resetWebSession(context: android.content.Context) {
  clearWebSession(context)
}

