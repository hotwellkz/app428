package ru.twowix.whatsapp_shell.ui

import android.content.Intent
import android.os.Build
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import ru.twowix.whatsapp_shell.data.AppPreferences
import ru.twowix.whatsapp_shell.data.DeviceRegistrationClient
import ru.twowix.whatsapp_shell.data.chat.ChatRepository
import ru.twowix.whatsapp_shell.notifications.NotificationHelper
import ru.twowix.whatsapp_shell.sync.ChatSyncScheduler
import ru.twowix.whatsapp_shell.ui.chats.ChatListScreen
import ru.twowix.whatsapp_shell.ui.chats.ChatThreadScreen
import ru.twowix.whatsapp_shell.ui.settings.SettingsScreen
import ru.twowix.whatsapp_shell.ui.webview.WebViewScreen
import ru.twowix.whatsapp_shell.util.IntentRouter
import ru.twowix.whatsapp_shell.util.WebTarget
import ru.twowix.whatsapp_shell.web.FileChooserController

private object Routes {
  const val CHATS = "chats"
  const val THREAD = "thread/{chatId}"
  const val SETTINGS = "settings"
  const val WEB = "web"

  fun thread(chatId: String): String = "thread/$chatId"
}

@Composable
fun App(
  deepLinkTargetFlow: StateFlow<WebTarget>,
  fileChooserController: FileChooserController,
  launchFileChooser: (Intent) -> Unit,
  onRequestPostNotifications: () -> Unit,
) {
  val context = LocalContext.current
  val nav = rememberNavController()
  val target by deepLinkTargetFlow.collectAsState()
  val prefs = remember { AppPreferences(context.applicationContext) }
  val deviceReg = remember { DeviceRegistrationClient() }
  val chatRepo = remember { ChatRepository.get(context.applicationContext) }
  var webTarget by remember { mutableStateOf(target) }

  LaunchedEffect(Unit) {
    ChatSyncScheduler.ensurePeriodic(context.applicationContext)
  }

  LaunchedEffect(target) {
    webTarget = target
    if (target.source != "launcher") {
      val chatId = IntentRouter.extractChatIdFromUrl(target.url)
      if (!chatId.isNullOrBlank()) {
        nav.navigate(Routes.thread(chatId))
      } else {
        nav.navigate(Routes.WEB)
      }
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
    NavHost(navController = nav, startDestination = Routes.CHATS) {
      composable(Routes.CHATS) {
        ChatListScreen(
          onOpenSettings = { nav.navigate(Routes.SETTINGS) },
          onOpenChat = { chatId -> nav.navigate(Routes.thread(chatId)) }
        )
      }
      composable(Routes.THREAD) { backStack ->
        val chatId = backStack.arguments?.getString("chatId").orEmpty()
        if (chatId.isNotBlank()) {
          ChatThreadScreen(
            chatId = chatId,
            repository = chatRepo,
            onBack = { nav.popBackStack() }
          )
        }
      }
      composable(Routes.SETTINGS) {
        SettingsScreen(
          onBack = { nav.popBackStack() },
          onRequestPostNotifications = onRequestPostNotifications,
        )
      }
      composable(Routes.WEB) {
        WebViewScreen(
          initialTarget = webTarget,
          onOpenSettings = { nav.navigate(Routes.SETTINGS) },
          fileChooserController = fileChooserController,
          launchFileChooser = launchFileChooser,
        )
      }
    }
  }
}
