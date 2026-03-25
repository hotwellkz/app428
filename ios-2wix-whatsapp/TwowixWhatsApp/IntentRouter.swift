import Foundation

enum IntentRouter {
  static func buildChatUrl(chatId: String, startURL: URL) -> String {
    let base = startURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let encoded = chatId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? chatId
    return "\(base)?chatId=\(encoded)"
  }

  static func normalizeUrl(_ raw: String, apiBase: URL) -> String {
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.hasPrefix("http://") {
      return "https://" + trimmed.dropFirst("http://".count)
    }
    if trimmed.hasPrefix("https://") { return String(trimmed) }
    if trimmed.hasPrefix("/") {
      return apiBase.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + trimmed
    }
    return trimmed
  }

  static func url(from payload: PushPayload, startURL: URL, apiBase: URL) -> URL? {
    guard let s = payload.bestTargetUrl(buildChatUrl: { cid in buildChatUrl(chatId: cid, startURL: startURL) }) else {
      return nil
    }
    let n = normalizeUrl(s, apiBase: apiBase)
    return URL(string: n)
  }
}
