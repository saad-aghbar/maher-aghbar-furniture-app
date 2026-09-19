export type WatchContinueCode =
  | 'PHOTOS_REQUIRED'
  | 'WIP_CLAIM_REQUIRED'
  | 'WIP_RECEIVE_REQUIRED'
  | 'WIP_PIECES_REQUIRED'
  | 'PACKAGES_INCOMPLETE'
  | 'NOT_RELEASED_TO_FACTORY'
  | 'STAGE_LOCKED'
  | 'INSUFFICIENT_STOCK';

export type WatchCurrentTask = {
  id: string;
  title: string;
  stageName: string;
  orderNumber: string;
  productTitle: string;
  status: string;
  canStart: boolean;
  canComplete: boolean;
};

export type WatchInspectionGlance = {
  id: string;
  orderNumber: string;
  productTitle: string;
  stageCode: string | null;
};

export type WatchWorkerToday = {
  currentTask: WatchCurrentTask | null;
  nextInspection: WatchInspectionGlance | null;
  completedToday: number;
  unreadNotifications: number;
};

export type WatchAlert = {
  id: string;
  title: string;
  kind: 'notification' | 'task' | 'quality';
  createdAt: string | null;
};

export type WatchAdminSummary = {
  counts: {
    urgentTasks: number;
    unreadNotifications: number;
    completedToday: number;
  };
  alerts: WatchAlert[];
};

export type WatchDealerOrder = {
  id: string;
  number: string;
  status: string;
  title: string;
  customerStatus: string | null;
  calendarDate: string | null;
};

export type WatchDealerOrders = {
  counts: {
    active: number;
    inProduction: number;
    nearingDelivery: number;
    completed: number;
  };
  orders: WatchDealerOrder[];
};
