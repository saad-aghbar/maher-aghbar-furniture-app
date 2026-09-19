import SwiftUI

struct SessionUnavailableView: View {
  @EnvironmentObject private var store: WatchStateStore
  @EnvironmentObject private var session: WatchSessionManager

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 10) {
        Text("MAHER")
          .font(.headline.weight(.semibold))
          .foregroundStyle(MaherWatchTheme.accent)
          .tracking(1.2)

        Text(title)
          .font(.title3.weight(.semibold))
          .fixedSize(horizontal: false, vertical: true)

        Text(subtitle)
          .font(.footnote)
          .foregroundStyle(MaherWatchTheme.muted)
          .fixedSize(horizontal: false, vertical: true)

        Button {
          session.openOnIPhone()
        } label: {
          Text("Open on iPhone")
            .font(.headline)
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .tint(MaherWatchTheme.accent)
        .padding(.top, 6)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .onAppear {
      session.requestUserContext()
    }
  }

  private var title: String {
    store.sessionState == .unavailable ? "Session unavailable" : "Open Maher on iPhone"
  }

  private var subtitle: String {
    if store.sessionState == .unavailable {
      return "Open Maher on your iPhone."
    }
    return "Open the Maher app on your iPhone to continue."
  }
}
