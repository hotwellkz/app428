package ru.twowix.whatsapp_shell.ui.settings

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.provider.Settings
import android.webkit.CookieManager
import android.webkit.WebStorage
import android.webkit.WebView
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.twowix.whatsapp_shell.BuildConfig
import ru.twowix.whatsapp_shell.data.AppPreferences
import ru.twowix.whatsapp_shell.data.DeviceRegistrationClient
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
  val fcmToken by prefs.fcmToken.collectAsState(initial = "")
  val apiBaseUrl by prefs.apiBaseUrl.collectAsState(initial = BuildConfig.API_BASE_URL_DEFAULT)
  val managerId by prefs.managerId.collectAsState(initial = "")
  val lastRegStatus by prefs.lastRegistrationStatus.collectAsState(initial = "")
  val lastRegResponse by prefs.lastRegistrationResponse.collectAsState(initial = "")
  val lastRegUrl by prefs.lastRegistrationUrl.collectAsState(initial = "")
  val lastHttpCode by prefs.lastHttpCode.collectAsState(initial = "")
  val lastPushAt by prefs.lastPushAt.collectAsState(initial = "")
  var apiDraft by remember(apiBaseUrl) { mutableStateOf(apiBaseUrl) }
  var managerDraft by remember(managerId) { mutableStateOf(managerId) }
  val deviceReg = remember { DeviceRegistrationClient() }
  var actionStatus by remember { mutableStateOf("") }

  val notifPermGranted = NotificationHelper.canPostNotifications(context)
  val firebaseDiag = remember { firebaseConfigDiagnostics(context) }

  Scaffold(
    topBar = {
      TopAppBar(
        title = { Text(text = "Настройки") },
        navigationIcon = {
          IconButton(onClick = onBack) {
            Icon(
              imageVector = Icons.AutoMirrored.Filled.ArrowBack,
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
        .padding(16.dp)
        .verticalScroll(rememberScrollState()),
      verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
      Text(
        text = "Firebase: ${firebaseDiag.summary}",
        style = MaterialTheme.typography.bodyMedium,
        color = if (firebaseDiag.isOk) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
      )
      if (!firebaseDiag.isOk) {
        Text(
          text = "Положите google-services.json из Firebase Console в android-2wix-whatsapp/app/ (package ru.twowix.whatsapp_shell), пересоберите APK.",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }

      Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
      ) {
        Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
          Text(text = "Уведомления", style = MaterialTheme.typography.titleMedium)
          Text(
            text = "Показывать уведомления о сообщениях (FCM).",
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

      Text(
        text = "Разрешение уведомлений: " + if (notifPermGranted) "включено" else "выключено",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )
      if (!notifPermGranted) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
          Button(onClick = onRequestPostNotifications) {
            Text(text = "Разрешить уведомления")
          }
          Button(
            onClick = {
              val i = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
              }
              context.startActivity(i)
            }
          ) {
            Text(text = "Открыть настройки")
          }
        }
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

      // FCM token
      Text(text = "FCM token", style = MaterialTheme.typography.titleMedium)
      Text(
        text = if (fcmToken.isBlank()) "— (ещё не получен)" else (fcmToken.take(32) + "…"),
        style = MaterialTheme.typography.bodyMedium
      )
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Button(
          onClick = {
            val cm = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as ClipboardManager
            cm.setPrimaryClip(ClipData.newPlainText("FCM token", fcmToken))
          },
          enabled = fcmToken.isNotBlank()
        ) {
          Text(text = "Copy")
        }
        Button(
          onClick = {
            FirebaseMessaging.getInstance().token
              .addOnSuccessListener { token ->
                scope.launch {
                  prefs.setFcmToken(token)
                  if (managerId.isNotBlank()) {
                    val reg = withContext(Dispatchers.IO) {
                      deviceReg.registerDevice(apiBaseUrl, managerId, token)
                    }
                    prefs.setLastRegistration(
                      status = if (reg.ok) "success" else "error",
                      response = registrationDetail(reg),
                      url = reg.finalUrl,
                      httpCode = reg.code?.toString().orEmpty()
                    )
                    actionStatus = "${reg.message} → ${reg.finalUrl}"
                  } else {
                    actionStatus = "token OK (${token.length} chars)"
                  }
                }
              }
              .addOnFailureListener { e ->
                actionStatus = "FCM token error: ${e.javaClass.simpleName}: ${e.message}"
              }
          }
        ) {
          Text(text = "Обновить token")
        }
      }

      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Button(
          onClick = {
            if (managerId.isBlank() || fcmToken.isBlank()) {
              actionStatus = "Нужны managerId и FCM token"
              return@Button
            }
            scope.launch {
              val reg = withContext(Dispatchers.IO) {
                deviceReg.registerDevice(apiBaseUrl, managerId, fcmToken)
              }
              prefs.setLastRegistration(
                status = if (reg.ok) "success" else "error",
                response = registrationDetail(reg),
                url = reg.finalUrl,
                httpCode = reg.code?.toString().orEmpty()
              )
              actionStatus = "${reg.message} → ${reg.finalUrl}"
            }
          },
          enabled = managerId.isNotBlank() && fcmToken.isNotBlank()
        ) {
          Text(text = "Проверить регистрацию")
        }
        Button(
          onClick = {
            if (managerId.isBlank() || fcmToken.isBlank()) {
              actionStatus = "Нужны managerId и FCM token"
              return@Button
            }
            scope.launch {
              val reg = withContext(Dispatchers.IO) {
                deviceReg.unregisterDevice(apiBaseUrl, managerId, fcmToken)
              }
              prefs.setLastRegistration(
                status = if (reg.ok) "success" else "error",
                response = registrationDetail(reg),
                url = reg.finalUrl,
                httpCode = reg.code?.toString().orEmpty()
              )
              actionStatus = "${reg.message} → ${reg.finalUrl}"
            }
          },
          enabled = managerId.isNotBlank() && fcmToken.isNotBlank()
        ) {
          Text(text = "Unregister")
        }
      }

      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Button(
          onClick = {
            if (managerId.isBlank()) {
              actionStatus = "Нужен managerId"
              return@Button
            }
            scope.launch {
              val r = withContext(Dispatchers.IO) {
                deviceReg.sendChatPushTest(apiBaseUrl, managerId)
              }
              actionStatus = buildString {
                append(if (r.ok) "test push OK" else "test push FAIL")
                append(" HTTP ").append(r.code ?: "—")
                append(" ").append(r.finalUrl)
                if (r.responseBody.isNotBlank()) append(" | ").append(r.responseBody.take(180))
              }
            }
          },
          enabled = managerId.isNotBlank()
        ) {
          Text(text = "Отправить тест push")
        }
      }

      OutlinedTextField(
        value = apiDraft,
        onValueChange = { apiDraft = it },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        label = { Text("API base URL (device register)") }
      )
      Button(
        onClick = { scope.launch { prefs.setApiBaseUrl(apiDraft) } },
        modifier = Modifier.fillMaxWidth()
      ) {
        Text(text = "Сохранить API base URL")
      }

      OutlinedTextField(
        value = managerDraft,
        onValueChange = { managerDraft = it },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        label = { Text("managerId (для push регистрации)") }
      )
      Button(
        onClick = {
          scope.launch {
            prefs.setManagerId(managerDraft)
            val m = managerDraft.trim()
            val tok = prefs.fcmToken.first()
            if (m.isNotBlank() && tok.isNotBlank()) {
              val reg = withContext(Dispatchers.IO) {
                deviceReg.registerDevice(apiBaseUrl, m, tok)
              }
              prefs.setLastRegistration(
                status = if (reg.ok) "success" else "error",
                response = registrationDetail(reg),
                url = reg.finalUrl,
                httpCode = reg.code?.toString().orEmpty()
              )
              actionStatus =
                if (reg.ok) "managerId сохранён, register-device OK" else "managerId сохранён, register: ${reg.message}"
            } else {
              actionStatus = "managerId сохранён (register после token)"
            }
          }
        },
        modifier = Modifier.fillMaxWidth()
      ) {
        Text(text = "Сохранить managerId")
      }

      Button(
        onClick = {
          scope.launch {
            if (managerId.isNotBlank() && fcmToken.isNotBlank()) {
              withContext(Dispatchers.IO) {
                deviceReg.unregisterDevice(apiBaseUrl, managerId, fcmToken)
              }
            }
            clearWebSession(context)
            actionStatus = "Сессия очищена"
          }
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
      Spacer(modifier = Modifier.height(8.dp))
      Text(text = "Push diagnostics", style = MaterialTheme.typography.titleMedium)
      Text(text = "firebase config: ${firebaseDiag.summary}", style = MaterialTheme.typography.bodyMedium)
      Text(text = "google_app_id: ${firebaseDiag.googleAppIdPreview}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      Text(text = "permission: ${if (notifPermGranted) "granted" else "denied"}", style = MaterialTheme.typography.bodyMedium)
      Text(text = "api base (saved): $apiBaseUrl", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      Text(text = "token: ${if (fcmToken.isBlank()) "missing" else "ok"}", style = MaterialTheme.typography.bodyMedium)
      Text(text = "managerId (saved): ${if (managerId.isBlank()) "missing" else managerId}", style = MaterialTheme.typography.bodyMedium)
      Text(text = "register-device: ${if (lastRegStatus.isBlank()) "n/a" else lastRegStatus}", style = MaterialTheme.typography.bodyMedium)
      if (lastHttpCode.isNotBlank()) {
        Text(text = "last HTTP: $lastHttpCode", style = MaterialTheme.typography.bodySmall)
      }
      if (lastRegUrl.isNotBlank()) {
        Text(text = "last endpoint: $lastRegUrl", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
      if (lastRegResponse.isNotBlank()) {
        Text(text = "register response: $lastRegResponse", style = MaterialTheme.typography.bodySmall)
      }
      Text(text = "last push received: ${if (lastPushAt.isBlank()) "n/a" else lastPushAt}", style = MaterialTheme.typography.bodyMedium)
      if (actionStatus.isNotBlank()) {
        Text(text = "last action: $actionStatus", style = MaterialTheme.typography.bodyMedium)
      }
      Spacer(modifier = Modifier.height(24.dp))
    }
  }
}

private fun registrationDetail(reg: DeviceRegistrationClient.Result): String =
  buildString {
    append(reg.message)
    if (reg.responseBody.isNotBlank()) append(" | ").append(reg.responseBody.take(200))
  }

private data class FirebaseConfigDiagnostics(
  val summary: String,
  val googleAppIdPreview: String,
  val isOk: Boolean,
)

private fun firebaseConfigDiagnostics(context: android.content.Context): FirebaseConfigDiagnostics {
  val id = context.resources.getIdentifier("google_app_id", "string", context.packageName)
  if (id == 0) {
    return FirebaseConfigDiagnostics(
      summary = "missing (нет google_app_id — сборка без google-services.json)",
      googleAppIdPreview = "—",
      isOk = false
    )
  }
  val appId = runCatching { context.getString(id) }.getOrDefault("")
  if (appId.isBlank()) {
    return FirebaseConfigDiagnostics("empty google_app_id", "—", isOk = false)
  }
  val bad =
    appId.contains("000000000000") ||
      appId.contains("placeholder", ignoreCase = true) ||
      appId.contains("PLACEHOLDER", ignoreCase = true)
  if (bad) {
    return FirebaseConfigDiagnostics(
      summary = "invalid / placeholder (замените google-services.json)",
      googleAppIdPreview = appId.take(48) + if (appId.length > 48) "…" else "",
      isOk = false
    )
  }
  return FirebaseConfigDiagnostics(
    summary = "OK (реальный Firebase config)",
    googleAppIdPreview = appId.take(48) + if (appId.length > 48) "…" else "",
    isOk = true
  )
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

