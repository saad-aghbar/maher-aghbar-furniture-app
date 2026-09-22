import type { PdfLocale } from '../../common/helpers/pdf.util';

export type ReportExportName = 'sales' | 'order-profit' | 'ap-ledger' | 'period-pl' | 'cash-flow' | 'financial';

export interface ReportExportDataset {
  name: ReportExportName;
  /** Column keys in order; labels come from `exportLabel`. */
  columns: string[];
  rows: Array<Record<string, string | number | null | undefined>>;
  /** Optional header lines (period, filters) for the PDF. */
  meta?: string[];
}

type Labels = Record<string, { en: string; ar: string; he: string }>;

const LABELS: Labels = {
  sales: { en: 'Sales report', ar: 'تقرير المبيعات', he: 'דוח מכירות' },
  'order-profit': { en: 'Order profit', ar: 'ربح الطلبيات', he: 'רווח הזמנות' },
  'ap-ledger': { en: 'Supplier ledger (AP)', ar: 'دفتر الموردين', he: 'ספר ספקים' },
  'period-pl': { en: 'Period P&L', ar: 'الأرباح والخسائر للفترة', he: 'רווח והפסד לתקופה' },
  'cash-flow': { en: 'Cash flow', ar: 'التدفق النقدي', he: 'תזרים מזומנים' },
  financial: { en: 'Receivables aging', ar: 'أعمار الذمم', he: 'גיול חובות' },
  customer: { en: 'Customer', ar: 'العميل', he: 'לקוח' },
  orders: { en: 'Orders', ar: 'الطلبيات', he: 'הזמנות' },
  total: { en: 'Total', ar: 'الإجمالي', he: 'סה"כ' },
  number: { en: 'Number', ar: 'الرقم', he: 'מספר' },
  sellerPrice: { en: 'Sale value', ar: 'قيمة البيع', he: 'שווי מכירה' },
  productionPrice: { en: 'Production cost', ar: 'تكلفة الإنتاج', he: 'עלות ייצור' },
  profit: { en: 'Profit', ar: 'الربح', he: 'רווח' },
  marginPercent: { en: 'Margin %', ar: 'الهامش %', he: 'מרווח %' },
  status: { en: 'Status', ar: 'الحالة', he: 'סטטוס' },
  orderDate: { en: 'Order date', ar: 'تاريخ الطلب', he: 'תאריך הזמנה' },
  supplier: { en: 'Supplier', ar: 'المورد', he: 'ספק' },
  purchaseOrder: { en: 'Purchase order', ar: 'أمر الشراء', he: 'הזמנת רכש' },
  dueDate: { en: 'Due date', ar: 'تاريخ الاستحقاق', he: 'תאריך פירעון' },
  outstanding: { en: 'Outstanding', ar: 'المتبقي', he: 'יתרה' },
  daysPastDue: { en: 'Days past due', ar: 'أيام التأخير', he: 'ימי פיגור' },
  revenueOrders: { en: 'Revenue (orders)', ar: 'الإيراد (طلبيات)', he: 'הכנסות (הזמנות)' },
  revenueInvoiced: { en: 'Revenue (invoiced)', ar: 'الإيراد (مفوتر)', he: 'הכנסות (חויב)' },
  materialCogs: { en: 'Material COGS', ar: 'تكلفة المواد', he: 'עלות חומרים' },
  reworkCost: { en: 'Rework', ar: 'إعادة العمل', he: 'עיבוד מחדש' },
  replacementCost: { en: 'Replacements', ar: 'الاستبدالات', he: 'החלפות' },
  recoveredValue: { en: 'Recovered value', ar: 'القيمة المستخلصة', he: 'שווי מושחזר' },
  scrapValue: { en: 'Scrap', ar: 'الإتلاف', he: 'גריטה' },
  returnWriteOff: { en: 'Return write-off', ar: 'شطب المرتجعات', he: 'מחיקת החזרות' },
  supplierSpend: { en: 'Supplier spend', ar: 'إنفاق الموردين', he: 'הוצאות ספקים' },
  laborHours: { en: 'Labor hours', ar: 'ساعات العمل', he: 'שעות עבודה' },
  laborCost: { en: 'Labor cost', ar: 'تكلفة العمل', he: 'עלות עבודה' },
  laborRateJod: { en: 'Labor rate', ar: 'معدل الأجر', he: 'תעריף עבודה' },
  grossProfit: { en: 'Gross profit', ar: 'الربح الإجمالي', he: 'רווח גולמי' },
  contribution: { en: 'Contribution', ar: 'المساهمة', he: 'תרומה' },
  orderCount: { en: 'Order count', ar: 'عدد الطلبيات', he: 'מספר הזמנות' },
  direction: { en: 'Direction', ar: 'الاتجاه', he: 'כיוון' },
  party: { en: 'Party', ar: 'الطرف', he: 'צד' },
  method: { en: 'Method', ar: 'الطريقة', he: 'אמצעי' },
  amount: { en: 'Amount', ar: 'المبلغ', he: 'סכום' },
  date: { en: 'Date', ar: 'التاريخ', he: 'תאריך' },
  period: { en: 'Period', ar: 'الفترة', he: 'תקופה' },
  generated: { en: 'Generated', ar: 'أُنشئ', he: 'נוצר' },
  rows: { en: 'Rows', ar: 'الصفوف', he: 'שורות' },
};

export function exportLabel(key: string, locale: PdfLocale): string {
  const entry = LABELS[key];
  if (!entry) return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
  return entry[locale] ?? entry.en;
}

export const EXPORT_FILENAMES: Record<ReportExportName, string> = {
  sales: 'sales-report',
  'order-profit': 'order-profit',
  'ap-ledger': 'ap-ledger',
  'period-pl': 'period-pl',
  'cash-flow': 'cash-flow',
  financial: 'financial-aging',
};

export function periodMeta(query: { from?: string; to?: string }, locale: PdfLocale): string[] {
  const meta: string[] = [];
  if (query.from || query.to) meta.push(`${exportLabel('period', locale)}: ${query.from ?? '…'} → ${query.to ?? '…'}`);
  meta.push(`${exportLabel('generated', locale)}: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
  return meta;
}
