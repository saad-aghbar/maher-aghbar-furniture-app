import type { Permission } from '@maher/permissions';
import type { AppSurface } from '@maher/permissions';

export type TopicAudience = 'admin' | 'staff' | 'dealer' | 'worker';

export type TopicGroup =
  | 'commercial'
  | 'factory'
  | 'quality'
  | 'delivery'
  | 'inventory'
  | 'purchasing'
  | 'returns'
  | 'finance'
  | 'schedule'
  | 'people';

export type TopicUrgency = 'normal' | 'high' | 'critical';

export type NotificationEntityType =
  | 'request'
  | 'quotation'
  | 'salesOrder'
  | 'productionOrder'
  | 'task'
  | 'qualityInspection'
  | 'delivery'
  | 'returnRequest'
  | 'invoice'
  | 'payment'
  | 'purchaseRequest'
  | 'purchaseOrder'
  | 'inventoryItem'
  | 'fabricJob'
  | 'schedule'
  | 'aiIntake'
  | 'user'
  | 'wip'
  | 'blocker'
  | 'goodsReceipt';

export type LocaleCopy = {
  en: string;
  ar: string;
  he: string;
};

export type TopicDefinition = {
  code: string;
  group: TopicGroup;
  audiences: readonly TopicAudience[];
  /** Staff/worker gate — SYSTEM_ADMINISTRATOR bypasses this. */
  permission?: Permission | readonly Permission[];
  defaultOn: boolean;
  urgency: TopicUrgency;
  entity: NotificationEntityType;
  templateCode: string;
  name: LocaleCopy;
  hint: LocaleCopy;
  /** Lock-screen copy — never interpolate money, rates, or private notes. */
  pushTitle: LocaleCopy;
  pushBody: LocaleCopy;
};

export type RecipientUser = {
  id: string;
  roles: string[];
  permissions: string[];
  customerId?: string | null;
  /** Active floor stage skill codes (CARPENTRY, PACKAGING, DELIVERY, …). */
  stageSkillCodes?: string[];
};

export type NotificationHrefIds = {
  id?: string;
  salesOrderId?: string;
  taskId?: string;
  productionOrderId?: string;
};

export type NotificationOpenInput = {
  surface: AppSurface;
  linkUrl?: string | null;
  topic?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  extras?: NotificationHrefIds;
};

export type NotificationOpenResult = {
  href: string;
  usedFallback: boolean;
};

export type PendingNotificationIntent = {
  notificationId?: string;
  userId?: string;
  linkUrl?: string | null;
  topic?: string | null;
  entityType?: string | null;
  entityId?: string | null;
};

export type AuthBootstrapStatus =
  | 'bootstrapping'
  | 'authenticating'
  | 'needs_biometric'
  | 'authenticated'
  | 'unauthenticated'
  | 'session_expired'
  | 'disabled';

export type DeviceOsPermission = 'granted' | 'denied' | 'undetermined';
