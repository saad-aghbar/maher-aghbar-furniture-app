import { apiGet } from '../client';

export type AdminHomeUrgentTask = {
  id: string;
  number: string;
  name: string;
  priority: string;
  status: string;
  plannedCompletion: string | null;
  assigneeName: string | null;
};

export type AdminHomeActivity = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  actorName: string | null;
};

export type AdminHomeRecentOrder = {
  id: string;
  number: string;
  status: string;
  title: string;
  imageUrl: string | null;
  customerName: string | null;
  externalOrderNumber: string | null;
  endCustomerName: string | null;
  requiredDeliveryDate?: string | null;
  /** Scheduler-committed date, when a schedule has been approved. */
  committedDeliveryDate?: string | null;
};

export type FloorSpotlightReason = 'late' | 'nearing' | 'in_production';

export type AdminHomeFloorSpotlight = {
  order: AdminHomeRecentOrder;
  reason: FloorSpotlightReason;
  /** How many open orders share this priority bucket (factory scale). */
  peerCount: number;
};

export type AdminHomePayload = {
  newOrders: number;
  ordersInProduction: number;
  ordersNearingDelivery: number;
  completedOrders: number;
  delayedOrders: number;
  openInvoices: number;
  outstandingReceivables: number | string;
  dealersActive: number;
  pendingReturns: number;
  lowStockItems: number;
  recentOrders: AdminHomeRecentOrder[];
  generatedAt: string;
  completedToday: number;
  urgentTasksCount: number;
  urgentTasks: AdminHomeUrgentTask[];
  unreadNotifications: number;
  recentActivity: AdminHomeActivity[] | null;
  /** Priority exemplar from hottest queue — not “newest of recent”. */
  floorSpotlight?: AdminHomeFloorSpotlight | null;
};

export async function getAdminHome(): Promise<AdminHomePayload> {
  return apiGet<AdminHomePayload>('/reports/admin-home');
}

export type DealerHomeOrder = {
  id: string;
  number: string;
  status: string;
  title: string;
  imageUrl: string | null;
  progressPercent: number;
  progressLabel: string;
  externalOrderNumber: string | null;
  endCustomerName: string | null;
  requiredDeliveryDate: string | null;
  requestedDeliveryDate?: string | null;
  suggestedDeliveryDate?: string | null;
  committedDeliveryDate?: string | null;
  projectedDeliveryDate?: string | null;
  plannedDeliveryDate?: string | null;
  actualDeliveryDate?: string | null;
  calendarDate?: string | null;
  customerStatus?: string | null;
};

export type DealerHomeInvoice = {
  id: string;
  number: string;
  status: string;
  total: string;
  outstandingAmount: string;
  issuedAt: string;
  dueDate: string | null;
};

export type DealerHomePayload = {
  activeOrders: number;
  ordersInProduction: number;
  ordersNearingDelivery: number;
  completedOrders: number;
  outstandingBalance: string;
  balanceDueInDays: number | null;
  unreadNotifications: number;
  recentOrders: DealerHomeOrder[];
  recentInvoices: DealerHomeInvoice[];
  generatedAt: string;
};

export async function getDealerHome(): Promise<DealerHomePayload> {
  return apiGet<DealerHomePayload>('/reports/dealer-home');
}

export type WorkerHomeTask = {
  id: string;
  number: string;
  name: string;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
  priority: string;
  status: string;
  orderNumber: string;
  productTitle: string;
  productNameEn?: string | null;
  productNameAr?: string | null;
  productNameHe?: string | null;
  imageUrl: string | null;
  deadline: string | null;
  /** Estimated duration in minutes when known. */
  estimatedMinutes: number | null;
  timing?: {
    status: 'running' | 'stopped' | 'idle' | 'done';
    actualMinutes: number;
    actualSeconds?: number;
    openStartedAt: string | null;
    estimatedMinutes: number | null;
    plannedCompletion: string | null;
    elapsedMinutes: number;
    /** Scheduler allocation start, when this task has been scheduled. */
    plannedStart?: string | null;
  };
};

export type WorkerHomeNotification = {
  id: string;
  title: string;
  body: string;
  titleEn?: string | null;
  titleAr?: string | null;
  bodyEn?: string | null;
  bodyAr?: string | null;
  createdAt: string;
  readAt: string | null;
};

export type WorkerHomePayload = {
  completedTodayCount: number;
  unreadNotifications: number;
  urgentTask: WorkerHomeTask | null;
  todaysTasks: WorkerHomeTask[];
  notifications: WorkerHomeNotification[];
  generatedAt: string;
};

export async function getWorkerHome(): Promise<WorkerHomePayload> {
  return apiGet<WorkerHomePayload>('/reports/worker-home');
}
