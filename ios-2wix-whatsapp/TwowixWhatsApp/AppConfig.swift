import Foundation

enum AppConfig {
  static let defaultStartURL = URL(string: "https://2wix.ru/whatsapp")!
  static let defaultApiBaseURL = URL(string: "https://2wix.ru")!
  static let allowedHostSuffix = "2wix.ru"

  static var appVersion: String {
    (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "0"
  }
}
