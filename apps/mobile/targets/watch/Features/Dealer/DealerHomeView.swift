import SwiftUI

struct DealerHomeView: View {
  @EnvironmentObject private var store: WatchStateStore
  @EnvironmentObject private var session: WatchSessionManager
  @StateObject private var queue = WatchOfflineQueue.shared
  @State private var payload: WatchDealerOrders?
  @State private var message: String?

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
        WatchIdentityHeader()
        if let counts = payload?.counts {
          Text("Live \(counts.active) · Making \(counts.inProduction)")
            .font(.caption)
            .foregroundStyle(MaherWatchTheme.muted)
        }
        ForEach(payload?.orders ?? []) { order in
          VStack(alignment: .leading, spacing: 2) {
            Text(order.title)
              .font(.footnote.weight(.semibold))
              .fixedSize(horizontal: false, vertical: true)
            Text(order.customerStatus ?? order.status)
              .font(.caption2)
              .foregroundStyle(MaherWatchTheme.muted)
            Text(order.number)
              .font(.caption2)
              .foregroundStyle(MaherWatchTheme.muted)
          }
          .padding(.vertical, 2)
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
      payload = queue.cached(WatchDealerOrders.self, as: "dealer")
      return
    }
    do {
      let next: WatchDealerOrders = try await client.get("watch/dealer/orders")
      payload = next
      queue.cache(next, as: "dealer")
    } catch {
      payload = queue.cached(WatchDealerOrders.self, as: "dealer")
      message = "Showing last glance"
    }
  }
}
