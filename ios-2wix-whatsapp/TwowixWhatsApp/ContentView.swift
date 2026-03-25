import SwiftUI

struct ContentView: View {
  @EnvironmentObject private var preferences: Preferences
  @EnvironmentObject private var router: AppRouter

  @State private var urlToLoad: URL?
  @State private var shouldPerformGoBack = false
  @State private var canGoBack = false
  @State private var showSettings = false

  var body: some View {
    NavigationStack {
      ZStack {
        WebView(
          urlToLoad: $urlToLoad,
          shouldPerformGoBack: $shouldPerformGoBack,
          startURL: preferences.startURL,
          onCanGoBackChange: { canGoBack = $0 }
        )
      }
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .topBarLeading) {
          Button {
            shouldPerformGoBack = true
          } label: {
            Image(systemName: "chevron.backward")
          }
          .disabled(!canGoBack)
        }
        ToolbarItem(placement: .topBarTrailing) {
          Button {
            showSettings = true
          } label: {
            Image(systemName: "gearshape")
          }
        }
      }
    }
    .sheet(isPresented: $showSettings) {
      SettingsView()
    }
    .onChange(of: router.pendingWebURL) { new in
      guard let new else { return }
      urlToLoad = new
      router.pendingWebURL = nil
    }
    .onAppear {
      if let u = router.pendingWebURL {
        urlToLoad = u
        router.pendingWebURL = nil
      }
    }
  }
}

#Preview {
  ContentView()
    .environmentObject(Preferences())
    .environmentObject(AppRouter())
}
