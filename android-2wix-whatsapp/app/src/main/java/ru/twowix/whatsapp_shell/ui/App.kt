package ru.twowix.whatsapp_shell.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import kotlinx.coroutines.flow.StateFlow
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
  val nav = rememberNavController()
  val target by deepLinkTargetFlow.collectAsState()

  // При приходе нового intent (push/deep-link) — возвращаемся на web и открываем нужный url.
  LaunchedEffect(target) {
    if (nav.currentDestination?.route != Routes.WEB) {
      nav.navigate(Routes.WEB) { popUpTo(0) }
    }
  }

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

