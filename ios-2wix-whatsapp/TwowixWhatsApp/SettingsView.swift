import SwiftUI
import UserNotifications
import WebKit

struct SettingsView: View {
  @EnvironmentObject private var preferences: Preferences
  @EnvironmentObject private var diagnostics: PushDiagnosticsStore
  @Environment(\.dismiss) private var dismiss

  @State private var notifStatus: String = "…"
  @State private var lastRegStatus: String = ""
  @State private var busy = false

  private let client = DeviceRegistrationClient()

  var body: some View {
    NavigationStack {
      Form {
        Section("Сервер") {
          TextField("API base URL", text: $preferences.apiBaseURLString)
            .textInputAutocapitalization(.never)
            .keyboardType(.URL)
          TextField("Стартовый URL (WhatsApp web)", text: $preferences.startURLString)
            .textInputAutocapitalization(.never)
            .keyboardType(.URL)
          TextField("managerId", text: $preferences.managerId)
            .textInputAutocapitalization(.never)
        }

        Section("Уведомления") {
          HStack {
            Text("Разрешение")
            Spacer()
            Text(notifStatus).foregroundStyle(.secondary)
          }
          HStack {
            Text("FCM token")
            Spacer()
            Text(diagnostics.fcmToken.isEmpty ? "—" : String(diagnostics.fcmToken.prefix(24)) + "…")
              .font(.caption)
              .foregroundStyle(.secondary)
          }
          if !diagnostics.lastApnsError.isEmpty {
            Text("APNs: \(diagnostics.lastApnsError)")
              .font(.caption)
              .foregroundStyle(.red)
          }
          if !diagnostics.lastPushSummary.isEmpty {
            Text("Последний push: \(diagnostics.lastPushSummary)")
              .font(.caption)
          }
          Text("register-device: \(lastRegStatus.isEmpty ? "n/a" : lastRegStatus)")
            .font(.caption)
        }

        Section("Действия") {
          Button("Запросить разрешение на уведомления снова") {
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { g, _ in
              DispatchQueue.main.async {
                diagnostics.notificationPermissionGranted = g
                refreshNotifStatus()
              }
            }
          }
          Button("Тест локального уведомления") {
            let c = UNMutableNotificationContent()
            c.title = "2wix local test"
            c.body = "Проверка UserNotifications"
            let r = UNNotificationRequest(identifier: UUID().uuidString, content: c, trigger: nil)
            UNUserNotificationCenter.current().add(r)
          }
          Button("Тест регистрации (register-device)") {
            Task {
              await runRegisterTest()
            }
          }
          .disabled(busy || preferences.managerId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || diagnostics.fcmToken.isEmpty)
          Button("Тест send-chat-push") {
            Task {
              await runPushTest()
            }
          }
          .disabled(busy || preferences.managerId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
          Button("unregister-device", role: .destructive) {
            Task {
              await runUnregister()
            }
          }
          .disabled(busy || preferences.managerId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || diagnostics.fcmToken.isEmpty)
        }

        Section("Сессия / кэш") {
          Button("Очистить cookies и кэш WebView", role: .destructive) {
            clearWebData()
          }
        }
      }
      .navigationTitle("Настройки")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Закрыть") { dismiss() }
        }
      }
      .onAppear {
        refreshNotifStatus()
      }
    }
  }

  private func refreshNotifStatus() {
    UNUserNotificationCenter.current().getNotificationSettings { s in
      DispatchQueue.main.async {
        switch s.authorizationStatus {
        case .authorized: notifStatus = "authorized"
        case .denied: notifStatus = "denied"
        case .notDetermined: notifStatus = "notDetermined"
        case .provisional: notifStatus = "provisional"
        case .ephemeral: notifStatus = "ephemeral"
        @unknown default: notifStatus = "unknown"
        }
      }
    }
  }

  private func runRegisterTest() async {
    busy = true
    defer { busy = false }
    let mid = preferences.managerId.trimmingCharacters(in: .whitespacesAndNewlines)
    let tok = diagnostics.fcmToken
    let r = await client.registerDevice(baseUrl: preferences.apiBaseURL, managerId: mid, token: tok)
    lastRegStatus = r.ok ? "OK \(r.code ?? 0) \(r.finalURL)" : r.message
  }

  private func runPushTest() async {
    busy = true
    defer { busy = false }
    let mid = preferences.managerId.trimmingCharacters(in: .whitespacesAndNewlines)
    let r = await client.sendChatPushTest(baseUrl: preferences.apiBaseURL, managerId: mid)
    lastRegStatus = r.ok ? "send-chat-push OK \(r.code ?? 0)" : r.message
  }

  private func runUnregister() async {
    busy = true
    defer { busy = false }
    let mid = preferences.managerId.trimmingCharacters(in: .whitespacesAndNewlines)
    let tok = diagnostics.fcmToken
    let r = await client.unregisterDevice(baseUrl: preferences.apiBaseURL, managerId: mid, token: tok)
    lastRegStatus = r.ok ? "unregister OK \(r.code ?? 0)" : r.message
  }

  private func clearWebData() {
    let types = WKWebsiteDataStore.allWebsiteDataTypes()
    WKWebsiteDataStore.default().removeData(ofTypes: types, modifiedSince: Date(timeIntervalSince1970: 0)) {}
    URLSession.shared.configuration.urlCache?.removeAllCachedResponses()
    lastRegStatus = "cookies/cache очищены"
  }
}
