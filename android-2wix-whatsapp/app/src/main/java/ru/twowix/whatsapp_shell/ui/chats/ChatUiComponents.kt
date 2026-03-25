package ru.twowix.whatsapp_shell.ui.chats

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.horizontalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import ru.twowix.whatsapp_shell.data.chat.CachedChatEntity
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun ChatsTopBar(title: String, subtitle: String?) {
  Surface(color = ChatDesignTokens.HeaderColor) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp)) {
      Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
      if (!subtitle.isNullOrBlank()) {
        Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall)
      }
    }
  }
}

@Composable
fun ChatSearchBar(query: String, onQueryChange: (String) -> Unit) {
  TextField(
    value = query,
    onValueChange = onQueryChange,
    modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
    leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
    placeholder = { Text("Поиск") },
    singleLine = true,
    colors = TextFieldDefaults.colors(
      focusedContainerColor = ChatDesignTokens.SearchSurface,
      unfocusedContainerColor = ChatDesignTokens.SearchSurface
    ),
    shape = RoundedCornerShape(12.dp)
  )
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun ChatFilterChipsRow(
  selected: String,
  allCount: Int,
  unreadCount: Int,
  waitingCount: Int,
  onSelect: (String) -> Unit
) {
  Row(
    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp),
    horizontalArrangement = Arrangement.spacedBy(8.dp)
  ) {
    FilterChip(selected = selected == "all", onClick = { onSelect("all") }, label = { Text("Все ($allCount)") })
    FilterChip(selected = selected == "unread", onClick = { onSelect("unread") }, label = { Text("Непрочитанные ($unreadCount)") })
    FilterChip(selected = selected == "waiting", onClick = { onSelect("waiting") }, label = { Text("Ждут ответа ($waitingCount)") })
  }
}

@Composable
fun ChatListItem(chat: CachedChatEntity, stale: Boolean, onClick: () -> Unit) {
  val title = chat.title.ifBlank { chat.phone.ifBlank { "Чат" } }
  val preview = chat.preview.ifBlank { "(без превью)" }
  val time = formatShortTime(chat.lastMessageAt)
  Surface(
    modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    color = ChatDesignTokens.RowHover
  ) {
    Row(
      modifier = Modifier.fillMaxWidth().heightIn(min = ChatDesignTokens.ItemMinHeight).padding(horizontal = 14.dp, vertical = 10.dp),
      verticalAlignment = Alignment.CenterVertically
    ) {
      AvatarView(title)
      Spacer(Modifier.size(10.dp))
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = ChatDesignTokens.TitleSize, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
          MessageTimeAndStatus(time = time, status = if (stale) "stale" else null)
        }
        Text(preview, maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = ChatDesignTokens.PreviewSize, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (chat.status?.contains("wait", ignoreCase = true) == true) {
          StatusBadge(text = "Ждет ответа", background = ChatDesignTokens.WaitingBadge, textColor = ChatDesignTokens.WaitingText)
        }
      }
      if (chat.unreadCount > 0) {
        Spacer(Modifier.size(8.dp))
        UnreadBadge(chat.unreadCount)
      }
    }
  }
}

@Composable
fun UnreadBadge(count: Int) {
  Box(
    modifier = Modifier.background(ChatDesignTokens.UnreadBadge, RoundedCornerShape(10.dp))
      .padding(horizontal = 6.dp, vertical = 2.dp),
    contentAlignment = Alignment.Center
  ) {
    Text(if (count > 99) "99+" else "$count", color = Color.White, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold)
  }
}

@Composable
fun StatusBadge(text: String, background: Color, textColor: Color) {
  Text(
    text = text,
    modifier = Modifier.background(background, RoundedCornerShape(8.dp)).padding(horizontal = 6.dp, vertical = 2.dp),
    color = textColor,
    style = MaterialTheme.typography.labelSmall,
    maxLines = 1
  )
}

@Composable
fun AvatarView(title: String) {
  val initials = title.trim().split(" ").take(2).mapNotNull { it.firstOrNull()?.uppercaseChar() }.joinToString("")
  Box(
    modifier = Modifier.size(ChatDesignTokens.AvatarSize).clip(CircleShape).background(Color(0xFFDDE4EA)),
    contentAlignment = Alignment.Center
  ) {
    Text(initials.ifBlank { "?" }, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
  }
}

@Composable
fun OfflineBanner() {
  Surface(color = ChatDesignTokens.OfflineBanner, modifier = Modifier.fillMaxWidth()) {
    Text("Офлайн: показываем сохраненные данные", modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp), color = ChatDesignTokens.OfflineText, style = MaterialTheme.typography.bodySmall)
  }
}

@Composable
fun SyncStatusLine(refreshing: Boolean, stale: Boolean, message: String) {
  Row(
    modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(8.dp)
  ) {
    Icon(Icons.Filled.Refresh, contentDescription = null, tint = if (stale) ChatDesignTokens.SyncStale else ChatDesignTokens.SyncFresh)
    Text(if (refreshing) "Синхронизация..." else message, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
  }
}

private fun formatShortTime(time: Long): String {
  if (time <= 0L) return ""
  return SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(time))
}

@Composable
fun MessageTimeAndStatus(time: String, status: String?) {
  val statusText = when (status) {
    "pending" -> "Отправка..."
    "failed" -> "Ошибка"
    "stale" -> "Старые данные"
    else -> ""
  }
  Text(
    text = if (statusText.isBlank()) time else "$time • $statusText",
    color = MaterialTheme.colorScheme.onSurfaceVariant,
    style = MaterialTheme.typography.labelSmall
  )
}
