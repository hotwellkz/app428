package ru.twowix.whatsapp_shell.ui.chats

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import ru.twowix.whatsapp_shell.data.chat.CachedMessageEntity
import ru.twowix.whatsapp_shell.data.chat.ChatRepository
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatThreadScreen(
  chatId: String,
  repository: ChatRepository,
  onBack: () -> Unit,
) {
  val scope = rememberCoroutineScope()
  val chat by repository.observeChat(chatId).collectAsState(initial = null)
  val messages by repository.observeThread(chatId).collectAsState(initial = emptyList())
  val pending by repository.observePending(chatId).collectAsState(initial = emptyList())
  val snackbarHostState = remember { SnackbarHostState() }
  val listState = rememberLazyListState()

  var input by remember { mutableStateOf("") }
  var loading by remember { mutableStateOf(true) }
  var loadingOlder by remember { mutableStateOf(false) }

  LaunchedEffect(chatId) {
    repository.setActiveThread(chatId)
    repository.markRead(chatId)
    val r = repository.refreshThread(chatId)
    loading = false
    if (!r.ok) snackbarHostState.showSnackbar("Thread sync: ${r.message}")
  }

  androidx.compose.runtime.DisposableEffect(chatId) {
    onDispose {
      scope.launch { repository.setActiveThread(null) }
    }
  }

  LaunchedEffect(messages.size) {
    if (messages.isNotEmpty()) {
      listState.animateScrollToItem(messages.size - 1)
    }
  }

  Scaffold(
    topBar = {
      TopAppBar(
        title = {
          Column {
            Text(chat?.title ?: "Чат")
            Text(chat?.phone ?: "", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
        },
        navigationIcon = {
          IconButton(onClick = onBack) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад")
          }
        }
      )
    },
    snackbarHost = { SnackbarHost(snackbarHostState) },
    bottomBar = {
      Column(
        modifier = Modifier
          .fillMaxWidth()
          .background(ChatDesignTokens.ComposerSurface)
          .navigationBarsPadding()
          .imePadding()
          .padding(8.dp)
      ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          OutlinedTextField(
            value = input,
            onValueChange = { input = it },
            modifier = Modifier.weight(1f),
            maxLines = 4,
            label = { Text("Сообщение") },
            shape = androidx.compose.foundation.shape.RoundedCornerShape(ChatDesignTokens.ComposerRadius)
          )
          Spacer(modifier = Modifier.padding(3.dp))
          androidx.compose.material3.FloatingActionButton(
            onClick = {
              val text = input.trim()
              if (text.isBlank()) return@FloatingActionButton
              input = ""
              scope.launch {
                val r = repository.sendMessage(chatId, text)
                if (!r.ok) snackbarHostState.showSnackbar("Не отправлено: ${r.message}")
              }
            },
            containerColor = ChatDesignTokens.SendButton,
            contentColor = Color.White
          ) {
            Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Отправить")
          }
        }
        if (pending.isNotEmpty()) {
          Text(
            text = "В очереди: ${pending.size}",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 6.dp, start = 6.dp)
          )
        }
      }
    }
  ) { padding ->
    when {
      loading -> {
        Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
          CircularProgressIndicator()
        }
      }
      messages.isEmpty() -> {
        Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
          Text("Сообщений пока нет", textAlign = TextAlign.Center)
        }
      }
      else -> {
        LazyColumn(
          state = listState,
          modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .background(ChatDesignTokens.ThreadBackground)
            .padding(horizontal = 12.dp, vertical = 8.dp),
          verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
          item(key = "load_older") {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
              Button(
                enabled = !loadingOlder,
                onClick = {
                  scope.launch {
                    loadingOlder = true
                    val oldest = messages.firstOrNull()?.createdAt
                    val r = repository.refreshThread(chatId, before = oldest)
                    if (!r.ok) snackbarHostState.showSnackbar("Older sync: ${r.message}")
                    loadingOlder = false
                  }
                }
              ) {
                Text(if (loadingOlder) "Загрузка..." else "Загрузить старые")
              }
            }
          }
          items(messages, key = { it.localId }) { msg ->
            MessageBubble(msg = msg, onRetry = {
              val cid = msg.clientMessageId ?: return@MessageBubble
              scope.launch {
                val r = repository.retrySend(chatId, cid)
                if (!r.ok) snackbarHostState.showSnackbar("Retry error: ${r.message}")
              }
            })
          }
        }
      }
    }
  }
}

@Composable
private fun MessageBubble(
  msg: CachedMessageEntity,
  onRetry: () -> Unit,
) {
  val isOutgoing = msg.direction == "outgoing"
  val bubbleColor = if (isOutgoing) ChatDesignTokens.OutgoingBubble else ChatDesignTokens.IncomingBubble
  val align = if (isOutgoing) Alignment.End else Alignment.Start

  Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = align) {
    Column(
      modifier = Modifier
        .background(bubbleColor, shape = androidx.compose.foundation.shape.RoundedCornerShape(ChatDesignTokens.BubbleRadius))
        .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
      Text(msg.text, style = MaterialTheme.typography.bodyMedium)
      Spacer(Modifier.height(4.dp))
      MessageTimeAndStatus(time = formatMessageTime(msg.createdAt), status = msg.status)
      Text(
        text = msg.errorMessage ?: "",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )
      if (msg.status == "failed") {
        RetryInlineChip(onRetry = onRetry)
      }
    }
  }
}

@Composable
private fun RetryInlineChip(onRetry: () -> Unit) {
  AssistChip(
    onClick = onRetry,
    label = { Text("Повторить", fontWeight = FontWeight.Medium) },
    modifier = Modifier.padding(top = 4.dp)
  )
}

private fun formatMessageTime(time: Long): String {
  if (time <= 0L) return ""
  return SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(time))
}
