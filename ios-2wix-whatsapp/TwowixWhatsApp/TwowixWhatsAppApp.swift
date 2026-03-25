import SwiftUI

@main
struct TwowixWhatsAppApp: App {
  @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
  @StateObject private var preferences = Preferences()
  @StateObject private var router = AppRouter()

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(preferences)
        .environmentObject(router)
        .environmentObject(PushDiagnosticsStore.shared)
        .onAppear {
          appDelegate.router = router
          appDelegate.preferences = preferences
        }
    }
  }
}
