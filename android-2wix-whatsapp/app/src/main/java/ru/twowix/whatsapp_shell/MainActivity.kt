package ru.twowix.whatsapp_shell

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.LaunchedEffect
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import ru.twowix.whatsapp_shell.notifications.NotificationHelper
import ru.twowix.whatsapp_shell.ui.App
import ru.twowix.whatsapp_shell.util.IntentRouter
import ru.twowix.whatsapp_shell.web.FileChooserController

class MainActivity : ComponentActivity() {

  private val deepLinkTarget = MutableStateFlow(IntentRouter.routeFromIntent(intent))
  private val fileChooserController = FileChooserController()

  private val requestNotificationsPermission = registerForActivityResult(
    ActivityResultContracts.RequestPermission()
  ) { /* UI живёт в Settings; тут просто получаем результат */ }

  private val fileChooserLauncher = registerForActivityResult(
    ActivityResultContracts.StartActivityForResult()
  ) { result ->
    fileChooserController.onActivityResult(result.resultCode, result.data)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // Канал уведомлений нужен уже сейчас (для локального "тестового уведомления" и дальнейшего FCM).
    NotificationHelper.ensureChannels(this)

    setContent {
      MaterialTheme {
        App(
          deepLinkTargetFlow = deepLinkTarget.asStateFlow(),
          fileChooserController = fileChooserController,
          launchFileChooser = { intent -> fileChooserLauncher.launch(intent) },
          onRequestPostNotifications = {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
              requestNotificationsPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
          }
        )
      }

      // На старте можно обработать intent ещё раз (на случай если он поменялся до setContent)
      LaunchedEffect(Unit) {
        deepLinkTarget.value = IntentRouter.routeFromIntent(intent)
      }
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    deepLinkTarget.value = IntentRouter.routeFromIntent(intent)
  }
}

