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
  factoryDelivery: string;
  discount: string;
  validUntil: string;
  specs: string;
  rawMaterials: RawMaterialsPdfMessages;
};

type RawMaterialsPdfMessages = {
  title: string;
  executiveSummary: string;
  period: string;
  generatedAt: string;
  generatedBy: string;
  timezone: string;
  costBasis: string;
  auditedMovement: string;
  stockValueCurrentCost: string;
  valuationIncomplete: string;
  skuCount: string;
  lowStockCount: string;
  outOfStockCount: string;
  receiptLines: string;
  issueLines: string;
  corrections: string;
  countDocuments: string;
  purchasesValue: string;
  consumptionValue: string;
  returnValue: string;
  openingValue: string;
  closingValue: string;
  categorySummary: string;
  warehouseSummary: string;
  fabric: string;
  foam: string;
  wood: string;
  accessories: string;
  purchases: string;
  topSuppliers: string;
  grnPo: string;
  material: string;
  value: string;
  productionConsumption: string;
  topMaterials: string;
  plannedVsActual: string;
  planned: string;
  actual: string;
  difference: string;
  scrapBreakdown: string;
  scrapIncluded: string;
  reason: string;
  adjustments: string;
  countCorrection: string;
  otherAdjustment: string;
  significantVariances: string;
  managementAttention: string;
  perSkuAppendix: string;
  quantityIdentity: string;
  residualCheck: string;
  residualOk: string;
  residualMismatch: string;
  movementLedger: string;
  showingOf: string;
  none: string;
  opening: string;
  returned: string;
  scrap: string;
  transferIn: string;
  transferOut: string;
  reservedCurrent: string;
  freeCurrent: string;
  residual: string;
  fromWarehouse: string;
  toWarehouse: string;
  type: string;
  user: string;
  worker: string;
  stage: string;
  task: string;
  mixedUnits: string;
  incompleteList: string;
  demand: string;
  required: string;
  incoming: string;
  currentNote: string;
  page: string;
  inbound: string;
  outbound: string;
  receipts: string;
  supplierCount: string;
};

const QUOTATION_STATUS: Record<PdfLocale, Record<string, string>> = {
  en: {
    DRAFT: 'Draft',
    INTERNAL_REVIEW: 'Ready to send',
    APPROVED: 'Ready to send',
    SENT: 'Sent / Waiting for dealer',
    VIEWED: 'Sent / Waiting for dealer',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected',
    REVISION_REQUESTED: 'Revision requested',
    EXPIRED: 'Expired',
    CANCELLED: 'Cancelled',
  },
  ar: {
    DRAFT: 'مسودة',
    INTERNAL_REVIEW: 'جاهز للإرسال',
    APPROVED: 'جاهز للإرسال',
    SENT: 'مُرسل / بانتظار التاجر',
    VIEWED: 'مُرسل / بانتظار التاجر',
    ACCEPTED: 'مقبول',
    REJECTED: 'مرفوض',
    REVISION_REQUESTED: 'طُلب تعديل',
    EXPIRED: 'منتهي',
    CANCELLED: 'ملغى',
  },
  he: {
    DRAFT: 'טיוטה',
    INTERNAL_REVIEW: 'מוכן לשליחה',
    APPROVED: 'מוכן לשליחה',
    SENT: 'נשלח / ממתין לסוחר',
    VIEWED: 'נשלח / ממתין לסוחר',
    ACCEPTED: 'התקבל',
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
  factoryDelivery: 'Factory delivery',
  discount: 'Discount',
  validUntil: 'Valid until',
  specs: 'Specifications',
  rawMaterials: {
    title: 'Raw Materials Management Report',
    executiveSummary: 'Executive summary',
    period: 'Period',
    generatedAt: 'Generated at',
    generatedBy: 'Generated by',
    timezone: 'Factory timezone',
    costBasis: 'Cost basis',
    auditedMovement: 'Audited movement value (rows with unit cost)',
    stockValueCurrentCost: 'Stock value at current cost basis',
    valuationIncomplete: 'Valuation incomplete',
    skuCount: 'SKUs',
    lowStockCount: 'Low stock',
    outOfStockCount: 'Out of stock',
    receiptLines: 'Receipt rows',
    issueLines: 'Issue rows',
    corrections: 'Corrections',
    countDocuments: 'Stock counts',
    purchasesValue: 'Purchases (audited)',
    consumptionValue: 'Consumption (audited)',
    returnValue: 'Returns (audited)',
    openingValue: 'Opening value (current cost)',
    closingValue: 'Closing value (current cost)',
    categorySummary: 'Category summary',
    warehouseSummary: 'RAW warehouse summary',
    fabric: 'Fabric',
    foam: 'Foam',
    wood: 'Wood',
    accessories: 'Accessories',
    purchases: 'Purchases',
    topSuppliers: 'Top suppliers',
    grnPo: 'GRN · PO',
    material: 'Material',
    value: 'Value',
    productionConsumption: 'Production consumption',
    topMaterials: 'Top materials by cost',
    plannedVsActual: 'Planned vs actual',
    planned: 'Planned',
    actual: 'Actual',
    difference: 'Difference',
    scrapBreakdown: 'Scrap (included in issues)',
    scrapIncluded: 'Scrap quantities are already inside production issues — not a second outflow.',
    reason: 'Reason',
    adjustments: 'Adjustments',
    countCorrection: 'Count correction',
    otherAdjustment: 'Other adjustment',
    significantVariances: 'Significant count variances',
    managementAttention: 'Management attention',
    perSkuAppendix: 'Per-SKU quantity identity',
    quantityIdentity: 'Opening + inbound − outbound ± adjustments = closing',
    residualCheck: 'Residual check',
    residualOk: 'All SKUs reconcile (residual 0).',
    residualMismatch: 'Residual is not zero — ledger and closing do not match.',
    movementLedger: 'Movement ledger',
    showingOf: 'Showing {shown} of {total} movements',
    none: 'None in this period.',
    opening: 'Opening',
    returned: 'Returned',
    scrap: 'Scrap',
    transferIn: 'Transfer in',
    transferOut: 'Transfer out',
    reservedCurrent: 'Reserved (current)',
    freeCurrent: 'Free (current)',
    residual: 'Residual',
    fromWarehouse: 'From',
    toWarehouse: 'To',
    type: 'Type',
    user: 'User',
    worker: 'Worker',
    stage: 'Stage',
    task: 'Task',
    mixedUnits: 'Mixed units — quantities not totalled',
    incompleteList: 'Incomplete valuation',
    demand: 'Orders waiting on material',
    required: 'Required',
    incoming: 'Incoming',
    currentNote: 'Reserved and free are current balances, not period-end.',
    page: 'Page {page} of {total}',
    inbound: 'Inbound',
    outbound: 'Outbound',
    receipts: 'Receipts',
    supplierCount: 'Materials',
  },
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
  factoryDelivery: 'تسليم المصنع',
  discount: 'الخصم',
  validUntil: 'صالح حتى',
  specs: 'المواصفات',
  rawMaterials: {
    title: 'تقرير إدارة المواد الخام',
    executiveSummary: 'الملخص التنفيذي',
    period: 'الفترة',
    generatedAt: 'تاريخ الإنشاء',
    generatedBy: 'أعدّه',
    timezone: 'توقيت المصنع',
    costBasis: 'أساس التكلفة',
    auditedMovement: 'قيمة الحركات المدققة (صفوف عليها تكلفة وحدة)',
    stockValueCurrentCost: 'قيمة المخزون حسب التكلفة الحالية',
    valuationIncomplete: 'تقييم ناقص',
    skuCount: 'الأصناف',
    lowStockCount: 'مخزون منخفض',
    outOfStockCount: 'نافد',
    receiptLines: 'صفوف الاستلام',
    issueLines: 'صفوف الصرف',
    corrections: 'التسويات',
    countDocuments: 'وثائق الجرد',
    purchasesValue: 'المشتريات (مدققة)',
    consumptionValue: 'الاستهلاك (مدقّق)',
    returnValue: 'المرتجعات (مدققة)',
    openingValue: 'قيمة الافتتاح (تكلفة حالية)',
    closingValue: 'قيمة الإغلاق (تكلفة حالية)',
    categorySummary: 'ملخص الفئات',
    warehouseSummary: 'ملخص مستودعات المواد الخام',
    fabric: 'قماش',
    foam: 'إسفنج',
    wood: 'خشب',
    accessories: 'إكسسوارات',
    purchases: 'المشتريات',
    topSuppliers: 'أكبر الموردين',
    grnPo: 'سند استلام · أمر شراء',
    material: 'المادة',
    value: 'القيمة',
    productionConsumption: 'استهلاك الإنتاج',
    topMaterials: 'أعلى المواد تكلفة',
    plannedVsActual: 'المخطط مقابل الفعلي',
    planned: 'المخطط',
    actual: 'الفعلي',
    difference: 'الفرق',
    scrapBreakdown: 'الهدر (ضمن الصرف)',
    scrapIncluded: 'كميات الهدر داخل صرف الإنتاج وليست خروجاً منفصلاً.',
    reason: 'السبب',
    adjustments: 'التسويات',
    countCorrection: 'تصحيح جرد',
    otherAdjustment: 'تسوية أخرى',
    significantVariances: 'فروقات جرد جوهرية',
    managementAttention: 'يحتاج انتباه الإدارة',
    perSkuAppendix: 'مطابقة الكمية لكل صنف',
    quantityIdentity: 'الافتتاح + الوارد − الصادر ± التسويات = الإغلاق',
    residualCheck: 'فحص المتبقي',
    residualOk: 'كل الأصناف متطابقة (المتبقي صفر).',
    residualMismatch: 'المتبقي ليس صفراً — الدفتر لا يطابق الإغلاق.',
    movementLedger: 'دفتر الحركات',
    showingOf: 'عرض {shown} من {total} حركة',
    none: 'لا شيء في هذه الفترة.',
    opening: 'افتتاح',
    returned: 'مرتجع',
    scrap: 'هدر',
    transferIn: 'تحويل وارد',
    transferOut: 'تحويل صادر',
    reservedCurrent: 'محجوز (حالي)',
    freeCurrent: 'حر (حالي)',
    residual: 'المتبقي',
    fromWarehouse: 'من',
    toWarehouse: 'إلى',
    type: 'النوع',
    user: 'المستخدم',
    worker: 'العامل',
    stage: 'المرحلة',
    task: 'المهمة',
    mixedUnits: 'وحدات مختلطة — لا يُجمع الكمية',
    incompleteList: 'تقييم ناقص',
    demand: 'أوامر تنتظر مادة',
    required: 'مطلوب',
    incoming: 'وارد',
    currentNote: 'المحجوز والحر أرصدة حالية وليست نهاية الفترة.',
    page: 'صفحة {page} من {total}',
    inbound: 'وارد',
    outbound: 'صادر',
    receipts: 'سندات',
    supplierCount: 'مواد',
  },
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
  factoryDelivery: 'אספקת המפעל',
  discount: 'הנחה',
  validUntil: 'בתוקף עד',
  specs: 'מפרטים',
  rawMaterials: {
    title: 'דוח ניהול חומרי גלם',
    executiveSummary: 'סיכום הנהלה',
    period: 'תקופה',
    generatedAt: 'נוצר ב־',
    generatedBy: 'הופק על ידי',
    timezone: 'אזור זמן המפעל',
    costBasis: 'בסיס עלות',
    auditedMovement: 'ערך תנועות מבוקר (שורות עם עלות יחידה)',
    stockValueCurrentCost: 'ערך מלאי לפי בסיס עלות נוכחי',
    valuationIncomplete: 'הערכה חלקית',
    skuCount: 'מק״טים',
    lowStockCount: 'מלאי נמוך',
    outOfStockCount: 'אזל',
    receiptLines: 'שורות קבלה',
    issueLines: 'שורות ניפוק',
    corrections: 'תיקונים',
    countDocuments: 'ספירות מלאי',
    purchasesValue: 'רכש (מבוקר)',
    consumptionValue: 'צריכה (מבוקרת)',
    returnValue: 'החזרות (מבוקרות)',
    openingValue: 'ערך פתיחה (עלות נוכחית)',
    closingValue: 'ערך סגירה (עלות נוכחית)',
    categorySummary: 'סיכום קטגוריות',
    warehouseSummary: 'סיכום מחסני גלם',
    fabric: 'בד',
    foam: 'ספוג',
    wood: 'עץ',
    accessories: 'אביזרים',
    purchases: 'רכש',
    topSuppliers: 'ספקים מובילים',
    grnPo: 'קבלה · הזמנת רכש',
    material: 'חומר',
    value: 'ערך',
    productionConsumption: 'צריכת ייצור',
    topMaterials: 'חומרים לפי עלות',
    plannedVsActual: 'תכנון מול בפועל',
    planned: 'תכנון',
    actual: 'בפועל',
    difference: 'הפרש',
    scrapBreakdown: 'פסולת (כלולה בניפוק)',
    scrapIncluded: 'כמויות הפסולת כבר כלולות בניפוק לייצור — לא יציאה נפרדת.',
    reason: 'סיבה',
    adjustments: 'התאמות',
    countCorrection: 'תיקון ספירה',
    otherAdjustment: 'התאמה אחרת',
    significantVariances: 'סטיות ספירה מהותיות',
    managementAttention: 'דורש תשומת לב',
    perSkuAppendix: 'זהות כמות לפי מק״ט',
    quantityIdentity: 'פתיחה + כניסה − יציאה ± התאמות = סגירה',
    residualCheck: 'בדיקת יתרה',
    residualOk: 'כל המק״טים מתאזנים (יתרה 0).',
    residualMismatch: 'היתרה אינה אפס — הספר והסגירה אינם תואמים.',
    movementLedger: 'יומן תנועות',
    showingOf: 'מוצגות {shown} מתוך {total} תנועות',
    none: 'אין בתקופה זו.',
    opening: 'פתיחה',
    returned: 'הוחזר',
    scrap: 'פסולת',
    transferIn: 'העברה נכנסת',
    transferOut: 'העברה יוצאת',
    reservedCurrent: 'שמור (נוכחי)',
    freeCurrent: 'פנוי (נוכחי)',
    residual: 'יתרה',
    fromWarehouse: 'מ',
    toWarehouse: 'אל',
    type: 'סוג',
    user: 'משתמש',
    worker: 'עובד',
    stage: 'שלב',
    task: 'משימה',
    mixedUnits: 'יחידות מעורבות — אין סיכום כמות',
    incompleteList: 'הערכה חלקית',
    demand: 'הזמנות ממתינות לחומר',
    required: 'נדרש',
    incoming: 'נכנס',
    currentNote: 'שמור ופנוי הם יתרות נוכחיות, לא סוף תקופה.',
    page: 'עמוד {page} מתוך {total}',
    inbound: 'נכנס',
    outbound: 'יוצא',
    receipts: 'קבלות',
    supplierCount: 'חומרים',
  },
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
