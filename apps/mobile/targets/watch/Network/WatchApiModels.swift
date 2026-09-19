import Foundation

struct WatchCurrentTask: Codable, Equatable {
  var id: String
  var title: String
  var stageName: String
  var orderNumber: String
  var productTitle: String
  var status: String
  var canStart: Bool
  var canComplete: Bool
}

struct WatchInspectionGlance: Codable, Equatable {
  var id: String
  var orderNumber: String
  var productTitle: String
  var stageCode: String?
}

struct WatchWorkerToday: Codable, Equatable {
  var currentTask: WatchCurrentTask?
  var nextInspection: WatchInspectionGlance?
  var completedToday: Int
  var unreadNotifications: Int
}

struct WatchAlert: Codable, Equatable, Identifiable {
  var id: String
  var title: String
  var kind: String
  var createdAt: String?
}

struct WatchAdminSummary: Codable, Equatable {
  var counts: Counts
  var alerts: [WatchAlert]

  struct Counts: Codable, Equatable {
    var urgentTasks: Int
    var unreadNotifications: Int
    var completedToday: Int
  }
}

struct WatchDealerOrder: Codable, Equatable, Identifiable {
  var id: String
  var number: String
  var status: String
  var title: String
  var customerStatus: String?
  var calendarDate: String?
}

struct WatchDealerOrders: Codable, Equatable {
  var counts: Counts
  var orders: [WatchDealerOrder]

  struct Counts: Codable, Equatable {
    var active: Int
    var inProduction: Int
    var nearingDelivery: Int
    var completed: Int
  }
}

struct WatchApiError: Codable {
  var code: String?
  var message: String?
  var error: Nested?

  struct Nested: Codable {
    var code: String?
    var message: String?
  }

  var resolvedCode: String? { error?.code ?? code }
}

enum WatchContinueCode: String {
  case photos = "PHOTOS_REQUIRED"
  case wipClaim = "WIP_CLAIM_REQUIRED"
  case wipReceive = "WIP_RECEIVE_REQUIRED"
  case wipPieces = "WIP_PIECES_REQUIRED"
  case packages = "PACKAGES_INCOMPLETE"
  case notReleased = "NOT_RELEASED_TO_FACTORY"
  case stageLocked = "STAGE_LOCKED"
  case stock = "INSUFFICIENT_STOCK"

  var label: String {
    switch self {
    case .photos, .packages, .wipClaim, .wipReceive, .wipPieces, .stock:
      return "Continue on iPhone"
    case .notReleased, .stageLocked:
      return "Continue on iPhone"
    }
  }
}
