import { Injectable } from '@nestjs/common';
import { InvoiceStatus, SalesOrderStatus } from '@maher/database';
import {
  can,
  resolveAppSurface,
  type AppSurface,
  type Permission,
} from '@maher/permissions';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { ReportsService } from '../reports/reports.service';
import { SalesOrdersService } from '../sales-orders/sales-orders.service';
import type { AiChatLocale, AiChatSurface } from './dto/chat.types';

export type ToolJsonSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type AiChatToolDef = {
  name: string;
  description: string;
  parameters: ToolJsonSchema;
  requiredPermissions: Permission[];
  surfaces: AiChatSurface[];
  execute: (ctx: ToolContext, args: Record<string, unknown>) => Promise<unknown>;
};

export type ToolContext = {
  user: AuthUser;
  locale: AiChatLocale;
  surface: AiChatSurface;
};

function money(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return `${v.toLocaleString('en-US', { maximumFractionDigits: 0 })} ILS`;
}

function hrefFor(
  surface: AiChatSurface,
  kind: 'order' | 'invoice' | 'dealer' | 'product' | 'request',
  id: string,
): string {
  if (surface === 'customer') {
    if (kind === 'order') return `/(app)/(customer)/orders/${id}`;
    if (kind === 'invoice') return `/(app)/(customer)/invoices/${id}`;
    if (kind === 'request') return `/(app)/(customer)/requests/${id}`;
    if (kind === 'product') return `/(app)/(customer)/catalog/${id}`;
    return `/(app)/(customer)/(tabs)/orders`;
  }
  if (kind === 'order') return `/(app)/(admin)/orders/${id}`;
  if (kind === 'invoice') return `/(app)/(admin)/invoices/${id}`;
  if (kind === 'dealer') return `/(app)/(admin)/dealers/${id}`;
  if (kind === 'product') return `/(app)/(admin)/products/${id}`;
  if (kind === 'request') return `/(app)/(admin)/requests/${id}`;
  return `/(app)/(admin)/(tabs)/orders`;
}

@Injectable()
export class AiChatToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly inventory: InventoryService,
    private readonly salesOrders: SalesOrdersService,
  ) {}

  /** Tools the user may see (permission + surface filtered). */
  toolsForUser(user: AuthUser): AiChatToolDef[] {
    const surface = this.surfaceFor(user);
    return this.allTools().filter((tool) => {
      if (!tool.surfaces.includes(surface)) return false;
      return tool.requiredPermissions.every((p) => can(user, p));
    });
  }

  openaiToolsForUser(user: AuthUser) {
    return this.toolsForUser(user).map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  async execute(
    user: AuthUser,
    locale: AiChatLocale,
    name: string,
    rawArgs: string | Record<string, unknown>,
  ): Promise<{ ok: true; name: string; result: unknown } | { ok: false; name: string; error: string }> {
    const tool = this.toolsForUser(user).find((t) => t.name === name);
    if (!tool) {
      return { ok: false, name, error: 'Tool not available for this user.' };
    }
    let args: Record<string, unknown> = {};
    try {
      args = typeof rawArgs === 'string' ? (JSON.parse(rawArgs || '{}') as Record<string, unknown>) : rawArgs ?? {};
    } catch {
      args = {};
    }
    try {
      const result = await tool.execute(
        { user, locale, surface: this.surfaceFor(user) },
        args,
      );
      return { ok: true, name, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tool failed';
      return { ok: false, name, error: message };
    }
  }

  surfaceFor(user: AuthUser): AiChatSurface {
    const s: AppSurface = resolveAppSurface(user);
    return s === 'customer' ? 'customer' : 'admin';
  }

  private allTools(): AiChatToolDef[] {
    return [
      this.toolAdminHome(),
      this.toolLateOrders(),
      this.toolDealerProfit(),
      this.toolLowStock(),
      this.toolOpenInvoices(),
      this.toolListOrders(),
      this.toolGetOrder(),
      this.toolGetCustomer(),
      this.toolSearch(),
      this.toolProductionSummary(),
      this.toolMyHome(),
      this.toolMyOrders(),
      this.toolMyOrderDetail(),
      this.toolMyInvoices(),
      this.toolMyStatement(),
      this.toolMyRequests(),
      this.toolCatalogSearch(),
    ];
  }

  private toolAdminHome(): AiChatToolDef {
    return {
      name: 'admin_home_snapshot',
      description: 'Atelier KPI snapshot: orders, delayed count, open invoices, low stock, recent orders.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      requiredPermissions: ['report.sales.read'],
      surfaces: ['admin'],
      execute: async ({ user }) => this.reports.adminHome(user),
    };
  }

  private toolLateOrders(): AiChatToolDef {
    return {
      name: 'list_late_orders',
      description: 'List late / delayed production orders with days late and dealer names.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max rows (default 10)' },
        },
        additionalProperties: false,
      },
      requiredPermissions: ['report.production.read'],
      surfaces: ['admin'],
      execute: async (_ctx, args) => {
        const limit = Math.min(20, Math.max(1, Number(args.limit ?? 10)));
        const prod = await this.reports.production({});
        const delayed = (prod.delayedOrders ?? []).slice(0, limit);
        return {
          delayedCount: prod.delayedCount,
          orders: delayed.map((o) => ({
            id: o.id,
            number: o.number,
            salesOrderId: o.salesOrderId,
            salesOrderNumber: o.salesOrder?.number ?? null,
            customerId: o.customerId,
            customerName: o.customerName,
            daysLate: o.daysLate,
            status: o.status,
            href: o.salesOrderId
              ? hrefFor('admin', 'order', o.salesOrderId)
              : undefined,
          })),
        };
      },
    };
  }

  private toolDealerProfit(): AiChatToolDef {
    return {
      name: 'dealer_profit_summary',
      description:
        'Profit breakdown for a dealer’s recent sales orders (seller price − manufacturing cost). Requires financial permission.',
      parameters: {
        type: 'object',
        properties: {
          customerId: { type: 'string', description: 'Dealer customer UUID' },
          customerName: { type: 'string', description: 'Dealer name search if id unknown' },
          limit: { type: 'number', description: 'Orders to include (default 3)' },
        },
        additionalProperties: false,
      },
      requiredPermissions: ['report.financial.read'],
      surfaces: ['admin'],
      execute: async (ctx, args) => {
        let customerId = typeof args.customerId === 'string' ? args.customerId : undefined;
        const nameQ = typeof args.customerName === 'string' ? args.customerName.trim() : '';
        if (!customerId && nameQ) {
          const hit = await this.prisma.customer.findFirst({
            where: {
              archivedAt: null,
              OR: [
                { name: { contains: nameQ, mode: 'insensitive' } },
                { nameEn: { contains: nameQ, mode: 'insensitive' } },
                { nameAr: { contains: nameQ, mode: 'insensitive' } },
              ],
            },
            select: { id: true, name: true, nameEn: true, nameAr: true },
          });
          if (!hit) return { error: 'Dealer not found', query: nameQ };
          customerId = hit.id;
        }
        if (!customerId) {
          return {
            needsClarification: true,
            question:
              ctx.locale === 'ar'
                ? 'أي تاجر تريد حساب ربحه؟'
                : ctx.locale === 'he'
                  ? 'לאיזה סוכן לחשב רווח?'
                  : 'Which dealer should I calculate profit for?',
          };
        }
        const limit = Math.min(10, Math.max(1, Number(args.limit ?? 3)));
        const profit = await this.reports.orderProfit({ customerId });
        const rows = (profit.orders ?? []).slice(0, limit);
        const customer = await this.prisma.customer.findUnique({
          where: { id: customerId },
          select: { id: true, name: true, nameEn: true, nameAr: true },
        });
        const customerName = customer?.nameEn || customer?.nameAr || customer?.name || customerId;
        return {
          customerId,
          customerName,
          totals: profit.totals,
          orders: rows.map((r) => ({
            id: r.id,
            number: r.number,
            profit: r.profit,
            sellerPrice: r.sellerPrice,
            status: r.status,
            href: hrefFor('admin', 'order', r.id),
          })),
          source: `Sales orders · ${customerName} · profit report`,
        };
      },
    };
  }

  private toolLowStock(): AiChatToolDef {
    return {
      name: 'list_low_stock',
      description: 'List inventory items at or below minimum stock.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
        additionalProperties: false,
      },
      requiredPermissions: ['inventory.read'],
      surfaces: ['admin'],
      execute: async ({ user }, args) => {
        const limit = Math.min(20, Math.max(1, Number(args.limit ?? 8)));
        const items = await this.inventory.lowStock(user.permissions);
        const slice = items.slice(0, limit);
        return {
          count: items.length,
          items: slice.map((it) => ({
            id: it.id,
            sku: it.sku,
            name: it.nameEn || it.nameAr || it.sku,
            availableQty: Number((it as { availableQty?: number }).availableQty ?? 0),
            minStock: Number(it.minStock),
            href: `/(app)/(admin)/inventory/items/${it.id}`,
          })),
        };
      },
    };
  }

  private toolOpenInvoices(): AiChatToolDef {
    return {
      name: 'list_open_invoices',
      description: 'Open / outstanding customer invoices (AR).',
      parameters: {
        type: 'object',
        properties: {
          customerId: { type: 'string' },
          limit: { type: 'number' },
        },
        additionalProperties: false,
      },
      requiredPermissions: ['invoice.read'],
      surfaces: ['admin'],
      execute: async (ctx, args) => {
        const limit = Math.min(20, Math.max(1, Number(args.limit ?? 8)));
        const customerId = typeof args.customerId === 'string' ? args.customerId : undefined;
        const rows = await this.prisma.invoice.findMany({
          where: {
            archivedAt: null,
            ...(customerId ? { customerId } : {}),
            status: {
              in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE],
            },
            outstandingAmount: { gt: 0 },
          },
          include: {
            customer: { select: { id: true, name: true, nameEn: true, nameAr: true } },
          },
          orderBy: { outstandingAmount: 'desc' },
          take: limit,
        });
        const outstanding = rows.reduce((s, r) => s + Number(r.outstandingAmount), 0);
        return {
          outstandingTotal: outstanding,
          invoices: rows.map((r) => ({
            id: r.id,
            number: r.number,
            status: r.status,
            outstandingAmount: Number(r.outstandingAmount),
            customerId: r.customerId,
            customerName: r.customer.nameEn || r.customer.nameAr || r.customer.name,
            href: hrefFor(ctx.surface, 'invoice', r.id),
          })),
        };
      },
    };
  }

  private toolListOrders(): AiChatToolDef {
    return {
      name: 'list_sales_orders',
      description: 'Search/list sales orders. Optional dealer filter and status.',
      parameters: {
        type: 'object',
        properties: {
          customerId: { type: 'string' },
          q: { type: 'string' },
          status: { type: 'string' },
          limit: { type: 'number' },
        },
        additionalProperties: false,
      },
      requiredPermissions: ['sales-order.read'],
      surfaces: ['admin'],
      execute: async (ctx, args) => {
        const limit = Math.min(20, Math.max(1, Number(args.limit ?? 8)));
        const result = await this.salesOrders.list(
          {
            page: 1,
            pageSize: limit,
            customerId: typeof args.customerId === 'string' ? args.customerId : undefined,
            q: typeof args.q === 'string' ? args.q : undefined,
            status: typeof args.status === 'string' ? (args.status as SalesOrderStatus) : undefined,
          } as never,
          ctx.user,
        );
        const data = result.data ?? [];
        return {
          total: result.meta?.totalItems ?? data.length,
          orders: data.map((o) => ({
            id: o.id,
            number: o.number,
            status: o.status,
            total: o.total,
            customerId: o.customer?.id,
            customerName: o.customer?.nameEn || o.customer?.nameAr || o.customer?.name,
            href: hrefFor('admin', 'order', o.id),
          })),
        };
      },
    };
  }

  private toolGetOrder(): AiChatToolDef {
    return {
      name: 'get_sales_order',
      description: 'Get one sales order by id or number.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          number: { type: 'string' },
        },
        additionalProperties: false,
      },
      requiredPermissions: ['sales-order.read'],
      surfaces: ['admin', 'customer'],
      execute: async (ctx, args) => {
        let id = typeof args.id === 'string' ? args.id : undefined;
        if (!id && typeof args.number === 'string') {
          const row = await this.prisma.salesOrder.findFirst({
            where: {
              number: { equals: args.number, mode: 'insensitive' },
              archivedAt: null,
              ...(ctx.user.customerId ? { customerId: ctx.user.customerId } : {}),
            },
            select: { id: true },
          });
          id = row?.id;
        }
        if (!id) return { error: 'Order not found' };
        const detail = await this.salesOrders.getById(id, ctx.user);
        return {
          id: detail.id,
          number: detail.number,
          status: detail.status,
          total: detail.total,
          customerId: detail.customerId,
          href: hrefFor(ctx.surface, 'order', detail.id),
        };
      },
    };
  }

  private toolGetCustomer(): AiChatToolDef {
    return {
      name: 'get_customer',
      description: 'Look up a dealer/customer by id or name.',
      parameters: {
        type: 'object',
        properties: {
          customerId: { type: 'string' },
          q: { type: 'string' },
        },
        additionalProperties: false,
      },
      requiredPermissions: ['customer.read'],
      surfaces: ['admin'],
      execute: async (_ctx, args) => {
        const id = typeof args.customerId === 'string' ? args.customerId : undefined;
        const q = typeof args.q === 'string' ? args.q.trim() : '';
        const row = id
          ? await this.prisma.customer.findFirst({ where: { id, archivedAt: null } })
          : q
            ? await this.prisma.customer.findFirst({
                where: {
                  archivedAt: null,
                  OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { nameEn: { contains: q, mode: 'insensitive' } },
                    { nameAr: { contains: q, mode: 'insensitive' } },
                    { code: { contains: q, mode: 'insensitive' } },
                  ],
                },
              })
            : null;
        if (!row) return { error: 'Customer not found' };
        return {
          id: row.id,
          code: row.code,
          name: row.nameEn || row.nameAr || row.name,
          status: row.status,
          href: hrefFor('admin', 'dealer', row.id),
        };
      },
    };
  }

  private toolSearch(): AiChatToolDef {
    return {
      name: 'search_entities',
      description: 'Global search across orders, dealers, invoices, products (permission-scoped).',
      parameters: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          limit: { type: 'number' },
        },
        required: ['q'],
        additionalProperties: false,
      },
      requiredPermissions: [],
      surfaces: ['admin', 'customer'],
      execute: async (ctx, args) => {
        const q = String(args.q ?? '').trim();
        if (q.length < 1) return { hits: [] };
        const limit = Math.min(12, Math.max(1, Number(args.limit ?? 8)));
        const perms = new Set(ctx.user.permissions ?? []);
        const customerId = ctx.user.customerId ?? undefined;
        const hits: Array<{ type: string; id: string; title: string; subtitle?: string; href?: string }> = [];

        if (perms.has('sales-order.read')) {
          const orders = await this.prisma.salesOrder.findMany({
            where: {
              archivedAt: null,
              ...(customerId ? { customerId } : {}),
              OR: [
                { number: { contains: q, mode: 'insensitive' } },
                { externalOrderNumber: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: limit,
            select: { id: true, number: true, status: true },
          });
          for (const o of orders) {
            hits.push({
              type: 'order',
              id: o.id,
              title: o.number,
              subtitle: o.status,
              href: hrefFor(ctx.surface, 'order', o.id),
            });
          }
        }
        if (perms.has('customer.read') && !customerId) {
          const dealers = await this.prisma.customer.findMany({
            where: {
              archivedAt: null,
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { nameEn: { contains: q, mode: 'insensitive' } },
                { code: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: limit,
            select: { id: true, name: true, nameEn: true, code: true },
          });
          for (const d of dealers) {
            hits.push({
              type: 'dealer',
              id: d.id,
              title: d.nameEn || d.name,
              subtitle: d.code,
              href: hrefFor('admin', 'dealer', d.id),
            });
          }
        }
        return { hits: hits.slice(0, limit) };
      },
    };
  }

  private toolProductionSummary(): AiChatToolDef {
    return {
      name: 'production_summary',
      description: 'High-level production counts (completed today/week, in production, late).',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      requiredPermissions: ['report.production.read'],
      surfaces: ['admin'],
      execute: async () => this.reports.productionSummary(),
    };
  }

  private toolMyHome(): AiChatToolDef {
    return {
      name: 'my_home_snapshot',
      description: 'Dealer home snapshot for the signed-in dealer only.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      requiredPermissions: ['sales-order.read'],
      surfaces: ['customer'],
      execute: async ({ user }) => this.reports.dealerHome(user),
    };
  }

  private toolMyOrders(): AiChatToolDef {
    return {
      name: 'my_orders',
      description: 'List the signed-in dealer’s sales orders (never other dealers).',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
          status: { type: 'string' },
        },
        additionalProperties: false,
      },
      requiredPermissions: ['sales-order.read'],
      surfaces: ['customer'],
      execute: async (ctx, args) => {
        // Ignore any LLM-supplied customerId — always use auth scope.
        const limit = Math.min(20, Math.max(1, Number(args.limit ?? 8)));
        const result = await this.salesOrders.list(
          {
            page: 1,
            pageSize: limit,
            status: typeof args.status === 'string' ? (args.status as SalesOrderStatus) : undefined,
            customerId: 'ignore-override',
          } as never,
          ctx.user,
        );
        const data = result.data ?? [];
        return {
          customerId: ctx.user.customerId,
          orders: data.map((o) => ({
            id: o.id,
            number: o.number,
            status: o.status,
            total: o.total,
            href: hrefFor('customer', 'order', o.id),
          })),
        };
      },
    };
  }

  private toolMyOrderDetail(): AiChatToolDef {
    return {
      name: 'my_order_detail',
      description: 'Detail for one of the signed-in dealer’s orders.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' }, number: { type: 'string' } },
        additionalProperties: false,
      },
      requiredPermissions: ['sales-order.read'],
      surfaces: ['customer'],
      execute: async (ctx, args) => {
        const inner = this.toolGetOrder();
        return inner.execute(ctx, args);
      },
    };
  }

  private toolMyInvoices(): AiChatToolDef {
    return {
      name: 'my_invoices',
      description: 'Open invoices for the signed-in dealer only.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
        additionalProperties: false,
      },
      requiredPermissions: ['invoice.read'],
      surfaces: ['customer'],
      execute: async (ctx, args) => {
        if (!ctx.user.customerId) return { error: 'No dealer account linked' };
        const limit = Math.min(20, Math.max(1, Number(args.limit ?? 8)));
        const rows = await this.prisma.invoice.findMany({
          where: {
            archivedAt: null,
            customerId: ctx.user.customerId,
            status: {
              in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE],
            },
          },
          orderBy: { invoiceDate: 'desc' },
          take: limit,
        });
        return {
          invoices: rows.map((r) => ({
            id: r.id,
            number: r.number,
            status: r.status,
            outstandingAmount: Number(r.outstandingAmount),
            total: Number(r.total),
            href: hrefFor('customer', 'invoice', r.id),
          })),
        };
      },
    };
  }

  private toolMyStatement(): AiChatToolDef {
    return {
      name: 'my_statement',
      description: 'Account statement summary for the signed-in dealer.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      requiredPermissions: ['statement.read'],
      surfaces: ['customer'],
      execute: async (ctx) => {
        const customerId = ctx.user.customerId;
        if (!customerId) return { error: 'No dealer account linked' };
        const asOfDate = new Date();
        const [invoices, payments] = await Promise.all([
          this.prisma.invoice.findMany({
            where: {
              customerId,
              archivedAt: null,
              status: { notIn: ['CANCELLED', 'VOID'] },
              invoiceDate: { lte: asOfDate },
            },
          }),
          this.prisma.payment.findMany({
            where: { customerId, paymentDate: { lte: asOfDate } },
          }),
        ]);
        const invoiced = invoices.reduce((s, i) => s + Number(i.total), 0);
        const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
        return {
          customerId,
          asOf: asOfDate.toISOString(),
          totalInvoiced: invoiced,
          totalPaid: paid,
          closingBalance: invoiced - paid,
          currency: 'ILS',
          href: '/(app)/(customer)/account/statement',
        };
      },
    };
  }

  private toolMyRequests(): AiChatToolDef {
    return {
      name: 'my_requests',
      description: 'Recent quotation requests for the signed-in dealer.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
        additionalProperties: false,
      },
      requiredPermissions: ['request.read'],
      surfaces: ['customer'],
      execute: async (ctx, args) => {
        if (!ctx.user.customerId) return { error: 'No dealer account linked' };
        const limit = Math.min(20, Math.max(1, Number(args.limit ?? 8)));
        const rows = await this.prisma.requestForQuotation.findMany({
          where: { customerId: ctx.user.customerId, archivedAt: null },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: { id: true, number: true, status: true, createdAt: true },
        });
        return {
          requests: rows.map((r) => ({
            id: r.id,
            number: r.number,
            status: r.status,
            href: hrefFor('customer', 'request', r.id),
          })),
        };
      },
    };
  }

  private toolCatalogSearch(): AiChatToolDef {
    return {
      name: 'catalog_search',
      description: 'Search active catalog products.',
      parameters: {
        type: 'object',
        properties: { q: { type: 'string' }, limit: { type: 'number' } },
        required: ['q'],
        additionalProperties: false,
      },
      requiredPermissions: ['catalog.read'],
      surfaces: ['admin', 'customer'],
      execute: async (ctx, args) => {
        const q = String(args.q ?? '').trim();
        const limit = Math.min(12, Math.max(1, Number(args.limit ?? 8)));
        const rows = await this.prisma.product.findMany({
          where: {
            archivedAt: null,
            isActive: true,
            OR: [
              { nameEn: { contains: q, mode: 'insensitive' } },
              { nameAr: { contains: q, mode: 'insensitive' } },
              { nameHe: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: limit,
          select: { id: true, nameEn: true, nameAr: true, nameHe: true },
        });
        return {
          products: rows.map((p) => ({
            id: p.id,
            title: p.nameEn || p.nameAr || p.nameHe || p.id,
            href: hrefFor(ctx.surface, 'product', p.id),
          })),
        };
      },
    };
  }
}

/** Test helper — permission filter only. */
export function filterToolsForUser(
  tools: Array<Pick<AiChatToolDef, 'name' | 'requiredPermissions' | 'surfaces'>>,
  user: AuthUser,
  surface: AiChatSurface,
) {
  return tools.filter((tool) => {
    if (!tool.surfaces.includes(surface)) return false;
    return tool.requiredPermissions.every((p) => can(user, p));
  });
}

export { money, hrefFor };
