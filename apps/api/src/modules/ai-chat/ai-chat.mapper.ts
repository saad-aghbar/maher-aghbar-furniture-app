import type {
  AiChatLocale,
  ChatAction,
  ChatContent,
  ChatMessageDto,
} from './dto/chat.types';
import { money } from './ai-chat.tools';

function copy(
  locale: AiChatLocale,
  en: string,
  ar: string,
  he: string,
): string {
  if (locale === 'ar') return ar;
  if (locale === 'he') return he;
  return en;
}

/**
 * Build UI boards from tool JSON facts. Numbers always come from tools, not the LLM.
 */
export function mapToolResultsToMessage(params: {
  id: string;
  locale: AiChatLocale;
  summaryText: string;
  toolResults: Array<{ name: string; result: unknown }>;
}): ChatMessageDto {
  const { id, locale, summaryText, toolResults } = params;
  const blocks: ChatContent[] = [];
  const suggestions: ChatAction[] = [];

  if (summaryText.trim()) {
    blocks.push({ type: 'text', markdown: summaryText.trim() });
  }

  for (const { name, result } of toolResults) {
    if (!result || typeof result !== 'object') continue;
    const r = result as Record<string, unknown>;

    if (r.needsClarification && typeof r.question === 'string') {
      blocks.push({
        type: 'clarification',
        question: r.question,
      });
      continue;
    }

    if (typeof r.error === 'string') {
      blocks.push({
        type: 'error',
        title: copy(locale, 'Couldn’t complete that', 'تعذّر إكمال الطلب', 'לא ניתן להשלים'),
        body: r.error,
      });
      continue;
    }

    if (name === 'dealer_profit_summary' && Array.isArray(r.orders)) {
      const orders = r.orders as Array<{
        id: string;
        number: string;
        profit: number | string;
        href?: string;
      }>;
      const totals = r.totals as { profit?: number } | undefined;
      const customerName = String(r.customerName ?? '');
      blocks.push({
        type: 'metrics',
        title: copy(
          locale,
          `${customerName} · last ${orders.length} orders`,
          `${customerName} · آخر ${orders.length} طلبات`,
          `${customerName} · ${orders.length} הזמנות אחרונות`,
        ),
        items: [
          {
            label: copy(locale, 'Total profit', 'إجمالي الربح', 'רווח כולל'),
            value: money(totals?.profit),
            tone: 'brand',
          },
          {
            label: copy(locale, 'Orders', 'الطلبات', 'הזמנות'),
            value: String(orders.length),
          },
        ],
      });
      blocks.push({
        type: 'table',
        title: copy(locale, 'Order breakdown', 'تفصيل الطلبات', 'פירוט הזמנות'),
        columns: [
          { key: 'order', label: copy(locale, 'Order', 'الطلب', 'הזמנה') },
          { key: 'profit', label: copy(locale, 'Profit', 'الربح', 'רווח'), align: 'end' },
        ],
        rows: orders.map((o) => ({
          order: o.number,
          profit: money(o.profit),
        })),
      });
      blocks.push({
        type: 'chart',
        title: copy(locale, 'Profit by order', 'الربح حسب الطلب', 'רווח לפי הזמנה'),
        unit: 'ILS',
        points: orders.map((o) => ({
          label: o.number.replace(/^SO-?/i, ''),
          value: Number(o.profit),
          display: money(o.profit).replace(' ILS', ''),
        })),
      });
      if (typeof r.source === 'string') {
        blocks.push({ type: 'sources', lines: [r.source] });
      }
      for (const o of orders.slice(0, 3)) {
        if (o.href) {
          suggestions.push({
            id: `open-order-${o.id}`,
            label: o.number,
            href: o.href,
          });
        }
      }
      continue;
    }

    if (name === 'list_late_orders' && Array.isArray(r.orders)) {
      const orders = r.orders as Array<{
        number: string;
        customerName?: string | null;
        daysLate?: number;
        salesOrderNumber?: string | null;
        href?: string;
        salesOrderId?: string | null;
      }>;
      blocks.push({
        type: 'list',
        title: copy(locale, 'Late queue', 'قائمة المتأخر', 'תור איחורים'),
        items: orders.map((o) => ({
          title: `${o.salesOrderNumber || o.number}${o.customerName ? ` · ${o.customerName}` : ''}`,
          subtitle: copy(
            locale,
            `${o.daysLate ?? 0}d late`,
            `متأخر ${o.daysLate ?? 0} أيام`,
            `${o.daysLate ?? 0} ימים באיחור`,
          ),
          trailing: copy(locale, 'Late', 'متأخر', 'באיחור'),
          tone: 'warning' as const,
        })),
      });
      blocks.push({
        type: 'entities',
        items: orders.slice(0, 5).map((o) => ({
          kind: 'order' as const,
          title: o.salesOrderNumber || o.number,
          subtitle: o.customerName ?? undefined,
          status: 'IN_PRODUCTION',
          amount: copy(
            locale,
            `${o.daysLate ?? 0}d late`,
            `متأخر ${o.daysLate ?? 0} أيام`,
            `${o.daysLate ?? 0} ימים באיחור`,
          ),
          href: o.href,
        })),
      });
      continue;
    }

    if (name === 'list_low_stock' && Array.isArray(r.items)) {
      const items = r.items as Array<{
        name: string;
        sku: string;
        availableQty: number;
        minStock: number;
        href?: string;
      }>;
      blocks.push({
        type: 'metrics',
        items: [
          {
            label: copy(locale, 'Low stock SKUs', 'أصناف منخفضة', 'מק״טים נמוכים'),
            value: String(r.count ?? items.length),
            tone: 'warning',
          },
        ],
      });
      blocks.push({
        type: 'list',
        title: copy(locale, 'Materials', 'المواد', 'חומרים'),
        items: items.map((it) => ({
          title: `${it.name} · ${it.sku}`,
          subtitle: copy(
            locale,
            `${it.availableQty} on hand · min ${it.minStock}`,
            `${it.availableQty} متوفر · الحد ${it.minStock}`,
            `${it.availableQty} במלאי · מינ׳ ${it.minStock}`,
          ),
          trailing: copy(locale, 'Low', 'منخفض', 'נמוך'),
          tone: 'warning' as const,
        })),
      });
      continue;
    }

    if (
      (name === 'list_open_invoices' || name === 'my_invoices') &&
      Array.isArray(r.invoices)
    ) {
      const invoices = r.invoices as Array<{
        id: string;
        number: string;
        outstandingAmount?: number;
        customerName?: string;
        status?: string;
        href?: string;
      }>;
      if (r.outstandingTotal != null) {
        blocks.push({
          type: 'metrics',
          items: [
            {
              label: copy(locale, 'Outstanding', 'المستحق', 'יתרה פתוחה'),
              value: money(r.outstandingTotal as number),
              tone: 'warning',
            },
          ],
        });
      }
      blocks.push({
        type: 'entities',
        title: copy(locale, 'Invoices', 'الفواتير', 'חשבוניות'),
        items: invoices.map((inv) => ({
          kind: 'invoice' as const,
          title: inv.number,
          subtitle: inv.customerName,
          status: inv.status,
          amount:
            inv.outstandingAmount != null ? money(inv.outstandingAmount) : undefined,
          href: inv.href,
        })),
      });
      for (const inv of invoices.slice(0, 3)) {
        if (inv.href) {
          suggestions.push({ id: `open-inv-${inv.id}`, label: inv.number, href: inv.href });
        }
      }
      continue;
    }

    if (
      (name === 'list_sales_orders' || name === 'my_orders') &&
      Array.isArray(r.orders)
    ) {
      const orders = r.orders as Array<{
        id: string;
        number: string;
        status?: string;
        total?: string | number;
        customerName?: string;
        href?: string;
      }>;
      blocks.push({
        type: 'entities',
        title: copy(locale, 'Orders', 'الطلبات', 'הזמנות'),
        items: orders.map((o) => ({
          kind: 'order' as const,
          title: o.number,
          subtitle: o.customerName,
          status: o.status,
          amount: o.total != null ? money(o.total) : undefined,
          href: o.href,
        })),
      });
      continue;
    }

    if (name === 'my_statement') {
      blocks.push({
        type: 'metrics',
        title: copy(locale, 'Statement', 'كشف الحساب', 'דוח חשבון'),
        items: [
          {
            label: copy(locale, 'Closing balance', 'الرصيد الختامي', 'יתרת סגירה'),
            value: money(r.closingBalance as number),
            tone: 'brand',
          },
          {
            label: copy(locale, 'Invoiced', 'المفوتر', 'חויב'),
            value: money(r.totalInvoiced as number),
          },
          {
            label: copy(locale, 'Paid', 'المدفوع', 'שולם'),
            value: money(r.totalPaid as number),
          },
        ],
      });
      if (typeof r.href === 'string') {
        suggestions.push({
          id: 'open-statement',
          label: copy(locale, 'Open statement', 'فتح الكشف', 'פתח דוח'),
          href: r.href,
        });
      }
      continue;
    }

    if (name === 'my_home_snapshot' || name === 'admin_home_snapshot') {
      const metrics: Array<{ label: string; value: string; tone?: 'warning' | 'brand' }> = [];
      if (r.activeOrders != null) {
        metrics.push({
          label: copy(locale, 'Active orders', 'طلبات نشطة', 'הזמנות פעילות'),
          value: String(r.activeOrders),
        });
      }
      if (r.delayedOrders != null) {
        metrics.push({
          label: copy(locale, 'Delayed', 'متأخر', 'באיחור'),
          value: String(r.delayedOrders),
          tone: 'warning',
        });
      }
      if (r.outstandingReceivables != null) {
        metrics.push({
          label: copy(locale, 'Receivables', 'الذمم', 'יתרות'),
          value: money(r.outstandingReceivables as number),
          tone: 'warning',
        });
      }
      if (metrics.length) {
        blocks.push({
          type: 'metrics',
          title: copy(locale, 'Snapshot', 'لمحة', 'תמונת מצב'),
          items: metrics,
        });
      }
      continue;
    }

    if (name === 'search_entities' && Array.isArray(r.hits)) {
      const hits = r.hits as Array<{
        type: string;
        id: string;
        title: string;
        subtitle?: string;
        href?: string;
      }>;
      blocks.push({
        type: 'entities',
        title: copy(locale, 'Results', 'نتائج', 'תוצאות'),
        items: hits.map((h) => ({
          kind:
            h.type === 'invoice'
              ? ('invoice' as const)
              : h.type === 'dealer'
                ? ('dealer' as const)
                : h.type === 'product'
                  ? ('product' as const)
                  : ('order' as const),
          title: h.title,
          subtitle: h.subtitle,
          href: h.href,
        })),
      });
    }
  }

  if (blocks.length === 0) {
    blocks.push({
      type: 'text',
      markdown: copy(
        locale,
        'I couldn’t find matching data for that question.',
        'لم أجد بيانات مطابقة لهذا السؤال.',
        'לא מצאתי נתונים תואמים לשאלה הזו.',
      ),
    });
  }

  return {
    id,
    role: 'assistant',
    createdAt: new Date().toISOString(),
    blocks,
    suggestions: suggestions.length ? suggestions : undefined,
  };
}
