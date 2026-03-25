import Foundation
import SwiftUI

/// Маршрутизация: открытие чата из push / cold start.
final class AppRouter: ObservableObject {
  @Published var pendingWebURL: URL?

  func openFromNotification(userInfo: [AnyHashable: Any], preferences: Preferences) {
    let payload = PushPayload.from(userInfo: userInfo)
    if let url = IntentRouter.url(from: payload, startURL: preferences.startURL, apiBase: preferences.apiBaseURL) {
      pendingWebURL = url
    }
  }

  func consumePendingURL() -> URL? {
    let u = pendingWebURL
    pendingWebURL = nil
    return u
  }
}
