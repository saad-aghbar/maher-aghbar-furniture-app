import Foundation

enum WatchSurface: String, Equatable {
  case worker
  case admin
  case dealer
}

enum WatchSessionState: String, Equatable {
  case unprovisioned
  case active
  case unavailable
}

struct WatchUserContext: Equatable {
  var sessionEpoch: Int
  var userId: String
  var displayName: String
  var surface: WatchSurface
  var roles: [String]
  var capabilities: [String]
  var locale: String
  var apiBaseUrl: String
  var state: WatchSessionState

  var displayRole: String {
    switch surface {
    case .worker: return "Worker"
    case .admin: return "Admin"
    case .dealer: return "Dealer"
    }
  }

  func can(_ capability: String) -> Bool {
    capabilities.contains(capability)
  }

  static func fromApplicationContext(_ raw: [String: Any]) -> WatchUserContext? {
    let state = WatchSessionState(rawValue: string(raw["state"]) ?? "") ?? .unprovisioned
    let epoch = intValue(raw["sessionEpoch"]) ?? 0
    guard state == .active else {
      return WatchUserContext(
        sessionEpoch: epoch,
        userId: "",
        displayName: "",
        surface: .worker,
        roles: [],
        capabilities: [],
        locale: "en",
        apiBaseUrl: "",
        state: state == .unavailable ? .unavailable : .unprovisioned
      )
    }

    guard let userId = string(raw["userId"]), !userId.isEmpty,
          let displayName = string(raw["displayName"]), !displayName.isEmpty,
          let surfaceRaw = string(raw["surface"]),
          let surface = WatchSurface(rawValue: surfaceRaw)
    else { return nil }

    return WatchUserContext(
      sessionEpoch: epoch,
      userId: userId,
      displayName: displayName,
      surface: surface,
      roles: stringArray(raw["roles"]),
      capabilities: stringArray(raw["capabilities"]),
      locale: string(raw["locale"]) ?? "en",
      apiBaseUrl: string(raw["apiBaseUrl"]) ?? "",
      state: .active
    )
  }
}

private func string(_ raw: Any?) -> String? {
  if let value = raw as? String { return value }
  if let value = raw as? NSNumber { return value.stringValue }
  return nil
}

private func intValue(_ raw: Any?) -> Int? {
  if let value = raw as? Int { return value }
  if let value = raw as? NSNumber { return value.intValue }
  if let value = raw as? String { return Int(value) }
  return nil
}

private func stringArray(_ raw: Any?) -> [String] {
  (raw as? [Any])?.compactMap { string($0) } ?? []
}
