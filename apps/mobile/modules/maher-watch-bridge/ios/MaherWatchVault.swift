import Foundation
import Security

/// Keychain-backed Watch provisioning blob.
/// Readable from the native WCSession delegate without the JS bridge.
enum MaherWatchVault {
  private static let service = "jo.maheraghbar.furniture.watch-vault"
  private static let tokenAccount = "accessToken"
  private static let epochAccount = "sessionEpoch"
  private static let contextAccount = "contextJson"

  static func saveToken(_ accessToken: String, sessionEpoch: Int) {
    write(account: tokenAccount, value: accessToken)
    write(account: epochAccount, value: String(sessionEpoch))
  }

  static func saveContext(_ payload: [String: Any]) {
    guard JSONSerialization.isValidJSONObject(payload),
          let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
          let json = String(data: data, encoding: .utf8)
    else { return }
    write(account: contextAccount, value: json)
    if let epoch = payload["sessionEpoch"] as? Int {
      write(account: epochAccount, value: String(epoch))
    } else if let epoch = payload["sessionEpoch"] as? NSNumber {
      write(account: epochAccount, value: epoch.stringValue)
    }
  }

  static func accessToken() -> String? {
    read(account: tokenAccount)
  }

  static func sessionEpoch() -> Int? {
    guard let raw = read(account: epochAccount), let value = Int(raw) else { return nil }
    return value
  }

  static func context() -> [String: Any]? {
    guard let json = read(account: contextAccount),
          let data = json.data(using: .utf8),
          let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return nil }
    return object
  }

  static func clear() {
    delete(account: tokenAccount)
    delete(account: epochAccount)
    delete(account: contextAccount)
  }

  private static func write(account: String, value: String) {
    delete(account: account)
    let payload = Data(value.utf8)
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecValueData as String: payload,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
    ]
    SecItemAdd(query as CFDictionary, nil)
  }

  private static func read(account: String) -> String? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    guard status == errSecSuccess, let data = item as? Data else { return nil }
    return String(data: data, encoding: .utf8)
  }

  private static func delete(account: String) {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
    SecItemDelete(query as CFDictionary)
  }
}
