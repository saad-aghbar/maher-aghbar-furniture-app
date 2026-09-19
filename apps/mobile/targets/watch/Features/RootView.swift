import SwiftUI

struct RootView: View {
  @EnvironmentObject private var store: WatchStateStore

  var body: some View {
    Group {
      if store.sessionState == .active, let context = store.context {
        NavigationStack {
          switch context.surface {
          case .worker:
            WorkerHomeView()
          case .admin:
            AdminHomeView()
          case .dealer:
            DealerHomeView()
          }
        }
      } else {
        SessionUnavailableView()
      }
    }
  }
}
