package ru.twowix.whatsapp_shell.util

/**
 * Target для открытия в WebView.
 * - url: полный URL, который будет загружен
 * - source: откуда пришло (launcher / intent / push позже)
 */
data class WebTarget(
  val url: String,
  val source: String = "launcher",
)

