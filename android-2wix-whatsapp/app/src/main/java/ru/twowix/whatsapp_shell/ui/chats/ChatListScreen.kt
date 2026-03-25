package ru.twowix.whatsapp_shell.ui.chats

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import ru.twowix.whatsapp_shell.data.chat.ChatRepository
import ru.twowix.whatsapp_shell.util.NetworkMonitor

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatListScreen(
  onOpenSettings: () -> Unit,
  onOpenChat: (String) -> Unit,
) {
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val repo = remember { ChatRepository.get(context.applicationContext) }
  val items by repo.observeChats().collectAsState(initial = emptyList())
  val networkMonitor = remember { NetworkMonitor(context.applicationContext) }
  var isOnline by remember { mutableStateOf(true) }
  var isRefreshing by remember { mutableStateOf(false) }
  var lastSyncStatus by remember { mutableStateOf("local cache") }
  var searchQuery by remember { mutableStateOf("") }
  var selectedFilter by remember { mutableStateOf("all") }

  DisposableEffect(Unit) {
    networkMonitor.start()
    val job = scope.launch { networkMonitor.isOnline.collect { isOnline = it } }
    onDispose {
      job.cancel()
      networkMonitor.stop()
    }
  }

  LaunchedEffect(Unit) {
    isRefreshing = true
    val result = repo.syncNow("cold_start")
    lastSyncStatus = result.message
    isRefreshing = false
  }

  Scaffold(
    topBar = {
      TopAppBar(
        title = { Text("Чаты") },
        actions = {
          IconButton(onClick = {
            scope.launch {
              isRefreshing = true
              val result = repo.syncNow("manual_refresh")
              lastSyncStatus = result.message
              isRefreshing = false
            }
          }) {
            Icon(Icons.Filled.Refresh, contentDescription = "Обновить")
          }
          IconButton(onClick = onOpenSettings) {
            Icon(Icons.Filled.Settings, contentDescription = "Настройки")
          }
        }
      )
    }
  ) { padding ->
    val unreadCount = items.count { it.unreadCount > 0 }
    val waitingCount = items.count { it.status?.contains("wait", ignoreCase = true) == true }
    val filtered = items.filter { chat ->
      val q = searchQuery.trim().lowercase()
      val matchesQuery = q.isBlank() || chat.title.lowercase().contains(q) || chat.preview.lowercase().contains(q) || chat.phone.lowercase().contains(q)
      val matchesFilter = when (selectedFilter) {
        "unread" -> chat.unreadCount > 0
        "waiting" -> chat.status?.contains("wait", ignoreCase = true) == true
        else -> true
      }
      matchesQuery && matchesFilter
    }

    Column(
      modifier = Modifier
        .fillMaxSize()
        .padding(padding)
    ) {
      ChatsTopBar(title = "Чаты", subtitle = "2wix WhatsApp")
      ChatSearchBar(query = searchQuery, onQueryChange = { searchQuery = it })
      ChatFilterChipsRow(
        selected = selectedFilter,
        allCount = items.size,
        unreadCount = unreadCount,
        waitingCount = waitingCount,
        onSelect = { selectedFilter = it }
      )
      if (!isOnline) {
        OfflineBanner()
      }
      SyncStatusLine(refreshing = isRefreshing, stale = !isOnline, message = lastSyncStatus)
      if (items.isEmpty()) {
        EmptyChats(
          isOnline = isOnline,
          lastSyncStatus = lastSyncStatus,
          onRefresh = {
            scope.launch {
              isRefreshing = true
              val result = repo.syncNow("empty_state")
              lastSyncStatus = result.message
              isRefreshing = false
            }
          }
        )
      } else if (filtered.isEmpty()) {
        Column(
          modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp),
          verticalArrangement = Arrangement.Center,
          horizontalAlignment = Alignment.CenterHorizontally
        ) {
          Text("Ничего не найдено", style = MaterialTheme.typography.titleMedium)
          Text("Измените поиск или фильтр", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 6.dp))
        }
      } else {
        LazyColumn(modifier = Modifier.fillMaxSize()) {
          items(filtered, key = { it.chatId }) { chat ->
            ChatListItem(chat = chat, stale = !isOnline, onClick = { onOpenChat(chat.chatId) })
          }
        }
      }
    }
  }
}

@Composable
private fun EmptyChats(isOnline: Boolean, lastSyncStatus: String, onRefresh: () -> Unit) {
  Column(
    modifier = Modifier
      .fillMaxSize()
      .padding(24.dp),
    verticalArrangement = Arrangement.Center,
    horizontalAlignment = Alignment.CenterHorizontally
  ) {
    Text(
      text = if (isOnline) "Пока нет чатов" else "Нет сети и кэш пуст",
      style = MaterialTheme.typography.titleMedium
    )
    Text(
      text = lastSyncStatus,
      modifier = Modifier.padding(top = 8.dp),
      style = MaterialTheme.typography.bodySmall
    )
    Spacer(modifier = Modifier.height(12.dp))
    Button(onClick = onRefresh) { Text("Обновить") }
  }
}
