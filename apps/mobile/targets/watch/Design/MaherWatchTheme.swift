import SwiftUI

enum MaherWatchTheme {
  static let background = Color(red: 0.07, green: 0.07, blue: 0.06)
  static let surface = Color(red: 0.13, green: 0.12, blue: 0.10)
  static let parchment = Color(red: 0.88, green: 0.87, blue: 0.83)
  static let accent = Color(red: 0.77, green: 0.65, blue: 0.45)
  static let muted = Color(red: 0.62, green: 0.60, blue: 0.55)
  static let danger = Color(red: 0.78, green: 0.32, blue: 0.28)
}

struct MaherWatchChrome: ViewModifier {
  func body(content: Content) -> some View {
    content
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(MaherWatchTheme.background.ignoresSafeArea())
      .foregroundStyle(MaherWatchTheme.parchment)
  }
}

extension View {
  func maherWatchChrome() -> some View {
    modifier(MaherWatchChrome())
  }
}
