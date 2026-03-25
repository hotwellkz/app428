package ru.twowix.whatsapp_shell.util

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class NetworkMonitor(context: Context) {
  private val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
  private val _isOnline = MutableStateFlow(checkIsOnline())
  val isOnline: StateFlow<Boolean> = _isOnline

  private val callback = object : ConnectivityManager.NetworkCallback() {
    override fun onAvailable(network: Network) {
      _isOnline.value = checkIsOnline()
    }

    override fun onLost(network: Network) {
      _isOnline.value = checkIsOnline()
    }

    override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) {
      _isOnline.value = checkIsOnline()
    }
  }

  fun start() {
    val req = NetworkRequest.Builder().build()
    cm.registerNetworkCallback(req, callback)
    _isOnline.value = checkIsOnline()
  }

  fun stop() {
    runCatching { cm.unregisterNetworkCallback(callback) }
  }

  private fun checkIsOnline(): Boolean {
    val network = cm.activeNetwork ?: return false
    val caps = cm.getNetworkCapabilities(network) ?: return false
    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
      caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
  }
}

