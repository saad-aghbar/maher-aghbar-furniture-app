import SwiftUI

struct InspectionView: View {
  let glance: WatchInspectionGlance
  @EnvironmentObject private var store: WatchStateStore
  @StateObject private var queue = WatchOfflineQueue.shared
  @State private var pickingFail = false
  @State private var message: String?
  @State private var busy = false

  private let failCategories = ["FINISH", "JOINERY", "UPHOLSTERY", "DIMENSION", "OTHER"]

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
        Text(glance.productTitle)
          .font(.title3.weight(.semibold))
          .fixedSize(horizontal: false, vertical: true)
        Text(glance.orderNumber)
          .font(.caption)
          .foregroundStyle(MaherWatchTheme.muted)
        if !pickingFail {
          Button("Pass") { Task { await submit(pass: true, category: nil) } }
            .buttonStyle(.borderedProminent)
            .tint(MaherWatchTheme.accent)
            .disabled(busy)
          Button("Fail") { pickingFail = true }
            .buttonStyle(.bordered)
            .tint(MaherWatchTheme.danger)
            .disabled(busy)
        } else {
          Text("Fail category")
            .font(.caption)
            .foregroundStyle(MaherWatchTheme.muted)
          ForEach(failCategories, id: \.self) { category in
            Button(category.capitalized) {
              Task { await submit(pass: false, category: category) }
            }
            .buttonStyle(.borderedProminent)
            .tint(MaherWatchTheme.danger)
            .disabled(busy)
          }
        }
        if let message {
          Text(message)
            .font(.caption2)
            .foregroundStyle(MaherWatchTheme.muted)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  private func submit(pass: Bool, category: String?) async {
    busy = true
    defer { busy = false }
    let key = UUID().uuidString
    var body: [String: String] = [
      "idempotencyKey": key,
      "result": pass ? "PASSED" : "FAILED_REWORK_REQUIRED",
    ]
    if let category { body["defectCategory"] = category }
    guard let client = try? store.apiClient() else {
      queue.enqueue(path: "quality-inspections/\(glance.id)/submit", body: body, idempotencyKey: key)
      message = "Saved offline"
      return
    }
    do {
      try await client.postVoid(
        "quality-inspections/\(glance.id)/submit",
        body: Dictionary(uniqueKeysWithValues: body.map { ($0.key, $0.value as Any) })
      )
      message = pass ? "Passed" : "Failed"
    } catch {
      queue.enqueue(path: "quality-inspections/\(glance.id)/submit", body: body, idempotencyKey: key)
      message = "Saved offline"
    }
  }
}
