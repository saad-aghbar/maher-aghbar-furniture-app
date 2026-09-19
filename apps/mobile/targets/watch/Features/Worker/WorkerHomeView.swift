import SwiftUI

struct WorkerHomeView: View {
  @EnvironmentObject private var store: WatchStateStore
  @EnvironmentObject private var session: WatchSessionManager
  @StateObject private var queue = WatchOfflineQueue.shared
  @State private var today: WatchWorkerToday?
  @State private var message: String?
  @State private var busy = false

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 10) {
        WatchIdentityHeader()
        if !queue.actions.isEmpty {
          Text("Queued \(queue.actions.count)")
            .font(.caption2)
            .foregroundStyle(MaherWatchTheme.muted)
        }
        if let task = today?.currentTask {
          taskBlock(task)
        } else {
          Text("No task right now")
            .font(.footnote)
            .foregroundStyle(MaherWatchTheme.muted)
        }
        if let inspection = today?.nextInspection, store.context?.can("quality-inspection.perform") == true {
          NavigationLink {
            InspectionView(glance: inspection)
          } label: {
            Text("Inspect \(inspection.productTitle)")
              .font(.headline)
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.bordered)
          .tint(MaherWatchTheme.accent)
        }
        if let message {
          Text(message)
            .font(.caption2)
            .foregroundStyle(MaherWatchTheme.muted)
            .fixedSize(horizontal: false, vertical: true)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .task { await refresh() }
    .onChange(of: store.accessToken) { _ in
      Task { await refresh() }
    }
  }

  @ViewBuilder
  private func taskBlock(_ task: WatchCurrentTask) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(task.stageName)
        .font(.caption)
        .foregroundStyle(MaherWatchTheme.muted)
      Text(task.productTitle)
        .font(.title3.weight(.semibold))
        .fixedSize(horizontal: false, vertical: true)
      Text(task.orderNumber)
        .font(.caption2)
        .foregroundStyle(MaherWatchTheme.muted)
      if task.canStart {
        Button("Start") { Task { await mutate(path: "tasks/\(task.id)/start") } }
          .buttonStyle(.borderedProminent)
          .tint(MaherWatchTheme.accent)
          .disabled(busy)
      }
      if task.canComplete {
        Button("Complete") { Task { await mutate(path: "tasks/\(task.id)/complete") } }
          .buttonStyle(.borderedProminent)
          .tint(MaherWatchTheme.accent)
          .disabled(busy)
      }
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
      today = queue.cached(WatchWorkerToday.self, as: "worker")
      return
    }
    do {
      try await queue.replay(using: client)
      let next: WatchWorkerToday = try await client.get("watch/worker/today")
      today = next
      queue.cache(next, as: "worker")
      message = nil
    } catch {
      today = queue.cached(WatchWorkerToday.self, as: "worker")
      message = "Showing last glance"
    }
  }

  private func mutate(path: String) async {
    busy = true
    defer { busy = false }
    let key = UUID().uuidString
    guard let client = try? store.apiClient() else {
      queue.enqueue(path: path, body: [:], idempotencyKey: key)
      message = "Saved offline"
      return
    }
    do {
      try await client.postVoid(path, body: ["idempotencyKey": key])
      await refresh()
    } catch WatchApiClientError.http(_, let code) {
      if let code, WatchContinueCode(rawValue: code) != nil {
        message = "Continue on iPhone"
      } else {
        queue.enqueue(path: path, body: [:], idempotencyKey: key)
        message = "Saved offline"
      }
    } catch {
      queue.enqueue(path: path, body: [:], idempotencyKey: key)
      message = "Saved offline"
    }
  }
}
