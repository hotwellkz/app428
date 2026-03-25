import FirebaseCore
import FirebaseMessaging
import SwiftUI
import UIKit
import UserNotifications

final class AppDelegate: NSObject, UIApplicationDelegate {
  var router: AppRouter?
  var preferences: Preferences?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    FirebaseApp.configure()
    Messaging.messaging().delegate = self
    UNUserNotificationCenter.current().delegate = self

    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
      DispatchQueue.main.async {
        PushDiagnosticsStore.shared.notificationPermissionGranted = granted
        UserDefaults.standard.set(granted, forKey: "diag.notifPerm")
      }
    }

    application.registerForRemoteNotifications()

    if let remote = launchOptions?[.remoteNotification] as? [AnyHashable: Any] {
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
        guard let self, let prefs = self.preferences, let router = self.router else { return }
        router.openFromNotification(userInfo: remote, preferences: prefs)
      }
    }
    return true
  }

  func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    Messaging.messaging().apnsToken = deviceToken
  }

  func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    PushDiagnosticsStore.shared.lastApnsError = error.localizedDescription
    UserDefaults.standard.set(error.localizedDescription, forKey: "diag.apnsErr")
  }
}

extension AppDelegate: MessagingDelegate {
  func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
    let t = fcmToken ?? ""
    UserDefaults.standard.set(t, forKey: "diag.fcmToken")
    DispatchQueue.main.async {
      PushDiagnosticsStore.shared.fcmToken = t
    }
    guard !t.isEmpty else { return }
    guard let prefs = preferences else { return }
    let mid = prefs.managerId.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !mid.isEmpty else { return }
    Task {
      let client = DeviceRegistrationClient()
      _ = await client.registerDevice(baseUrl: prefs.apiBaseURL, managerId: mid, token: t)
    }
  }
}

extension AppDelegate: UNUserNotificationCenterDelegate {
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    let userInfo = notification.request.content.userInfo
    PushDiagnosticsStore.shared.recordPushReceived(userInfo: userInfo)
    completionHandler([.banner, .sound, .badge])
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let userInfo = response.notification.request.content.userInfo
    PushDiagnosticsStore.shared.recordPushReceived(userInfo: userInfo)
    if let prefs = preferences, let router = router {
      router.openFromNotification(userInfo: userInfo, preferences: prefs)
    }
    completionHandler()
  }
}

/// Состояние для экрана диагностики.
final class PushDiagnosticsStore: ObservableObject {
  static let shared = PushDiagnosticsStore()

  @Published var fcmToken: String = UserDefaults.standard.string(forKey: "diag.fcmToken") ?? ""
  @Published var lastApnsError: String = UserDefaults.standard.string(forKey: "diag.apnsErr") ?? ""
  @Published var lastPushSummary: String = UserDefaults.standard.string(forKey: "diag.lastPush") ?? ""
  @Published var notificationPermissionGranted: Bool = UserDefaults.standard.object(forKey: "diag.notifPerm") as? Bool ?? false

  private init() {}

  func recordPushReceived(userInfo: [AnyHashable: Any]) {
    let p = PushPayload.from(userInfo: userInfo)
    let s = "title=\(p.title) chatId=\(p.chatId ?? "") targetUrl=\(p.targetUrl ?? "")"
    lastPushSummary = s
    UserDefaults.standard.set(s, forKey: "diag.lastPush")
  }
}
