import SwiftUI

struct AdminHomeView: View {
  @EnvironmentObject private var store: WatchStateStore
  @EnvironmentObject private var session: WatchSessionManager
  @StateObject private var queue = WatchOfflineQueue.shared
  @State private var summary: WatchAdminSummary?
  @State private var message: String?
  @State private var busy = false

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
        WatchIdentityHeader()
        if let counts = summary?.counts {
          Text("Urgent \(counts.urgentTasks) · Inbox \(counts.unreadNotifications)")
            .font(.caption)
            .foregroundStyle(MaherWatchTheme.muted)
        }
        ForEach(summary?.alerts ?? []) { alert in
          VStack(alignment: .leading, spacing: 2) {
            Text(alert.title)
              .font(.footnote.weight(.semibold))
              .fixedSize(horizontal: false, vertical: true)
            Text(alert.kind)
              .font(.caption2)
              .foregroundStyle(MaherWatchTheme.muted)
          }
          .padding(.vertical, 2)
        }
        if let first = summary?.alerts.first(where: { $0.kind == "notification" }) {
          Button("Mark read") { Task { await ack(first.id) } }
            .buttonStyle(.borderedProminent)
            .tint(MaherWatchTheme.accent)
            .disabled(busy)
        }
        if let message {
          Text(message)
            .font(.caption2)
            .foregroundStyle(MaherWatchTheme.muted)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .task { await refresh() }
    .onChange(of: store.accessToken) { _ in
      Task { await refresh() }
    }
  }

  private func refresh() async {
    session.requestAccessToken()
    if store.accessToken == nil {
      for _ in 0..<12 {
        try? await Task.sleep(nanoseconds: 250_000_000)
        if store.accessToken != nil { break }
      }
    }
    guard let client = try? store.apiClient() else {
      summary = queue.cached(WatchAdminSummary.self, as: "admin")
      return
    }
    do {
      try await queue.replay(using: client)
      let next: WatchAdminSummary = try await client.get("watch/admin/summary")
      summary = next
      queue.cache(next, as: "admin")
    } catch {
      summary = queue.cached(WatchAdminSummary.self, as: "admin")
      message = "Showing last glance"
    }
  }

  private func ack(_ id: String) async {
    busy = true
    defer { busy = false }
    let key = UUID().uuidString
    guard let client = try? store.apiClient() else {
      queue.enqueue(path: "notifications/\(id)/read", body: [:], idempotencyKey: key)
      message = "Saved offline"
      return
    }
    do {
      try await client.postVoid("notifications/\(id)/read")
      await refresh()
    } catch {
      queue.enqueue(path: "notifications/\(id)/read", body: [:], idempotencyKey: key)
      message = "Saved offline"
    }
  }
}
