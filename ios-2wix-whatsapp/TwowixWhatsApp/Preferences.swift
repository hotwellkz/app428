import Combine
import Foundation

final class Preferences: ObservableObject {
  @Published var apiBaseURLString: String {
    didSet { UserDefaults.standard.set(apiBaseURLString, forKey: Keys.apiBaseURL) }
  }

  @Published var managerId: String {
    didSet { UserDefaults.standard.set(managerId, forKey: Keys.managerId) }
  }

  @Published var startURLString: String {
    didSet { UserDefaults.standard.set(startURLString, forKey: Keys.startURL) }
  }

  private enum Keys {
    static let apiBaseURL = "prefs.apiBaseURL"
    static let managerId = "prefs.managerId"
    static let startURL = "prefs.startURL"
  }

  init() {
    let d = UserDefaults.standard
    self.apiBaseURLString = d.string(forKey: Keys.apiBaseURL) ?? AppConfig.defaultApiBaseURL.absoluteString
    self.managerId = d.string(forKey: Keys.managerId) ?? ""
    self.startURLString = d.string(forKey: Keys.startURL) ?? AppConfig.defaultStartURL.absoluteString
  }

  var apiBaseURL: URL {
    URL(string: apiBaseURLString.trimmingCharacters(in: .whitespacesAndNewlines)) ?? AppConfig.defaultApiBaseURL
  }

  var startURL: URL {
    URL(string: startURLString.trimmingCharacters(in: .whitespacesAndNewlines)) ?? AppConfig.defaultStartURL
  }
}
