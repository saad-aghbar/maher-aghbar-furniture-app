import Foundation
import WatchConnectivity

final class MaherWatchSession: NSObject, WCSessionDelegate {
  static let shared = MaherWatchSession()

  private override init() {
    super.init()
  }

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    if session.delegate == nil || session.delegate !== self {
      session.delegate = self
    }
    if session.activationState != .activated {
      session.activate()
    }
  }

  func publishContext(_ payload: [String: Any]) {
    MaherWatchVault.saveContext(payload)
    pushApplicationContext(payload)
  }

  func publishToken(_ accessToken: String, sessionEpoch: Int) {
    MaherWatchVault.saveToken(accessToken, sessionEpoch: sessionEpoch)
  }

  func clear() {
    MaherWatchVault.clear()
  }

  private func pushApplicationContext(_ payload: [String: Any]) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.activationState == .activated else { return }
    do {
      try session.updateApplicationContext(payload)
    } catch {
      // Pairing can miss the first push; vault remains authoritative for sendMessage replies.
    }
  }

  private func contextReply() -> [String: Any] {
    let storedEpoch = MaherWatchVault.sessionEpoch()
    let token = MaherWatchVault.accessToken()
    let context = MaherWatchVault.context()
    let state = context?["state"] as? String

    guard state == "active", let context else {
      return [
        "ok": false,
        "reason": "unavailable",
        "sessionEpoch": storedEpoch ?? 0,
        "context": context ?? ["state": "unavailable", "sessionEpoch": storedEpoch ?? 0],
      ]
    }

    var reply: [String: Any] = [
      "ok": true,
      "sessionEpoch": storedEpoch ?? 0,
      "context": context,
    ]
    if let token, !token.isEmpty {
      reply["accessToken"] = token
    }
    return reply
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if activationState == .activated, let ctx = MaherWatchVault.context() {
      try? session.updateApplicationContext(ctx)
    }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    let op = message["op"] as? String
    guard op == "accessToken" || op == "userContext" else {
      replyHandler(["ok": false, "reason": "unknown_op"])
      return
    }

    let requestedEpoch = intValue(message["sessionEpoch"])
    let storedEpoch = MaherWatchVault.sessionEpoch()
    if let requestedEpoch, let storedEpoch, requestedEpoch != storedEpoch, op == "accessToken" {
      replyHandler([
        "ok": false,
        "reason": "stale_epoch",
        "sessionEpoch": storedEpoch,
        "context": MaherWatchVault.context() ?? ["state": "unavailable", "sessionEpoch": storedEpoch],
      ])
      return
    }

    replyHandler(contextReply())
  }

  private func intValue(_ raw: Any?) -> Int? {
    if let value = raw as? Int { return value }
    if let value = raw as? NSNumber { return value.intValue }
    if let value = raw as? String { return Int(value) }
    return nil
  }
}
