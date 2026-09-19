import SwiftUI

struct IdentityHomeView: View {
  @EnvironmentObject private var store: WatchStateStore
  @EnvironmentObject private var session: WatchSessionManager

  var body: some View {
    let context = store.context
    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
        Text("MAHER")
          .font(.headline.weight(.semibold))
          .foregroundStyle(MaherWatchTheme.accent)
          .tracking(1.2)

        Text(greeting(locale: context?.locale ?? "en"))
          .font(.footnote)
          .foregroundStyle(MaherWatchTheme.muted)

        Text(context?.displayName ?? "")
          .font(.title3.weight(.semibold))
          .fixedSize(horizontal: false, vertical: true)

        Text(context?.displayRole ?? "")
          .font(.caption.weight(.medium))
          .padding(.horizontal, 8)
          .padding(.vertical, 4)
          .background(MaherWatchTheme.surface, in: Capsule())

        connectionLine
          .font(.caption2)
          .foregroundStyle(MaherWatchTheme.muted)
          .padding(.top, 6)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .onAppear {
      session.requestAccessToken()
    }
  }

  private var connectionLine: some View {
    Group {
      if session.isReachable {
        Text("iPhone connected")
      } else {
        Text("Waiting for iPhone")
      }
    }
  }

  private func greeting(locale: String) -> String {
    let hour = Calendar.current.component(.hour, from: Date())
    let morning = hour < 12
    switch locale {
    case "ar":
      return morning ? "صباح الخير،" : "مساء الخير،"
    case "he":
      return morning ? "בוקר טוב," : "ערב טוב,"
    default:
      return morning ? "Good morning," : "Good evening,"
    }
  }
}
