package ru.twowix.whatsapp_shell.web

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.webkit.ValueCallback

/**
 * Контроллер для file upload в WebView (WebChromeClient → ActivityResult).
 * Хранит callback и аккуратно отдаёт результат.
 */
class FileChooserController {
  private var filePathCallback: ValueCallback<Array<Uri>>? = null

  fun setCallback(cb: ValueCallback<Array<Uri>>?) {
    // Если новый chooser пришёл, а старый ещё не закрыт — закрываем старый "пустым" ответом.
    filePathCallback?.onReceiveValue(null)
    filePathCallback = cb
  }

  fun onActivityResult(resultCode: Int, data: Intent?) {
    val cb = filePathCallback ?: return
    filePathCallback = null

    if (resultCode != Activity.RESULT_OK) {
      cb.onReceiveValue(null)
      return
    }

    val result = extractUris(data)
    cb.onReceiveValue(result)
  }

  private fun extractUris(data: Intent?): Array<Uri>? {
    if (data == null) return null
    val clip = data.clipData
    if (clip != null && clip.itemCount > 0) {
      return Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
    }
    val single = data.data
    return if (single != null) arrayOf(single) else null
  }
}

