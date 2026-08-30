import type { PdfLocale } from './pdf.util';

type PdfMessages = {
  quotation: string;
  invoice: string;
  paymentReceipt: string;
  contract: string;
  purchaseOrder: string;
  statementOfAccount: string;
  supplierStatement: string;
  inventoryLabel: string;
  customer: string;
  supplier: string;
  status: string;
  currency: string;
  description: string;
  qty: string;
  unitPrice: string;
  lineTotal: string;
  total: string;
  outstanding: string;
  field: string;
  value: string;
  paymentNumber: string;
  amount: string;
  method: string;
  invoiceRef: string;
  reference: string;
  bank: string;
  notes: string;
  appliedToInvoice: string;
  unallocatedPayment: string;
  generated: string;
  date: string;
  ref: string;
  debit: string;
  credit: string;
  balance: string;
  closing: string;
  closingAp: string;
  asOf: string;
  salesOrder: string;
  externalRef: string;
  start: string;
  end: string;
  contractValue: string;
  paymentSchedule: string;
  deliveryMilestones: string;
  warranty: string;
  terms: string;
  warehouse: string;
  orderDate: string;
  subtotal: string;
  tax: string;
  shipping: string;
  sku: string;
  barcode: string;
  qr: string;
  unit: string;
  minStock: string;
  materialType: string;
  color: string;
  size: string;
  supplierBarcode: string;
  onHand: string;
  reserved: string;
  available: string;
  inventoryItemReport: string;
  currentStock: string;
  warehouseBalances: string;
  stockStatus: string;
  statusInStock: string;
  statusLowStock: string;
  statusOutOfStock: string;
  statusInactive: string;
  incomingSupply: string;
  ordered: string;
  received: string;
  remaining: string;
  eta: string;
  recentMovements: string;
  showingLatest: string;
  movementSummary30d: string;
  issued: string;
  transferred: string;
  adjusted: string;
  netChange: string;
  stockCounts: string;
  systemQty: string;
  countedQty: string;
  variance: string;
  productionDemand: string;
  nextRequiredBy: string;
  nextEta: string;
  usedByProducts: string;
  preferredSupplier: string;
  costSummary: string;
  standardCost: string;
  stockValue: string;
  reservedValue: string;
  availableValue: string;
  scanThisItem: string;
  scanThisItemHint: string;
  identification: string;
  active: string;
  inactive: string;
  returns: string;
  productionUsage: string;
  expectedQty: string;
  actualQty: string;
  returnedQty: string;
  scrapQty: string;
  andMore: string;
  category: string;
  maxStock: string;
  labelScanHint: string;
  version: string;
  rfq: string;
  paymentTerms: string;
  deliveryTerms: string;
  discount: string;
  validUntil: string;
  specs: string;
};

const QUOTATION_STATUS: Record<PdfLocale, Record<string, string>> = {
  en: {
    DRAFT: 'Draft',
    INTERNAL_REVIEW: 'Internal review',
    APPROVED: 'Approved',
    SENT: 'Sent to dealer',
    VIEWED: 'Viewed',
    ACCEPTED: 'Accepted by dealer',
    REJECTED: 'Rejected',
    REVISION_REQUESTED: 'Revision requested',
    EXPIRED: 'Expired',
    CANCELLED: 'Cancelled',
  },
  ar: {
    DRAFT: 'مسودة',
    INTERNAL_REVIEW: 'مراجعة داخلية',
    APPROVED: 'معتمد داخلياً',
    SENT: 'مُرسل للتاجر',
    VIEWED: 'تمت المشاهدة',
    ACCEPTED: 'مقبول من التاجر',
    REJECTED: 'مرفوض',
    REVISION_REQUESTED: 'طُلب تعديل',
    EXPIRED: 'منتهي',
    CANCELLED: 'ملغى',
  },
  he: {
    DRAFT: 'טיוטה',
    INTERNAL_REVIEW: 'בדיקה פנימית',
    APPROVED: 'אושר פנימית',
    SENT: 'נשלח לסוחר',
    VIEWED: 'נצפה',
    ACCEPTED: 'התקבל על ידי הסוחר',
    REJECTED: 'נדחה',
    REVISION_REQUESTED: 'נתבקש תיקון',
    EXPIRED: 'פג תוקף',
    CANCELLED: 'בוטל',
  },
};

const EN: PdfMessages = {
  quotation: 'Quotation',
  invoice: 'Invoice',
  paymentReceipt: 'Payment receipt',
  contract: 'Contract',
  purchaseOrder: 'Purchase order',
  statementOfAccount: 'Statement of account',
  supplierStatement: 'Supplier statement',
  inventoryLabel: 'Inventory label',
  customer: 'Customer',
  supplier: 'Supplier',
  status: 'Status',
  currency: 'Currency',
  description: 'Description',
  qty: 'Qty',
  unitPrice: 'Unit price',
  lineTotal: 'Line total',
  total: 'Total',
  outstanding: 'Outstanding',
  field: 'Field',
  value: 'Value',
  paymentNumber: 'Payment number',
  amount: 'Amount',
  method: 'Method',
  invoiceRef: 'Invoice',
  reference: 'Reference',
  bank: 'Bank',
  notes: 'Notes',
  appliedToInvoice: 'Applied to invoice',
  unallocatedPayment: 'Unallocated payment',
  generated: 'Generated',
  date: 'Date',
  ref: 'Ref',
  debit: 'Debit',
  credit: 'Credit',
  balance: 'Balance',
  closing: 'Closing',
  closingAp: 'Closing balance (AP)',
  asOf: 'As of',
  salesOrder: 'Sales order',
  externalRef: 'External ref',
  start: 'Start',
  end: 'End',
  contractValue: 'Contract value',
  paymentSchedule: 'Payment schedule',
  deliveryMilestones: 'Delivery milestones',
  warranty: 'Warranty',
  terms: 'Terms',
  warehouse: 'Warehouse',
  orderDate: 'Order date',
  subtotal: 'Subtotal',
  tax: 'Tax',
  shipping: 'Shipping',
  sku: 'SKU',
  barcode: 'Barcode',
  qr: 'QR',
  unit: 'Unit',
  minStock: 'Min stock',
  materialType: 'Material type',
  color: 'Color',
  size: 'Size',
  supplierBarcode: 'Supplier barcode',
  onHand: 'On hand',
  reserved: 'Reserved',
  available: 'Available',
  inventoryItemReport: 'Inventory Item Report',
  currentStock: 'Current stock',
  warehouseBalances: 'Warehouse balances',
  stockStatus: 'Stock status',
  statusInStock: 'In stock',
  statusLowStock: 'Low stock',
  statusOutOfStock: 'Out of stock',
  statusInactive: 'Inactive',
  incomingSupply: 'Incoming supply',
  ordered: 'Ordered',
  received: 'Received',
  remaining: 'Remaining',
  eta: 'ETA',
  recentMovements: 'Recent inventory movements',
  showingLatest: 'Showing latest',
  movementSummary30d: 'Last 30 days',
  issued: 'Issued',
  transferred: 'Transferred',
  adjusted: 'Adjusted',
  netChange: 'Net change',
  stockCounts: 'Stock counts',
  systemQty: 'System qty',
  countedQty: 'Counted qty',
  variance: 'Variance',
  productionDemand: 'Production demand',
  nextRequiredBy: 'Next required by',
  nextEta: 'Next ETA',
  usedByProducts: 'Used by products',
  preferredSupplier: 'Preferred supplier',
  costSummary: 'Cost summary',
  standardCost: 'Standard cost',
  stockValue: 'Stock value',
  reservedValue: 'Reserved value',
  availableValue: 'Available value',
  scanThisItem: 'Scan this item',
  scanThisItemHint: 'Scan this code in Inventory to open this item.',
  identification: 'Identification',
  active: 'Active',
  inactive: 'Inactive',
  returns: 'Returns',
  productionUsage: 'Production material usage',
  expectedQty: 'Expected',
  actualQty: 'Actual',
  returnedQty: 'Returned',
  scrapQty: 'Scrap',
  andMore: 'and more',
  category: 'Category',
  maxStock: 'Maximum stock',
  labelScanHint: 'Scan barcode / QR at warehouse stations',
  version: 'Version',
  rfq: 'Request',
  paymentTerms: 'Payment terms',
  deliveryTerms: 'Delivery terms',
  discount: 'Discount',
  validUntil: 'Valid until',
  specs: 'Specifications',
};

const AR: PdfMessages = {
  quotation: 'عرض سعر',
  invoice: 'فاتورة',
  paymentReceipt: 'إيصال دفع',
  contract: 'عقد',
  purchaseOrder: 'أمر شراء',
  statementOfAccount: 'كشف حساب',
  supplierStatement: 'كشف حساب مورد',
  inventoryLabel: 'ملصق مخزون',
  customer: 'التاجر',
  supplier: 'المورد',
  status: 'الحالة',
  currency: 'العملة',
  description: 'الوصف',
  qty: 'الكمية',
  unitPrice: 'سعر الوحدة',
  lineTotal: 'الإجمالي',
  total: 'المجموع',
  outstanding: 'المتبقي',
  field: 'الحقل',
  value: 'القيمة',
  paymentNumber: 'رقم الدفعة',
  amount: 'المبلغ',
  method: 'الطريقة',
  invoiceRef: 'الفاتورة',
  reference: 'المرجع',
  bank: 'البنك',
  notes: 'ملاحظات',
  appliedToInvoice: 'مطبّق على الفاتورة',
  unallocatedPayment: 'دفعة غير مخصصة',
  generated: 'تاريخ الإنشاء',
  date: 'التاريخ',
  ref: 'المرجع',
  debit: 'مدين',
  credit: 'دائن',
  balance: 'الرصيد',
  closing: 'الرصيد الختامي',
  closingAp: 'رصيد الإغلاق (ذمم)',
  asOf: 'حتى تاريخ',
  salesOrder: 'الطلبية',
  externalRef: 'مرجع خارجي',
  start: 'البداية',
  end: 'النهاية',
  contractValue: 'قيمة العقد',
  paymentSchedule: 'جدول الدفع',
  deliveryMilestones: 'مراحل التسليم',
  warranty: 'الضمان',
  terms: 'الشروط',
  warehouse: 'المستودع',
  orderDate: 'تاريخ الطلب',
  subtotal: 'المجموع الفرعي',
  tax: 'الضريبة',
  shipping: 'الشحن',
  sku: 'رمز الصنف',
  barcode: 'الباركود',
  qr: 'رمز QR',
  unit: 'الوحدة',
  minStock: 'الحد الأدنى',
  materialType: 'نوع المادة',
  color: 'اللون',
  size: 'المقاس',
  supplierBarcode: 'باركود المورد',
  onHand: 'الرصيد',
  reserved: 'المحجوز',
  available: 'المتاح',
  inventoryItemReport: 'تقرير صنف المخزون',
  currentStock: 'المخزون الحالي',
  warehouseBalances: 'أرصدة المستودعات',
  stockStatus: 'حالة المخزون',
  statusInStock: 'متوفر',
  statusLowStock: 'منخفض',
  statusOutOfStock: 'نافد',
  statusInactive: 'غير نشط',
  incomingSupply: 'التوريد الوارد',
  ordered: 'المطلوب',
  received: 'المستلم',
  remaining: 'المتبقي',
  eta: 'موعد التوريد',
  recentMovements: 'أحدث حركات المخزون',
  showingLatest: 'عرض أحدث',
  movementSummary30d: 'آخر 30 يوماً',
  issued: 'المنصرف',
  transferred: 'المنقول',
  adjusted: 'التسويات',
  netChange: 'صافي التغيير',
  stockCounts: 'جرد المخزون',
  systemQty: 'كمية النظام',
  countedQty: 'الكمية المعدودة',
  variance: 'الفرق',
  productionDemand: 'طلب الإنتاج',
  nextRequiredBy: 'مطلوب بحلول',
  nextEta: 'أقرب توريد',
  usedByProducts: 'يُستخدم في المنتجات',
  preferredSupplier: 'المورد المفضل',
  costSummary: 'ملخص التكلفة',
  standardCost: 'التكلفة المعيارية',
  stockValue: 'قيمة المخزون',
  reservedValue: 'قيمة المحجوز',
  availableValue: 'قيمة المتاح',
  scanThisItem: 'امسح هذا الصنف',
  scanThisItemHint: 'امسح هذا الرمز في المخزون لفتح الصنف.',
  identification: 'التعريف',
  active: 'نشط',
  inactive: 'غير نشط',
  returns: 'المرتجعات',
  productionUsage: 'استهلاك مواد الإنتاج',
  expectedQty: 'المتوقع',
  actualQty: 'الفعلي',
  returnedQty: 'المرتجع',
  scrapQty: 'الهدر',
  andMore: 'والمزيد',
  category: 'الفئة',
  maxStock: 'الحد الأقصى',
  labelScanHint: 'امسح الرمز في المستودع',
  version: 'الإصدار',
  rfq: 'الطلب',
  paymentTerms: 'شروط الدفع',
  deliveryTerms: 'شروط التسليم',
  discount: 'الخصم',
  validUntil: 'صالح حتى',
  specs: 'المواصفات',
};

const HE: PdfMessages = {
  quotation: 'הצעת מחיר',
  invoice: 'חשבונית',
  paymentReceipt: 'קבלת תשלום',
  contract: 'חוזה',
  purchaseOrder: 'הזמנת רכש',
  statementOfAccount: 'דף חשבון',
  supplierStatement: 'דף חשבון ספק',
  inventoryLabel: 'תווית מלאי',
  customer: 'לקוח',
  supplier: 'ספק',
  status: 'סטטוס',
  currency: 'מטבע',
  description: 'תיאור',
  qty: 'כמות',
  unitPrice: 'מחיר יחידה',
  lineTotal: 'סה״כ שורה',
  total: 'סה״כ',
  outstanding: 'יתרה',
  field: 'שדה',
  value: 'ערך',
  paymentNumber: 'מספר תשלום',
  amount: 'סכום',
  method: 'אמצעי',
  invoiceRef: 'חשבונית',
  reference: 'אסמכתא',
  bank: 'בנק',
  notes: 'הערות',
  appliedToInvoice: 'הוחל על חשבונית',
  unallocatedPayment: 'תשלום לא משויך',
  generated: 'נוצר',
  date: 'תאריך',
  ref: 'אסמכתא',
  debit: 'חובה',
  credit: 'זכות',
  balance: 'יתרה',
  closing: 'סגירה',
  closingAp: 'יתרת סגירה (ספקים)',
  asOf: 'נכון ל־',
  salesOrder: 'הזמנת מכירה',
  externalRef: 'מס׳ חיצוני',
  start: 'התחלה',
  end: 'סיום',
  contractValue: 'ערך החוזה',
  paymentSchedule: 'לוח תשלומים',
  deliveryMilestones: 'אבני דרך למשלוח',
  warranty: 'אחריות',
  terms: 'תנאים',
  warehouse: 'מחסן',
  orderDate: 'תאריך הזמנה',
  subtotal: 'סכום ביניים',
  tax: 'מס',
  shipping: 'משלוח',
  sku: 'מק״ט',
  barcode: 'ברקוד',
  qr: 'QR',
  unit: 'יחידה',
  minStock: 'מלאי מינ׳',
  materialType: 'סוג חומר',
  color: 'צבע',
  size: 'מידה',
  supplierBarcode: 'ברקוד ספק',
  onHand: 'במלאי',
  reserved: 'שמור',
  available: 'זמין',
  inventoryItemReport: 'דוח פריט מלאי',
  currentStock: 'מלאי נוכחי',
  warehouseBalances: 'יתרות מחסן',
  stockStatus: 'סטטוס מלאי',
  statusInStock: 'במלאי',
  statusLowStock: 'מלאי נמוך',
  statusOutOfStock: 'אזל',
  statusInactive: 'לא פעיל',
  incomingSupply: 'אספקה נכנסת',
  ordered: 'הוזמן',
  received: 'התקבל',
  remaining: 'נותר',
  eta: 'ETA',
  recentMovements: 'תנועות מלאי אחרונות',
  showingLatest: 'מציג אחרונים',
  movementSummary30d: '30 הימים האחרונים',
  issued: 'נופק',
  transferred: 'הועבר',
  adjusted: 'התאמות',
  netChange: 'שינוי נטו',
  stockCounts: 'ספירות מלאי',
  systemQty: 'כמות מערכת',
  countedQty: 'כמות שנספרה',
  variance: 'הפרש',
  productionDemand: 'ביקוש ייצור',
  nextRequiredBy: 'נדרש עד',
  nextEta: 'ETA הבא',
  usedByProducts: 'בשימוש במוצרים',
  preferredSupplier: 'ספק מועדף',
  costSummary: 'סיכום עלות',
  standardCost: 'עלות תקן',
  stockValue: 'ערך מלאי',
  reservedValue: 'ערך שמור',
  availableValue: 'ערך זמין',
  scanThisItem: 'סרוק פריט זה',
  scanThisItemHint: 'סרוק קוד זה במלאי כדי לפתוח את הפריט.',
  identification: 'זיהוי',
  active: 'פעיל',
  inactive: 'לא פעיל',
  returns: 'החזרות',
  productionUsage: 'צריכת חומרי ייצור',
  expectedQty: 'צפוי',
  actualQty: 'בפועל',
  returnedQty: 'הוחזר',
  scrapQty: 'פסולת',
  andMore: 'ועוד',
  category: 'קטגוריה',
  maxStock: 'מלאי מקסימלי',
  labelScanHint: 'סרוק את הקוד במחסן',
  version: 'גרסה',
  rfq: 'בקשה',
  paymentTerms: 'תנאי תשלום',
  deliveryTerms: 'תנאי אספקה',
  discount: 'הנחה',
  validUntil: 'בתוקף עד',
  specs: 'מפרטים',
};

const MAP: Record<PdfLocale, PdfMessages> = { en: EN, ar: AR, he: HE };

export function pdfMessages(locale: PdfLocale): PdfMessages {
  return MAP[locale] ?? EN;
}

export function localizedQuotationStatus(locale: PdfLocale, status: string): string {
  return QUOTATION_STATUS[locale]?.[status] ?? QUOTATION_STATUS.en[status] ?? status;
}

export function localizedName(
  locale: PdfLocale,
  entity: {
    name?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
  },
): string {
  if (locale === 'ar') {
    return entity.nameAr || entity.name || entity.nameEn || '—';
  }
  if (locale === 'he') {
    return entity.nameHe || entity.name || entity.nameEn || entity.nameAr || '—';
  }
  return entity.nameEn || entity.name || entity.nameAr || '—';
}
