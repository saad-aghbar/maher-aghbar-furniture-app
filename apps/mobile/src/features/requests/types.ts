export type RequestPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type RequestEditLockReason = {
  code: 'ORDER_LOCKED' | 'FABRIC_LOCKED' | string;
  field?: string;
  message: string;
};

export type RequestEditPolicy = {
  serverNow: string;
  submittedAt: string | null;
  editWindowEndsAt: string | null;
  remainingMs: number;
  canEdit: boolean;
  fabricLocked: boolean;
  lockedFields: string[];
  lockReasons: RequestEditLockReason[];
};

export type RequestCustomMeasurement = {
  label: string;
  value: string;
};

export type RequestItem = {
  id?: string;
  productName: string;
  productId?: string | null;
  quantity: number | string;
  unit?: string | null;
  notes?: string | null;
  width?: number | string | null;
  height?: number | string | null;
  depth?: number | string | null;
  material?: string | null;
  fabricType?: string | null;
  fabricColor?: string | null;
  fabric?: string | null;
  color?: string | null;
  description?: string | null;
  customMeasurements?: RequestCustomMeasurement[] | null;
};

export type RequestDocument = {
  id: string;
  fileName: string;
  mimeType?: string | null;
  category?: string | null;
};

export type RequestQuotationLink = {
  id: string;
  number: string;
  status: string;
};

export type RequestCustomer = {
  id: string;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
  code?: string | null;
};

export type RequestDetail = {
  id: string;
  number: string;
  status: string;
  source?: string | null;
  priority?: string;
  title?: string | null;
  projectName?: string | null;
  externalOrderNumber?: string | null;
  contactName?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
  deliveryAddress?: string | null;
  endCustomerName?: string | null;
  endCustomerPhone?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  /** ISO date the dealer requested delivery by. */
  requiredDeliveryDate?: string | null;
  submittedAt?: string | null;
  createdAt: string;
  imageUrl?: string | null;
  customer?: RequestCustomer | null;
  items?: RequestItem[];
  documents?: RequestDocument[];
  quotations?: RequestQuotationLink[];
  editPolicy?: RequestEditPolicy;
};
