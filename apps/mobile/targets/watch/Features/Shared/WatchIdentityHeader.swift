import SwiftUI

struct WatchIdentityHeader: View {
  @EnvironmentObject private var store: WatchStateStore
  @EnvironmentObject private var session: WatchSessionManager

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("MAHER")
        .font(.headline.weight(.semibold))
        .foregroundStyle(MaherWatchTheme.accent)
        .tracking(1.2)
      Text(store.context?.displayName ?? "")
        .font(.footnote.weight(.semibold))
        .fixedSize(horizontal: false, vertical: true)
      HStack(spacing: 6) {
        Text(store.context?.displayRole ?? "")
          .font(.caption2.weight(.medium))
          .padding(.horizontal, 6)
          .padding(.vertical, 2)
          .background(MaherWatchTheme.surface, in: Capsule())
        Text(session.isReachable ? "iPhone" : "Offline")
          .font(.caption2)
          .foregroundStyle(MaherWatchTheme.muted)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}
