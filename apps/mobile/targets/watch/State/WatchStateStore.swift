import Foundation
import Combine

@MainActor
final class WatchStateStore: ObservableObject {
  static let shared = WatchStateStore()

  @Published private(set) var sessionState: WatchSessionState = .unprovisioned
  @Published private(set) var context: WatchUserContext?
  @Published private(set) var lastUpdated: Date?
  /// Memory-only. Never persisted. Cleared on epoch change or logout.
  @Published private(set) var accessToken: String?

  private init() {}

  func applyContext(_ raw: [String: Any]) {
    guard let next = WatchUserContext.fromApplicationContext(raw) else {
      if sessionState == .active {
        purgeProtectedState()
        sessionState = .unavailable
        context = nil
      }
      return
    }

    if let current = context, next.sessionEpoch != current.sessionEpoch {
      purgeProtectedState()
    } else if context == nil, next.state != .active {
      purgeProtectedState()
    }

    context = next.state == .active ? next : nil
    sessionState = next.state == .active ? .active : next.state
    lastUpdated = Date()
  }

  func applyTokenReply(_ raw: [String: Any]) {
    applyPhoneReply(raw)
  }

  func applyPhoneReply(_ raw: [String: Any]) {
    if let nested = raw["context"] as? [String: Any] {
      applyContext(nested)
    } else if (raw["reason"] as? String) == "unavailable" {
      purgeProtectedState()
      sessionState = .unavailable
      context = nil
    }

    if let token = raw["accessToken"] as? String, !token.isEmpty, sessionState == .active {
      accessToken = token
    } else if (raw["reason"] as? String) == "unavailable" {
      accessToken = nil
    }
  }

  func markUnprovisioned() {
    purgeProtectedState()
    context = nil
    sessionState = .unprovisioned
  }

  private func purgeProtectedState() {
    accessToken = nil
    WatchOfflineQueue.shared.clear()
  }
}
