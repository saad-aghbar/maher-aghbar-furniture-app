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
  labelScanHint: string;
  version: string;
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
  labelScanHint: 'Scan barcode / QR at warehouse stations',
  version: 'Version',
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
  labelScanHint: 'امسح الرمز في المستودع',
  version: 'الإصدار',
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
  labelScanHint: 'סרוק את הקוד במחסן',
  version: 'גרסה',
};

const MAP: Record<PdfLocale, PdfMessages> = { en: EN, ar: AR, he: HE };

export function pdfMessages(locale: PdfLocale): PdfMessages {
  return MAP[locale] ?? EN;
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
