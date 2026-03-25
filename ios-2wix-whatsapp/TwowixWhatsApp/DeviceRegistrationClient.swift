import Foundation
import UIKit

struct RegistrationResult: Sendable {
  let ok: Bool
  let code: Int?
  let message: String
  let finalURL: String
  let responseBody: String
}

/// Регистрация FCM и тест send-chat-push (контракт как на Android).
final class DeviceRegistrationClient {
  func registerDevice(baseUrl: URL, managerId: String, token: String) async -> RegistrationResult {
    let body: [String: Any] = [
      "managerId": managerId,
      "platform": "ios",
      "token": token,
      "deviceModel": await MainActor.run { UIDevice.current.model },
      "appVersion": AppConfig.appVersion,
      "deviceId": await MainActor.run { UIDevice.current.identifierForVendor?.uuidString ?? "" }
    ]
    return await postWithFallback(
      baseUrl: baseUrl,
      apiPath: "/api/mobile/register-device",
      functionName: "mobile-register-device",
      body: body
    )
  }

  func unregisterDevice(baseUrl: URL, managerId: String, token: String) async -> RegistrationResult {
    let body: [String: Any] = [
      "managerId": managerId,
      "token": token
    ]
    return await postWithFallback(
      baseUrl: baseUrl,
      apiPath: "/api/mobile/unregister-device",
      functionName: "mobile-unregister-device",
      body: body
    )
  }

  func sendChatPushTest(baseUrl: URL, managerId: String) async -> RegistrationResult {
    let body: [String: Any] = [
      "managerId": managerId,
      "preview": "Тест push из Settings (iOS)",
      "clientName": "2wix test",
      "chatId": "test-chat",
      "targetUrl": "https://2wix.ru/whatsapp",
      "messageId": "settings-test-ios-\(Int(Date().timeIntervalSince1970 * 1000))"
    ]
    return await postWithFallback(
      baseUrl: baseUrl,
      apiPath: "/api/send-chat-push",
      functionName: "send-chat-push",
      body: body
    )
  }

  private func postWithFallback(
    baseUrl: URL,
    apiPath: String,
    functionName: String,
    body: [String: Any]
  ) async -> RegistrationResult {
    let root = baseUrl.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let primary = URL(string: root + apiPath)!
    let first = await postRequest(url: primary, body: body)
    if !first.ok, first.code == 404 {
      let fallback = URL(string: root + "/.netlify/functions/" + functionName)!
      let second = await postRequest(url: fallback, body: body)
      var msg = second.message
      if second.ok { msg += " (fallback)" }
      return RegistrationResult(
        ok: second.ok,
        code: second.code,
        message: msg,
        finalURL: second.finalURL,
        responseBody: second.responseBody
      )
    }
    return first
  }

  private func postRequest(url: URL, body: [String: Any]) async -> RegistrationResult {
    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
    do {
      req.httpBody = try JSONSerialization.data(withJSONObject: body)
    } catch {
      return RegistrationResult(ok: false, code: nil, message: "JSON: \(error.localizedDescription)", finalURL: url.absoluteString, responseBody: "")
    }
    do {
      let (data, resp) = try await URLSession.shared.data(for: req)
      let code = (resp as? HTTPURLResponse)?.statusCode
      let raw = String(data: data, encoding: .utf8) ?? ""
      let snippet = raw.trimmingCharacters(in: .whitespacesAndNewlines).prefix(400).description
      if let code, (200 ... 299).contains(code) {
        return RegistrationResult(ok: true, code: code, message: "HTTP \(code)", finalURL: url.absoluteString, responseBody: snippet)
      }
      return RegistrationResult(
        ok: false,
        code: code,
        message: "HTTP \(code ?? -1) @ \(url.absoluteString)",
        finalURL: url.absoluteString,
        responseBody: snippet
      )
    } catch {
      return RegistrationResult(
        ok: false,
        code: nil,
        message: "\(type(of: error)): \(error.localizedDescription)",
        finalURL: url.absoluteString,
        responseBody: ""
      )
    }
  }
}
