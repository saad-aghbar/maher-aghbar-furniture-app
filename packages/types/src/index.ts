export type ApiErrorCode = string;

export interface ApiFieldError {
  field: string;
  code: string;
  message: string;
}

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]> | ApiFieldError[];
  requestId?: string | null;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export type Locale = 'ar' | 'en' | 'he';

export type Direction = 'ltr' | 'rtl';

export const LOCALE_DIRECTION: Record<Locale, Direction> = {
  ar: 'rtl',
  en: 'ltr',
  he: 'rtl',
};

export type Currency = 'ILS';

export const DEFAULT_CURRENCY: Currency = 'ILS';

export interface AuthRoleDetail {
  code: string;
  kind: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
}

export interface AuthUser {
  id: string;
  /** Login identifier — required for all active users. */
  username: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  name: string;
  roles: string[];
  /** Display names for assigned roles / staff types (optional on older sessions). */
  rolesDetailed?: AuthRoleDetail[];
  /** Permission codes from `@maher/permissions` (e.g. `catalog.read`). */
  permissions: string[];
  /**
   * Active floor stage skill codes (e.g. CARPENTRY, DELIVERY).
   * Used to switch worker surfaces (tasks vs delivery load sheet).
   */
  stageSkillCodes?: string[];
  preferredLanguage: Locale;
  customerId?: string;
}

export type UserStatus = 'ACTIVE' | 'INVITED' | 'LOCKED' | 'ARCHIVED';

export type CustomerType = 'INDIVIDUAL' | 'COMPANY' | 'SHOWROOM';

export type RfqStatus = 'OPEN' | 'SUBMITTED' | 'QUOTED' | 'CLOSED' | 'CANCELLED';

export type QuotationStatus =
  | 'DRAFT'
  | 'INTERNAL_REVIEW'
  | 'APPROVED'
  | 'SENT'
  | 'VIEWED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'REVISION_REQUESTED'
  | 'EXPIRED'
  | 'CANCELLED';

export type SalesOrderStatus =
  | 'CONFIRMED'
  | 'IN_PRODUCTION'
  | 'READY_FOR_DELIVERY'
  | 'DELIVERED'
  | 'INVOICED'
  | 'CLOSED'
  | 'CANCELLED';

export type ProductionOrderStatus = 'PLANNED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED';

export type ProductionTaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'BLOCKED'
  | 'COMPLETED';

export type QualityInspectionResult = 'PASS' | 'FAIL' | 'REWORK';

export type QualityInspectionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export type DeliveryStatus = 'SCHEDULED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export type PurchaseRequestStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'ORDERED';

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SENT'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD';

export type InventoryTransactionType =
  | 'PURCHASE_RECEIPT'
  | 'PRODUCTION_ISSUE'
  | 'PRODUCTION_RETURN'
  | 'WAREHOUSE_TRANSFER'
  | 'INVENTORY_ADJUSTMENT'
  | 'CUSTOMER_RETURN'
  | 'FINISHED_GOODS_RECEIPT'
  | 'DELIVERY_ISSUE'
  | 'DELIVERY_RESTORE'
  | 'DAMAGE'
  | 'SCRAP'
  | 'SEMI_FINISHED_RECEIPT'
  | 'SEMI_FINISHED_ISSUE'
  | 'OPENING_BALANCE';

export type AiExtractionJobStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'FAILED';

export interface FurnitureDimensions {
  widthCm: number;
  depthCm: number;
  heightCm: number;
}

export type {
  WorkflowGraphAdminDTO,
  WorkflowGraphAssigneeDTO,
  WorkflowGraphBlockerDTO,
  WorkflowGraphDealerDTO,
  WorkflowGraphDTO,
  WorkflowGraphEdgeDTO,
  WorkflowGraphNodeAdminDTO,
  WorkflowGraphNodeBaseDTO,
  WorkflowGraphNodeDealerDTO,
  WorkflowGraphNodeStatus,
} from './workflow-graph';

export { isWorkflowGraphAdminDTO } from './workflow-graph';

export {
  inventoryScanPayload,
  parseWipScanCode,
  printableScanCode,
  WIP_KIT_QR_PREFIX,
  WIP_PIECE_QR_PREFIX,
  wipKitScanPayload,
  wipPieceScanPayload,
} from './scan-code';

export {
  OPENING_STAGE_CODE,
  LOCKED_ANCHOR_STAGE_CODES,
  TERMINAL_STAGE_CODES,
  classifyDealerLifecycle,
  dealerLifecycleLabelKey,
  isConfirmReceiptVisible,
  isLockedAnchorStageCode,
  isLogisticsStage,
  isOpeningStageCode,
  isTerminalStageCode,
  mapConfirmReceiptErrorCode,
  type DealerLifecycleInput,
  type DealerLifecycleTab,
  type LockedAnchorStageCode,
  type OpeningStageCode,
  type TerminalStageCode,
} from './dealer-lifecycle';

export {
  classifyManufacturingComplexity,
  parseManufacturingComplexity,
  rollupOrderType,
  emptyOrderTypeCounts,
  manufacturingComplexityToTypeSlug,
  tallyOrderTypeCounts,
  manufacturingComplexityDisplayKey,
  buildOrderLineSpecSnapshot,
  normalizeOrderMeasurements,
  buildCatalogDiff,
  type ManufacturingComplexityCode,
  type CatalogDimRef,
  type OrderLineClassifyInput,
  type OrderLineSpecSnapshot,
  type OrderMeasurement,
  type CatalogDiffRow,
  type OrderTypeLineInput,
  type OrderTypeSlug,
  type OrderTypeCounts,
} from './manufacturing-complexity';

export {
  normalizeOrderFabrics,
  primaryFabric,
  fabricLabelFromSelection,
  fabricSelectionsLabel,
  emptyFabricSelection,
  type OrderFabricSelection,
} from './fabric-selection';

export {
  mapOrderPresentation,
  orderPresentationLabelKey,
  requestStatusesForGroup,
  classifyRequestInboxChip,
  emptyRequestInboxCounts,
  tallyRequestInboxCounts,
  appendReviewHistory,
  type OrderPresentationKey,
  type OrderPresentationInput,
  type RequestStatusGroup,
  type RequestInboxChip,
  type RequestInboxCounts,
  type ReviewHistoryEntry,
} from './order-presentation';
