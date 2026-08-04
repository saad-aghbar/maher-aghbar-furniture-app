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

export type Currency = 'JOD';

export const DEFAULT_CURRENCY: Currency = 'JOD';

export interface AuthUser {
  id: string;
  /** Login identifier — required for all active users. */
  username: string;
  email: string;
  phone?: string;
  name: string;
  roles: string[];
  /** Permission codes from `@maher/permissions` (e.g. `catalog.read`). */
  permissions: string[];
  preferredLanguage: Locale;
  customerId?: string;
}

export type UserStatus = 'ACTIVE' | 'INVITED' | 'LOCKED' | 'ARCHIVED';

export type CustomerType = 'INDIVIDUAL' | 'COMPANY' | 'SHOWROOM';

export type RfqStatus = 'OPEN' | 'SUBMITTED' | 'QUOTED' | 'CLOSED' | 'CANCELLED';

export type QuotationStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SENT'
  | 'ACCEPTED'
  | 'CONVERTED'
  | 'REJECTED'
  | 'EXPIRED';

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
  | 'RECEIPT'
  | 'ISSUE'
  | 'TRANSFER'
  | 'ADJUST'
  | 'COUNT';

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
