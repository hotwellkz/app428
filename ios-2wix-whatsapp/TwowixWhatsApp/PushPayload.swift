import Foundation

/// Контракт data payload push (как на Android).
struct PushPayload {
  let chatId: String?
  let phone: String?
  let clientName: String?
  let preview: String?
  let unreadCount: Int?
  let targetUrl: String?
  let messageId: String?
  let type: String?

  var title: String {
    let c = clientName?.trimmingCharacters(in: .whitespacesAndNewlines)
    let p = phone?.trimmingCharacters(in: .whitespacesAndNewlines)
    if let c, !c.isEmpty { return c }
    if let p, !p.isEmpty { return p }
    return "Новое сообщение"
  }

  static func from(userInfo: [AnyHashable: Any]) -> PushPayload {
    var merged: [AnyHashable: Any] = userInfo
    if let nested = userInfo["data"] as? [String: String] {
      for (k, v) in nested { merged[k] = v }
    }
    func s(_ key: String) -> String? {
      if let v = merged[key] as? String {
        let t = v.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
      }
      if let v = merged[key] as? Int {
        return String(v)
      }
      return nil
    }
    func i(_ key: String) -> Int? {
      if let v = merged[key] as? Int { return v }
      if let v = merged[key] as? String { return Int(v) }
      return nil
    }
    return PushPayload(
      chatId: s("chatId"),
      phone: s("phone"),
      clientName: s("clientName"),
      preview: s("preview"),
      unreadCount: i("unreadCount"),
      targetUrl: s("targetUrl"),
      messageId: s("messageId"),
      type: s("type")
    )
  }

  func bestTargetUrl(buildChatUrl: (String) -> String) -> String? {
    if let t = targetUrl?.trimmingCharacters(in: .whitespacesAndNewlines), !t.isEmpty {
      return t
    }
    guard let cid = chatId?.trimmingCharacters(in: .whitespacesAndNewlines), !cid.isEmpty else {
      return nil
    }
    return buildChatUrl(cid)
  }
}
