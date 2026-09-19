import SwiftUI

@main
struct MaherWatchApp: App {
  @StateObject private var store = WatchStateStore.shared
  @StateObject private var session = WatchSessionManager.shared

  var body: some Scene {
    WindowGroup {
      RootView()
        .environmentObject(store)
        .environmentObject(session)
        .maherWatchChrome()
        .onAppear {
          session.activate()
        }
    }
  }
}
