import ExpoModulesCore

public class MaherWatchBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MaherWatchBridge")

    OnCreate {
      MaherWatchSession.shared.activate()
    }

    AsyncFunction("publishContext") { (payload: [String: Any]) in
      MaherWatchSession.shared.publishContext(payload)
    }
    .runOnQueue(.main)

    AsyncFunction("publishToken") { (accessToken: String, sessionEpoch: Int) in
      MaherWatchSession.shared.publishToken(accessToken, sessionEpoch: sessionEpoch)
    }
    .runOnQueue(.main)

    AsyncFunction("clear") {
      MaherWatchSession.shared.clear()
    }
    .runOnQueue(.main)
  }
}
