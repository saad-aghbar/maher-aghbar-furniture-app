import ExpoModulesCore
import UIKit

public class MaherWatchAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    MaherWatchSession.shared.activate()
    return true
  }

  public func subscriberDidRegister() {
    MaherWatchSession.shared.activate()
  }
}
