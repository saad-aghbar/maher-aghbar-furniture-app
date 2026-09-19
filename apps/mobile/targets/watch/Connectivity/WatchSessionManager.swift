import Combine
import Foundation
import WatchConnectivity
import WatchKit

@MainActor
final class WatchSessionManager: NSObject, ObservableObject {
  static let shared = WatchSessionManager()

  @Published private(set) var activationState: WCSessionActivationState = .notActivated
  @Published private(set) var isReachable = false
  @Published private(set) var lastError: String?

  private override init() {
    super.init()
  }

  func activate() {
    guard WCSession.isSupported() else {
      lastError = "WatchConnectivity is not supported."
      return
    }
    let session = WCSession.default
    session.delegate = self
    if session.activationState != .activated {
      session.activate()
    } else {
      activationState = .activated
      isReachable = session.isReachable
      applyExistingContext(session)
    }
  }

  func requestAccessToken() {
    sendPhoneMessage(op: "accessToken")
  }

  func requestUserContext() {
    sendPhoneMessage(op: "userContext")
  }

  private func sendPhoneMessage(op: String) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.activationState == .activated, session.isReachable else {
      lastError = "iPhone is not reachable."
      return
    }
    var payload: [String: Any] = ["op": op]
    if let epoch = WatchStateStore.shared.context?.sessionEpoch {
      payload["sessionEpoch"] = epoch
    }
    session.sendMessage(payload, replyHandler: { reply in
      Task { @MainActor in
        WatchStateStore.shared.applyPhoneReply(reply)
        self.lastError = nil
      }
    }, errorHandler: { error in
      Task { @MainActor in
        self.lastError = error.localizedDescription
      }
    })
  }

  func openOnIPhone() {
    if let url = URL(string: "maher://") {
      WKApplication.shared().openSystemURL(url)
    }
  }

  private func applyExistingContext(_ session: WCSession) {
    if !session.receivedApplicationContext.isEmpty {
      WatchStateStore.shared.applyContext(session.receivedApplicationContext)
    }
  }
}

extension WatchSessionManager: WCSessionDelegate {
  nonisolated func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    Task { @MainActor in
      self.activationState = activationState
      self.isReachable = session.isReachable
      self.lastError = error?.localizedDescription
      if activationState == .activated {
        self.applyExistingContext(session)
        if session.isReachable {
          self.requestUserContext()
        }
      }
    }
  }

  nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
    Task { @MainActor in
      self.isReachable = session.isReachable
      if session.isReachable {
        self.requestUserContext()
      }
    }
  }

  nonisolated func session(
    _ session: WCSession,
    didReceiveApplicationContext applicationContext: [String: Any]
  ) {
    Task { @MainActor in
      WatchStateStore.shared.applyContext(applicationContext)
    }
  }
}
