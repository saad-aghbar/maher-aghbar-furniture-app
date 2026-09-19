import Foundation

enum WatchApiClientError: Error {
  case noSession
  case http(Int, String?)
  case decoding
}

struct WatchApiClient {
  var baseURL: String
  var accessToken: String
  var sessionEpoch: Int

  func get<T: Decodable>(_ path: String) async throws -> T {
    try await send(path: path, method: "GET", body: nil)
  }

  func post<T: Decodable>(_ path: String, body: [String: Any] = [:]) async throws -> T {
    try await send(path: path, method: "POST", body: body)
  }

  func postVoid(_ path: String, body: [String: Any] = [:]) async throws {
    let _: EmptyOk = try await send(path: path, method: "POST", body: body)
  }

  private func send<T: Decodable>(path: String, method: String, body: [String: Any]?) async throws -> T {
    guard let url = url(for: path) else { throw WatchApiClientError.noSession }
    var request = URLRequest(url: url)
    request.httpMethod = method
    request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    if let body {
      request.setValue("application/json", forHTTPHeaderField: "Content-Type")
      request.httpBody = try JSONSerialization.data(withJSONObject: body)
    }
    let (data, response) = try await URLSession.shared.data(for: request)
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    if status == 204 {
      if T.self == EmptyOk.self, let empty = EmptyOk() as? T { return empty }
    }
    if !(200...299).contains(status) {
      let parsed = try? JSONDecoder().decode(WatchApiError.self, from: data)
      throw WatchApiClientError.http(status, parsed?.resolvedCode ?? parsed?.message)
    }
    if T.self == EmptyOk.self, let empty = EmptyOk() as? T { return empty }
    do {
      return try JSONDecoder().decode(T.self, from: data)
    } catch {
      throw WatchApiClientError.decoding
    }
  }

  private func url(for path: String) -> URL? {
    var root = baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    if root.isEmpty { return nil }
    if !root.contains("/api/v1") {
      root += "/api/v1"
    }
    return URL(string: "\(root)/\(path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))")
  }
}

struct EmptyOk: Decodable {}

extension WatchStateStore {
  func apiClient() throws -> WatchApiClient {
    guard sessionState == .active,
          let context,
          let token = accessToken, !token.isEmpty,
          !context.apiBaseUrl.isEmpty
    else { throw WatchApiClientError.noSession }
    return WatchApiClient(
      baseURL: context.apiBaseUrl,
      accessToken: token,
      sessionEpoch: context.sessionEpoch
    )
  }
}
