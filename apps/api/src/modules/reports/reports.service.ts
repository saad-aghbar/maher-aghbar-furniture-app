import { Injectable } from '@nestjs/common';
import {
  InvoiceStatus,
  ProductionOrderStatus,
  QuotationStatus,
  SalesOrderStatus,
} from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { roundMoney } from '../../common/helpers/money.util';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const now = new Date();
    const soon = new Date();
    soon.setDate(soon.getDate() + 7);

    const [
      activeOrders,
      ordersDueSoon,
      delayedProduction,
      waitingMaterials,
      pendingQuoteApprovals,
      outstandingInvoices,
      lowStock,
      criticalBlockers,
      dailyCompletions,
      revenueAgg,
      receivablesAgg,
      completedSalesOrders,
      openPurchases,
    ] = await Promise.all([
      this.prisma.salesOrder.count({
        where: {
          archivedAt: null,
          status: {
            in: [
              SalesOrderStatus.CONFIRMED,
              SalesOrderStatus.IN_PRODUCTION,
              SalesOrderStatus.READY_FOR_PRODUCTION,
              SalesOrderStatus.READY_FOR_DELIVERY,
            ],
          },
        },
      }),
      this.prisma.salesOrder.count({
        where: {
          archivedAt: null,
          requiredDeliveryDate: { lte: soon, gte: now },
          status: {
            notIn: [
              SalesOrderStatus.COMPLETED,
              SalesOrderStatus.CANCELLED,
              SalesOrderStatus.DELIVERED,
            ],
          },
        },
      }),
      this.prisma.productionOrder.count({
        where: {
          archivedAt: null,
          requiredDeliveryDate: { lt: now },
          status: {
            notIn: [ProductionOrderStatus.COMPLETED, ProductionOrderStatus.CANCELLED],
          },
        },
      }),
      this.prisma.productionOrder.count({
        where: { archivedAt: null, status: ProductionOrderStatus.WAITING_FOR_MATERIALS },
      }),
      this.prisma.quotation.count({
        where: { archivedAt: null, status: QuotationStatus.INTERNAL_REVIEW },
      }),
      this.prisma.invoice.count({
        where: {
          archivedAt: null,
          status: {
            in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE],
          },
          outstandingAmount: { gt: 0 },
        },
      }),
      this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*)::bigint AS count FROM inventory_items i
         WHERE i.archived_at IS NULL AND EXISTS (
           SELECT 1 FROM inventory_balances b
           WHERE b.inventory_item_id = i.id
           GROUP BY b.inventory_item_id
           HAVING COALESCE(SUM(b.available_qty), 0) <= i.min_stock
         )`,
      )
        .then((rows) => Number(rows[0]?.count ?? 0))
        .catch(async () => {
          const items = await this.prisma.inventoryItem.findMany({
            where: { archivedAt: null },
            include: { balances: true },
          });
          return items.filter((item) => {
            const available = item.balances.reduce((s, b) => s + Number(b.availableQty), 0);
            return available <= Number(item.minStock);
          }).length;
        }),
      this.prisma.taskBlocker.count({ where: { resolvedAt: null } }),
      this.prisma.productionTask.count({
        where: {
          status: 'COMPLETED',
          actualCompletion: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          },
        },
      }),
      this.prisma.invoice.aggregate({
        where: {
          archivedAt: null,
          status: {
            in: [
              InvoiceStatus.ISSUED,
              InvoiceStatus.PARTIALLY_PAID,
              InvoiceStatus.PAID,
              InvoiceStatus.OVERDUE,
            ],
          },
        },
        _sum: { total: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          archivedAt: null,
          status: {
            in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE],
          },
          outstandingAmount: { gt: 0 },
        },
        _sum: { outstandingAmount: true },
      }),
      this.prisma.salesOrder.count({
        where: {
          archivedAt: null,
          status: { in: [SalesOrderStatus.COMPLETED, SalesOrderStatus.DELIVERED] },
        },
      }),
      this.prisma.purchaseOrder.count({
        where: {
          archivedAt: null,
          status: {
            notIn: ['RECEIVED', 'CANCELLED', 'CLOSED'],
          },
        },
      }),
    ]);

    return {
      activeOrders,
      ordersDueSoon,
      delayedProduction,
      waitingMaterials,
      pendingQuoteApprovals,
      outstandingInvoices,
      lowStock,
      criticalBlockers,
      dailyCompletions,
      revenueInvoiced: roundMoney(Number(revenueAgg._sum.total ?? 0)),
      receivablesAmount: roundMoney(Number(receivablesAgg._sum.outstandingAmount ?? 0)),
      completedSalesOrders,
      openPurchases,
      generatedAt: new Date().toISOString(),
    };
  }

  async sales() {
    const [byStatus, topCustomers, recentQuotes] = await Promise.all([
      this.prisma.salesOrder.groupBy({
        by: ['status'],
        where: { archivedAt: null },
        _count: true,
        _sum: { total: true },
      }),
      this.prisma.salesOrder.groupBy({
        by: ['customerId'],
        where: { archivedAt: null },
        _sum: { total: true },
        _count: true,
        orderBy: { _sum: { total: 'desc' } },
        take: 10,
      }),
      this.prisma.quotation.findMany({
        where: { archivedAt: null },
        include: { customer: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const customers = await this.prisma.customer.findMany({
      where: { id: { in: topCustomers.map((c) => c.customerId) } },
    });
    const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]));

    return {
      ordersByStatus: byStatus.map((row) => ({
        status: row.status,
        count: row._count,
        total: roundMoney(Number(row._sum.total ?? 0)),
      })),
      topCustomers: topCustomers.map((row) => ({
        customerId: row.customerId,
        customerName: customerMap[row.customerId]?.name ?? row.customerId,
        orderCount: row._count,
        total: roundMoney(Number(row._sum.total ?? 0)),
      })),
      recentQuotes: recentQuotes.map((q) => ({
        id: q.id,
        number: q.number,
        version: q.version,
        status: q.status,
        total: q.total,
        customer: q.customer.name,
        createdAt: q.createdAt.toISOString(),
      })),
    };
  }

  async production() {
    const [byStatus, delayed, stageThroughput] = await Promise.all([
      this.prisma.productionOrder.groupBy({
        by: ['status'],
        where: { archivedAt: null },
        _count: true,
      }),
      this.prisma.productionOrder.findMany({
        where: {
          archivedAt: null,
          requiredDeliveryDate: { lt: new Date() },
          status: {
            notIn: [ProductionOrderStatus.COMPLETED, ProductionOrderStatus.CANCELLED],
          },
        },
        include: { salesOrder: true },
        take: 50,
      }),
      this.prisma.productionTask.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    return {
      ordersByStatus: byStatus,
      delayedOrders: delayed,
      tasksByStatus: stageThroughput,
    };
  }

  async inventory() {
    const [items, transfers, lowStock] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where: { archivedAt: null },
        include: { balances: { include: { warehouse: true } } },
        take: 200,
      }),
      this.prisma.warehouseTransfer.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { fromWarehouse: true, toWarehouse: true },
      }),
      this.prisma.inventoryItem.findMany({
        where: { archivedAt: null },
        include: { balances: true },
      }),
    ]);

    return {
      onHand: items.map((item) => ({
        sku: item.sku,
        nameEn: item.nameEn,
        nameAr: item.nameAr,
        minStock: item.minStock,
        balances: item.balances.map((b) => ({
          warehouse: b.warehouse.code,
          availableQty: b.availableQty,
        })),
      })),
      recentTransfers: transfers,
      lowStock: lowStock
        .map((item) => {
          const available = item.balances.reduce((s, b) => s + Number(b.availableQty), 0);
          return {
            sku: item.sku,
            nameEn: item.nameEn,
            nameAr: item.nameAr,
            available,
            minStock: Number(item.minStock),
          };
        })
        .filter((i) => i.available <= i.minStock),
    };
  }

  async financial() {
    const [invoices, payments, aging] = await Promise.all([
      this.prisma.invoice.groupBy({
        by: ['status'],
        where: { archivedAt: null },
        _count: true,
        _sum: { total: true, outstandingAmount: true },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.invoice.findMany({
        where: {
          archivedAt: null,
          outstandingAmount: { gt: 0 },
          status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
        },
        include: { customer: true },
        orderBy: { dueDate: 'asc' },
        take: 100,
      }),
    ]);

    const now = Date.now();
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0, older: 0 };
    for (const inv of aging) {
      const due = inv.dueDate ? new Date(inv.dueDate).getTime() : now;
      const days = Math.floor((now - due) / 86_400_000);
      const amt = Number(inv.outstandingAmount);
      if (days <= 0) buckets.current += amt;
      else if (days <= 30) buckets.d30 += amt;
      else if (days <= 60) buckets.d60 += amt;
      else if (days <= 90) buckets.d90 += amt;
      else buckets.older += amt;
    }

    return {
      invoicesByStatus: invoices.map((row) => ({
        status: row.status,
        count: row._count,
        total: roundMoney(Number(row._sum.total ?? 0)),
        outstanding: roundMoney(Number(row._sum.outstandingAmount ?? 0)),
      })),
      paymentsTotal: roundMoney(Number(payments._sum.amount ?? 0)),
      paymentCount: payments._count,
      aging: {
        current: roundMoney(buckets.current),
        d1_30: roundMoney(buckets.d30),
        d31_60: roundMoney(buckets.d60),
        d61_90: roundMoney(buckets.d90),
        older: roundMoney(buckets.older),
      },
      openInvoices: aging.map((inv) => ({
        id: inv.id,
        number: inv.number,
        customer: inv.customer.name,
        dueDate: inv.dueDate,
        outstanding: inv.outstandingAmount,
      })),
    };
  }

  async purchasing() {
    const [pos, prs, receipts] = await Promise.all([
      this.prisma.purchaseOrder.groupBy({
        by: ['status'],
        where: { archivedAt: null },
        _count: true,
        _sum: { total: true },
      }),
      this.prisma.purchaseRequest.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.goodsReceipt.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { purchaseOrder: true, warehouse: true },
      }),
    ]);
    return { purchaseOrdersByStatus: pos, purchaseRequestsByStatus: prs, recentReceipts: receipts };
  }

  toCsv(rows: Record<string, unknown>[]): string {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]!);
    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join(
      '\n',
    );
  }
}
