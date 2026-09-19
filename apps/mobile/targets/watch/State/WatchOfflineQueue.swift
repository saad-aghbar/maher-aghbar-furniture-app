import Foundation

struct WatchQueuedAction: Codable, Identifiable, Equatable {
  var id: String
  var method: String
  var path: String
  var body: [String: String]
  var idempotencyKey: String
  var createdAt: Date
}

/// Persists wrist mutations only (no tokens). Replay when the radio is back.
@MainActor
final class WatchOfflineQueue: ObservableObject {
  static let shared = WatchOfflineQueue()
  private let defaultsKey = "maher.watch.offline_queue"
  private let cachePrefix = "maher.watch.cache."

  @Published private(set) var actions: [WatchQueuedAction] = []

  private init() {
    actions = load()
  }

  func enqueue(path: String, body: [String: String], idempotencyKey: String) {
    if actions.contains(where: { $0.idempotencyKey == idempotencyKey }) { return }
    let item = WatchQueuedAction(
      id: UUID().uuidString,
      method: "POST",
      path: path,
      body: body,
      idempotencyKey: idempotencyKey,
      createdAt: Date()
    )
    actions.append(item)
    persist()
  }

  func clear() {
    actions = []
    persist()
    for key in UserDefaults.standard.dictionaryRepresentation().keys where key.hasPrefix(cachePrefix) {
      UserDefaults.standard.removeObject(forKey: key)
    }
  }

  func cache<T: Encodable>(_ value: T, as name: String) {
    guard let data = try? JSONEncoder().encode(value) else { return }
    UserDefaults.standard.set(data, forKey: cachePrefix + name)
  }

  func cached<T: Decodable>(_ type: T.Type, as name: String) -> T? {
    guard let data = UserDefaults.standard.data(forKey: cachePrefix + name) else { return nil }
    return try? JSONDecoder().decode(type, from: data)
  }

  func replay(using client: WatchApiClient) async {
    let pending = actions
    for item in pending {
      var body = item.body
      body["idempotencyKey"] = item.idempotencyKey
      do {
        try await client.postVoid(item.path, body: Dictionary(uniqueKeysWithValues: body.map { ($0.key, $0.value as Any) }))
        actions.removeAll { $0.id == item.id }
        persist()
      } catch WatchApiClientError.http(_, let code)
        where code == "PHOTOS_REQUIRED" || code == "WIP_CLAIM_REQUIRED" || code == "PACKAGES_INCOMPLETE"
      {
        actions.removeAll { $0.id == item.id }
        persist()
      } catch {
        break
      }
    }
  }

  private func load() -> [WatchQueuedAction] {
    guard let data = UserDefaults.standard.data(forKey: defaultsKey) else { return [] }
    return (try? JSONDecoder().decode([WatchQueuedAction].self, from: data)) ?? []
  }

  private func persist() {
    if let data = try? JSONEncoder().encode(actions) {
      UserDefaults.standard.set(data, forKey: defaultsKey)
    }
  }
}
