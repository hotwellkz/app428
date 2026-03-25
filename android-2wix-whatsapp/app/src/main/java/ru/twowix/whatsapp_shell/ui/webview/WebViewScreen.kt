package ru.twowix.whatsapp_shell.ui.webview

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.http.SslError
import android.os.Build
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import kotlinx.coroutines.launch
import ru.twowix.whatsapp_shell.BuildConfig
import ru.twowix.whatsapp_shell.R
import ru.twowix.whatsapp_shell.util.NetworkMonitor
import ru.twowix.whatsapp_shell.util.WebTarget
import ru.twowix.whatsapp_shell.web.FileChooserController
import ru.twowix.whatsapp_shell.web.TwowixWebViewClients

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebViewScreen(
  initialTarget: WebTarget,
  onOpenSettings: () -> Unit,
  fileChooserController: FileChooserController,
  launchFileChooser: (Intent) -> Unit,
) {
  val context = LocalContext.current
  val lifecycleOwner = LocalLifecycleOwner.current
  val scope = rememberCoroutineScope()
  val networkMonitor = remember { NetworkMonitor(context.applicationContext) }

  var isOnline by remember { mutableStateOf(true) }
  var isLoading by remember { mutableStateOf(true) }
  var loadError by remember { mutableStateOf<String?>(null) }

  var webViewRef: WebView? by remember { mutableStateOf(null) }

  // Runtime permissions for WebRTC capture from within WebView
  var pendingWebPermissionRequest: PermissionRequest? by remember { mutableStateOf(null) }
  val requestCapturePerms = rememberLauncherForActivityResult(
    ActivityResultContracts.RequestMultiplePermissions()
  ) { grants ->
    val req = pendingWebPermissionRequest
    pendingWebPermissionRequest = null
    if (req == null) return@rememberLauncherForActivityResult

    val requested = req.resources.toSet()
    val toGrant = mutableListOf<String>()
    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE in requested && grants[Manifest.permission.CAMERA] == true) {
      toGrant += PermissionRequest.RESOURCE_VIDEO_CAPTURE
    }
    if (PermissionRequest.RESOURCE_AUDIO_CAPTURE in requested && grants[Manifest.permission.RECORD_AUDIO] == true) {
      toGrant += PermissionRequest.RESOURCE_AUDIO_CAPTURE
    }
    if (toGrant.isNotEmpty()) req.grant(toGrant.toTypedArray()) else req.deny()
  }

  DisposableEffect(Unit) {
    networkMonitor.start()
    val job = scope.launch {
      networkMonitor.isOnline.collect { isOnline = it }
    }
    onDispose {
      job.cancel()
      networkMonitor.stop()
    }
  }

  DisposableEffect(lifecycleOwner) {
    val observer = LifecycleEventObserver { _, event ->
      if (event == Lifecycle.Event.ON_RESUME) {
        webViewRef?.evaluateJavascript(
          "(function(){try{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));}catch(e){}})();",
          null
        )
      }
    }
    lifecycleOwner.lifecycle.addObserver(observer)
    onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
  }

  // Deep-link/open-chat: любой новый initialTarget → загрузка в WebView.
  LaunchedEffect(initialTarget) {
    webViewRef?.loadUrl(initialTarget.url)
  }

  BackHandler(enabled = webViewRef?.canGoBack() == true) {
    webViewRef?.goBack()
  }

  Box(modifier = Modifier.fillMaxSize()) {
    when {
      !isOnline -> OfflineView(onRetry = { webViewRef?.reload() })
      loadError != null -> ErrorView(message = loadError!!, onRetry = {
        loadError = null
        webViewRef?.reload()
      })
      else -> {
        AndroidView(
          modifier = Modifier.fillMaxSize(),
          factory = { ctx ->
            WebView(ctx).apply {
              layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
              )

              setupWebViewDefaults()

              val openExternal: (Intent) -> Unit = { intent ->
                ContextCompat.startActivity(ctx, intent, null)
              }

              webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                  return TwowixWebViewClients.createWebViewClient(ctx, openExternal)
                    .shouldOverrideUrlLoading(view, request)
                }

                override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                  isLoading = true
                  loadError = null
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                  isLoading = false
                  CookieManager.getInstance().flush()
                  view?.evaluateJavascript(
                    "(function(){try{document.documentElement.style.setProperty('--android-safe-top','env(safe-area-inset-top,0px)');document.documentElement.style.setProperty('--android-safe-bottom','env(safe-area-inset-bottom,0px)');}catch(e){}})();",
                    null
                  )
                }

                override fun onReceivedError(
                  view: WebView?,
                  request: WebResourceRequest?,
                  error: WebResourceError?
                ) {
                  if (request?.isForMainFrame != true) return
                  isLoading = false
                  loadError = error?.description?.toString() ?: "Ошибка загрузки страницы"
                }

                override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
                  // Не ослабляем безопасность: SSL ошибки не игнорируем.
                  handler?.cancel()
                  isLoading = false
                  loadError = "Ошибка SSL. Проверьте дату/время и подключение."
                }
              }

              val chrome = TwowixWebViewClients.createWebChromeClient(
                context = ctx,
                fileChooserController = fileChooserController,
                launchFileChooser = launchFileChooser,
                onWebPermissionRequest = { req ->
                  // Если разрешения уже есть — грантим сразу, иначе попросим runtime permission.
                  val immediate = handleWebPermissionRequest(ctx, req)
                  if (!immediate) {
                    pendingWebPermissionRequest?.deny()
                    pendingWebPermissionRequest = req
                    requestCapturePerms.launch(
                      arrayOf(
                        Manifest.permission.CAMERA,
                        Manifest.permission.RECORD_AUDIO
                      )
                    )
                  }
                },
              )
              webChromeClient = chrome

              webViewRef = this
              loadUrl(initialTarget.url.ifBlank { BuildConfig.START_URL })
            }
          },
          update = { /* всё управление идёт через ссылки/LaunchedEffect */ },
          onRelease = {
            webViewRef = null
          }
        )
      }
    }

    // Splash/loading overlay
    if (isLoading) {
      Box(
        modifier = Modifier
          .fillMaxSize()
          .background(MaterialTheme.colorScheme.background.copy(alpha = 0.55f)),
        contentAlignment = Alignment.Center
      ) {
        CircularProgressIndicator()
      }
    }

    // Минимальная кнопка настроек, не вмешивается в layout WebView
    IconButton(
      onClick = onOpenSettings,
      modifier = Modifier
        .align(Alignment.TopEnd)
        .padding(8.dp)
        .size(44.dp)
        .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.88f), shape = MaterialTheme.shapes.small)
    ) {
      Icon(
        imageVector = Icons.Filled.Settings,
        contentDescription = "Настройки",
      )
    }
  }
}

@SuppressLint("SetJavaScriptEnabled")
private fun WebView.setupWebViewDefaults() {
  val s = settings
  s.javaScriptEnabled = true
  s.domStorageEnabled = true
  s.databaseEnabled = true
  s.allowFileAccess = false
  s.allowContentAccess = true
  s.useWideViewPort = true
  s.loadWithOverviewMode = true
  s.cacheMode = WebSettings.LOAD_DEFAULT
  s.mediaPlaybackRequiresUserGesture = true
  s.builtInZoomControls = false
  s.displayZoomControls = false
  s.setSupportZoom(false)

  // Безопасно: mixed content не включаем, пока не понадобится.
  s.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW

  // Cookies/session persistence
  val cm = CookieManager.getInstance()
  cm.setAcceptCookie(true)
  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
    cm.setAcceptThirdPartyCookies(this, true)
  }

  // Service Worker (если поддерживается) — помогает, но не ломаем безопасность.
  if (WebViewFeature.isFeatureSupported(WebViewFeature.START_SAFE_BROWSING)) {
    WebViewCompat.startSafeBrowsing(context) {}
  }
}

/**
 * Возвращает true, если запрос обработан сразу (grant/deny).
 * Возвращает false, если требуется запросить runtime permission.
 */
private fun handleWebPermissionRequest(context: Context, request: PermissionRequest): Boolean {
  // Сайт может просить микрофон/камеру для записи/вложений.
  // Грантим только то, на что у приложения есть runtime permission.
  val requested = request.resources.toSet()
  val toGrant = mutableListOf<String>()

  fun hasPerm(p: String): Boolean =
    ContextCompat.checkSelfPermission(context, p) == android.content.pm.PackageManager.PERMISSION_GRANTED

  val needsCamera = PermissionRequest.RESOURCE_VIDEO_CAPTURE in requested
  val needsMic = PermissionRequest.RESOURCE_AUDIO_CAPTURE in requested

  if (needsCamera && !hasPerm(Manifest.permission.CAMERA)) return false
  if (needsMic && !hasPerm(Manifest.permission.RECORD_AUDIO)) return false

  if (needsCamera) toGrant += PermissionRequest.RESOURCE_VIDEO_CAPTURE
  if (needsMic) toGrant += PermissionRequest.RESOURCE_AUDIO_CAPTURE

  if (toGrant.isNotEmpty()) request.grant(toGrant.toTypedArray()) else request.deny()
  return true
}

@Composable
private fun OfflineView(onRetry: () -> Unit) {
  Column(
    modifier = Modifier
      .fillMaxSize()
      .padding(24.dp),
    verticalArrangement = Arrangement.Center,
    horizontalAlignment = Alignment.CenterHorizontally
  ) {
    Text(text = stringResource(R.string.no_connection_title), style = MaterialTheme.typography.titleLarge)
    Text(
      text = stringResource(R.string.no_connection_subtitle),
      style = MaterialTheme.typography.bodyMedium,
      modifier = Modifier.padding(top = 8.dp, bottom = 16.dp)
    )
    Button(onClick = onRetry, contentPadding = PaddingValues(horizontal = 24.dp, vertical = 12.dp)) {
      Text(text = stringResource(R.string.action_retry))
    }
  }
}

@Composable
private fun ErrorView(message: String, onRetry: () -> Unit) {
  Column(
    modifier = Modifier
      .fillMaxSize()
      .padding(24.dp),
    verticalArrangement = Arrangement.Center,
    horizontalAlignment = Alignment.CenterHorizontally
  ) {
    Text(text = "Ошибка", style = MaterialTheme.typography.titleLarge)
    Text(text = message, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 8.dp, bottom = 16.dp))
    Button(onClick = onRetry, contentPadding = PaddingValues(horizontal = 24.dp, vertical = 12.dp)) {
      Text(text = stringResource(R.string.action_retry))
    }
  }
}

