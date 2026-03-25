package ru.twowix.whatsapp_shell.ui

import android.os.Build
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import kotlinx.coroutines.flow.StateFlow
import ru.twowix.whatsapp_shell.data.AppPreferences
import ru.twowix.whatsapp_shell.data.DeviceRegistrationClient
import ru.twowix.whatsapp_shell.notifications.NotificationHelper
import ru.twowix.whatsapp_shell.ui.settings.SettingsScreen
import ru.twowix.whatsapp_shell.ui.webview.WebViewScreen
import ru.twowix.whatsapp_shell.util.WebTarget
import ru.twowix.whatsapp_shell.web.FileChooserController

private object Routes {
  const val WEB = "web"
  const val SETTINGS = "settings"
}

@Composable
fun App(
  deepLinkTargetFlow: StateFlow<WebTarget>,
  fileChooserController: FileChooserController,
  launchFileChooser: (android.content.Intent) -> Unit,
  onRequestPostNotifications: () -> Unit,
) {
  val context = LocalContext.current
  val nav = rememberNavController()
  val target by deepLinkTargetFlow.collectAsState()
  val prefs = AppPreferences(context.applicationContext)
  val deviceReg = DeviceRegistrationClient()

  // При приходе нового intent (push/deep-link) — возвращаемся на web и открываем нужный url.
  LaunchedEffect(target) {
    if (nav.currentDestination?.route != Routes.WEB) {
      nav.navigate(Routes.WEB) { popUpTo(0) }
    }
  }

  LaunchedEffect(Unit) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val asked = prefs.notifPermissionRequested.first()
      val granted = NotificationHelper.canPostNotifications(context)
      if (!asked && !granted) {
        onRequestPostNotifications()
        prefs.setNotifPermissionRequested(true)
      }
    }
  }

  LaunchedEffect(Unit) {
    withContext(Dispatchers.IO) {
      val token = prefs.fcmToken.first().trim()
      val managerId = prefs.managerId.first().trim()
      val baseUrl = prefs.apiBaseUrl.first()
      if (token.isNotBlank() && managerId.isNotBlank()) {
        val reg = deviceReg.registerDevice(baseUrl, managerId, token)
        val detail = buildString {
          append(reg.message)
          if (reg.responseBody.isNotBlank()) append(" | ").append(reg.responseBody.take(200))
        }
        prefs.setLastRegistration(
          status = if (reg.ok) "success" else "error",
          response = detail,
          url = reg.finalUrl,
          httpCode = reg.code?.toString().orEmpty()
        )
      }
    }
  }

  Box(
    modifier = Modifier
      .fillMaxSize()
      .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top))
  ) {
    NavHost(navController = nav, startDestination = Routes.WEB) {
      composable(Routes.WEB) {
        WebViewScreen(
          initialTarget = target,
          onOpenSettings = { nav.navigate(Routes.SETTINGS) },
          fileChooserController = fileChooserController,
          launchFileChooser = launchFileChooser,
        )
      }
      composable(Routes.SETTINGS) {
        SettingsScreen(
          onBack = { nav.popBackStack() },
          onRequestPostNotifications = onRequestPostNotifications,
        )
      }
    }
  }
}

