package ru.twowix.whatsapp_shell.web

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import ru.twowix.whatsapp_shell.BuildConfig

object TwowixWebViewClients {
  private const val HOST = "2wix.ru"

  fun createWebViewClient(
    context: Context,
    openExternal: (Intent) -> Unit,
  ): WebViewClient {
    return object : WebViewClient() {
      override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        val uri = request.url ?: return false
        val host = uri.host.orEmpty()

        // Внутри WebView — только 2wix.ru и поддомены
        val isInternal = host == HOST || host.endsWith(".$HOST")
        if (isInternal) return false

        // Остальное — во внешний браузер
        val intent = Intent(Intent.ACTION_VIEW, uri)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return try {
          openExternal(intent)
          true
        } catch (_: ActivityNotFoundException) {
          true
        }
      }

      override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)
        // Сохраняем cookies/сессию
        CookieManager.getInstance().flush()
      }
    }
  }

  fun createWebChromeClient(
    context: Context,
    fileChooserController: FileChooserController,
    launchFileChooser: (Intent) -> Unit,
    onWebPermissionRequest: (PermissionRequest) -> Unit,
  ): WebChromeClient {
    return object : WebChromeClient() {
      override fun onShowFileChooser(
        webView: WebView?,
        filePathCallback: ValueCallback<Array<Uri>>?,
        fileChooserParams: FileChooserParams?
      ): Boolean {
        val intent = try {
          fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
          }
        } catch (_: Throwable) {
          Intent(Intent.ACTION_GET_CONTENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
          }
        }

        fileChooserController.setCallback(filePathCallback)
        return try {
          launchFileChooser(intent)
          true
        } catch (_: ActivityNotFoundException) {
          fileChooserController.setCallback(null)
          false
        }
      }

      override fun onPermissionRequest(request: PermissionRequest) {
        // Не даём разрешения "вслепую". Делегируем решению Activity/UI (runtime permissions).
        onWebPermissionRequest(request)
      }
    }
  }
}

