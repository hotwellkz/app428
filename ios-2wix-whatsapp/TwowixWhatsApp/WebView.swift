import SwiftUI
import UIKit
import UniformTypeIdentifiers
import WebKit

struct WebView: UIViewControllerRepresentable {
  @Binding var urlToLoad: URL?
  @Binding var shouldPerformGoBack: Bool
  let startURL: URL
  let onCanGoBackChange: (Bool) -> Void

  func makeCoordinator() -> Coordinator {
    Coordinator(parent: self)
  }

  func makeUIViewController(context: Context) -> WebContainerViewController {
    let vc = WebContainerViewController()
    vc.coordinator = context.coordinator
    context.coordinator.container = vc
    vc.loadStartURL(startURL)
    return vc
  }

  func updateUIViewController(_ vc: WebContainerViewController, context: Context) {
    context.coordinator.parent = self
    if shouldPerformGoBack {
      shouldPerformGoBack = false
      if vc.webView.canGoBack {
        vc.webView.goBack()
      }
    }
    if let u = urlToLoad {
      urlToLoad = nil
      vc.webView.load(URLRequest(url: u))
    }
    onCanGoBackChange(vc.webView.canGoBack)
  }

  final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, UIDocumentPickerDelegate {
    var parent: WebView
    weak var container: WebContainerViewController?
    private var filePickCompletion: (([URL]?) -> Void)?

    init(parent: WebView) {
      self.parent = parent
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
      guard let url = navigationAction.request.url else {
        decisionHandler(.allow)
        return
      }
      if navigationAction.navigationType == .linkActivated || navigationAction.navigationType == .other {
        if shouldOpenExternally(url) {
          UIApplication.shared.open(url)
          decisionHandler(.cancel)
          return
        }
      }
      decisionHandler(.allow)
    }

    private func shouldOpenExternally(_ url: URL) -> Bool {
      guard let host = url.host?.lowercased() else { return false }
      return !host.hasSuffix(AppConfig.allowedHostSuffix)
    }

    func webView(
      _ webView: WKWebView,
      runOpenPanelWith parameters: WKOpenPanelParameters,
      initiatedByFrame frame: WKFrameInfo,
      completionHandler: @escaping ([URL]?) -> Void
    ) {
      filePickCompletion = completionHandler
      let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.item], asCopy: true)
      picker.allowsMultipleSelection = parameters.allowsMultipleSelection
      picker.delegate = self
      container?.present(picker, animated: true)
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
      filePickCompletion?(urls)
      filePickCompletion = nil
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
      filePickCompletion?(nil)
      filePickCompletion = nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
      parent.onCanGoBackChange(webView.canGoBack)
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
      parent.onCanGoBackChange(webView.canGoBack)
    }
  }
}

final class WebContainerViewController: UIViewController {
  weak var coordinator: WebView.Coordinator?

  let webView: WKWebView = {
    let config = WKWebViewConfiguration()
    config.defaultWebpagePreferences.preferredContentMode = .mobile
    config.preferences.javaScriptEnabled = true
    config.allowsInlineMediaPlayback = true
    config.mediaTypesRequiringUserActionForPlayback = []
    let w = WKWebView(frame: .zero, configuration: config)
    w.allowsBackForwardNavigationGestures = true
    w.scrollView.contentInsetAdjustmentBehavior = .never
    w.isOpaque = false
    w.backgroundColor = .systemBackground
    return w
  }()

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemBackground
    webView.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(webView)
    NSLayoutConstraint.activate([
      webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
      webView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
      webView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
      webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
    ])
  }

  func loadStartURL(_ url: URL) {
    guard let c = coordinator else { return }
    webView.navigationDelegate = c
    webView.uiDelegate = c
    webView.load(URLRequest(url: url))
  }
}
