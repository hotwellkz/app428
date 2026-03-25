package ru.twowix.whatsapp_shell.push

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Заготовка под FCM (полный end-to-end позже).
 * Сейчас: логируем токен/сообщения, чтобы проект уже был готов к подключению push.
 */
class TwowixFirebaseMessagingService : FirebaseMessagingService() {
  override fun onNewToken(token: String) {
    Log.i("TwowixFCM", "New token: $token")
  }

  override fun onMessageReceived(message: RemoteMessage) {
    Log.i("TwowixFCM", "Message received: data=${message.data} notification=${message.notification}")
  }
}

