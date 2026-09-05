import { BadRequestException, Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common';
import { PurchaseOrderStatus, PurchaseRequestStatus, Prisma } from '@maher/database';
import type { WhatsAppProvider } from '@maher/integrations';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { roundMoney } from '../../common/helpers/money.util';
import { NotificationsService } from '../notifications/notifications.service';
import { SchedulingQueueService } from '../scheduling/scheduling-queue';
import { WHATSAPP_PROVIDER } from '../../integrations/integrations.module';
import { classifyMaterialDemand } from './material-demand';
import { scaleMaterialQty } from '../scheduling/domain/material-readiness';
import { canonicalInventoryImageUrl } from '../inventory/inventory-image';

const OPEN_PR_STATUSES: PurchaseRequestStatus[] = [
  PurchaseRequestStatus.DRAFT,
  PurchaseRequestStatus.SUBMITTED,
  PurchaseRequestStatus.APPROVED,
];

export type PurchaseWhatsAppResult = {
  ok: boolean;
  to: string | null;
  body: string;
  error?: string;
};

export type PurchaseOrderSendResult = {
  purchaseOrder: {
    id: string;
    number: string;
    status: PurchaseOrderStatus;
    supplierId: string;
    whatsappSentAt: Date | null;
    whatsappLastBody: string | null;
    whatsappLastTo: string | null;
    supplier: {
      id: string;
      name: string;
      phone: string | null;
      whatsappPhone: string | null;
    };
    lines: Array<{
      description: string;
      quantity: Prisma.Decimal | number | string;
      unit: string;
    }>;
  };
  whatsapp: PurchaseWhatsAppResult;
};

@Injectable()
export class PurchasingService {
  private readonly logger = new Logger(PurchasingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly notifications: NotificationsService,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsAppProvider,
    @Optional()
    @Inject(forwardRef(() => SchedulingQueueService))
    private readonly schedulingQueue?: SchedulingQueueService,
  ) {}

  private async companyFlag(key: string, defaultValue = true): Promise<boolean> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: 'company' } });
    const company =
      row?.value && typeof row.value === 'object' && !Array.isArray(row.value)
        ? (row.value as Record<string, unknown>)
        : {};
    if (typeof company[key] === 'boolean') return company[key] as boolean;
    return defaultValue;
  }

  async isAutoReorderEnabled(): Promise<boolean> {
    return this.companyFlag('autoReorderEnabled', true);
  }

  async isLowStockAlertsEnabled(): Promise<boolean> {
    return this.companyFlag('lowStockAlertsEnabled', true);
  }

  /**
   * Create a SUBMITTED PR for low-stock items not already covered by an open PR.
   * Returns null when nothing to order (or auto-reorder disabled when requireEnabled).
   */
  async createFromLowStock(opts: {
    requestedById?: string | null;
    reason?: string;
    inventoryItemIds?: string[];
    requireEnabled?: boolean;
    throwIfEmpty?: boolean;
    skipNotify?: boolean;
  }): Promise<{ id: string; number: string; lineCount: number } | null> {
    if (opts.requireEnabled && !(await this.isAutoReorderEnabled())) {
      return null;
    }

    const itemWhere: Prisma.InventoryItemWhereInput = {
      archivedAt: null,
      isActive: true,
      isPurchasable: true,
      ...(opts.inventoryItemIds?.length
        ? { id: { in: opts.inventoryItemIds } }
        : {}),
    };

    const items = await this.prisma.inventoryItem.findMany({
      where: itemWhere,
      include: { balances: true },
    });

    const low = items.filter((item) => {
      const available = item.balances.reduce((s, b) => s + Number(b.availableQty), 0);
      return available <= Number(item.minStock);
    });

    if (!low.length) {
      if (opts.throwIfEmpty) {
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message: 'No low-stock items to order.',
        });
      }
      return null;
    }

    const lowIds = low.map((i) => i.id);
    const covered = await this.prisma.purchaseRequestLine.findMany({
      where: {
        inventoryItemId: { in: lowIds },
        purchaseRequest: {
          archivedAt: null,
          status: { in: OPEN_PR_STATUSES },
        },
      },
      select: { inventoryItemId: true },
    });
    const coveredSet = new Set(
      covered.map((c) => c.inventoryItemId).filter((id): id is string => Boolean(id)),
    );
    const toOrder = low.filter((item) => !coveredSet.has(item.id));

    if (!toOrder.length) {
      if (opts.throwIfEmpty) {
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message: 'Low-stock items are already covered by open purchase requests.',
        });
      }
      return null;
    }

    const number = await this.sequences.next('PR', 'PR');
    const reason = opts.reason ?? 'AUTO_REORDER';
    const pr = await this.prisma.purchaseRequest.create({
      data: {
        number,
        requestedById: opts.requestedById ?? undefined,
        reason,
        status: PurchaseRequestStatus.SUBMITTED,
        lines: {
          create: toOrder.map((item) => {
            const available = item.balances.reduce((s, b) => s + Number(b.availableQty), 0);
            const reorder = item.reorderQty != null ? Number(item.reorderQty) : null;
            const qty =
              reorder && reorder > 0
                ? reorder
                : Math.max(Number(item.minStock) * 2 - available, 1);
            return {
              description: item.nameEn || item.nameAr || item.sku,
              quantity: roundMoney(qty),
              inventoryItemId: item.id,
              unit: item.unit || 'pcs',
            };
          }),
        },
      },
      include: { lines: true },
    });

    await this.prisma.inventoryItem.updateMany({
      where: { id: { in: toOrder.map((i) => i.id) } },
      data: { lastAutoPrAt: new Date() },
    });

    this.logger.log(
      `Created PR ${pr.number} from low stock (${pr.lines.length} lines)`,
    );

    await this.notifyLowStock(
      toOrder.map((i) => ({
        sku: i.sku,
        name: i.nameEn || i.nameAr || i.sku,
        available: i.balances.reduce((s, b) => s + Number(b.availableQty), 0),
        minStock: Number(i.minStock),
      })),
      pr.number,
      opts.skipNotify,
    );

    return { id: pr.id, number: pr.number, lineCount: pr.lines.length };
  }

  async maybeAutoReorderAfterStockChange(inventoryItemId: string, userId?: string) {
    try {
      const item = await this.prisma.inventoryItem.findFirst({
        where: { id: inventoryItemId, archivedAt: null },
        include: { balances: true },
      });
      if (!item || !item.isPurchasable) return;
      const available = item.balances.reduce((s, b) => s + Number(b.availableQty), 0);
      const isLow = available <= Number(item.minStock);
      if (!isLow) return;

      if (await this.isLowStockAlertsEnabled()) {
        await this.notifyLowStock(
          [
            {
              sku: item.sku,
              name: item.nameEn || item.nameAr || item.sku,
              available,
              minStock: Number(item.minStock),
            },
          ],
          undefined,
        );
      }

      if (await this.isAutoReorderEnabled()) {
        await this.createFromLowStock({
          requestedById: userId,
          reason: 'AUTO_REORDER',
          inventoryItemIds: [inventoryItemId],
          requireEnabled: false,
          throwIfEmpty: false,
          skipNotify: true,
        });
      }
    } catch (err) {
      this.logger.warn(
        `Auto-reorder after stock change failed for ${inventoryItemId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async notifyLowStock(
    items: Array<{ sku: string; name: string; available: number; minStock: number }>,
    prNumber?: string,
    skip?: boolean,
  ) {
    if (skip || !(await this.isLowStockAlertsEnabled()) || !items.length) return;
    const recipients = await this.prisma.user.findMany({
      where: {
        archivedAt: null,
        isActive: true,
        roles: {
          some: {
            role: {
              code: {
                in: ['SYSTEM_ADMINISTRATOR'],
              },
            },
          },
        },
      },
      select: { id: true },
      take: 30,
    });
    const summary = items
      .slice(0, 5)
      .map((i) => `${i.sku} (${i.available}/${i.minStock})`)
      .join(', ');
    const linkUrl = prNumber
      ? `${process.env.NEXT_PUBLIC_ADMIN_WEB_URL ?? process.env.ADMIN_WEB_URL ?? 'http://localhost:3000'}/purchasing`
      : `${process.env.NEXT_PUBLIC_ADMIN_WEB_URL ?? process.env.ADMIN_WEB_URL ?? 'http://localhost:3000'}/inventory`;

    for (const user of recipients) {
      await this.notifications.sendFromTemplate({
        templateCode: 'LOW_STOCK',
        channel: 'IN_APP',
        to: { userId: user.id },
        vars: {
          count: items.length,
          items: summary,
          prNumber: prNumber ?? '—',
        },
        linkUrl,
      });
    }
  }

  async assertSupplierCertified(supplierId: string) {
    const supplier = await this.prisma.supplier.findUniqueOrThrow({
      where: { id: supplierId },
    });
    if (!supplier.isCertified) {
      throw new BadRequestException({
        code: 'SUPPLIER_NOT_CERTIFIED',
        message: 'Supplier must be certified before creating or sending a purchase order.',
      });
    }
    return supplier;
  }

  /** Prefer WhatsApp number; fall back to phone. */
  supplierWhatsAppTo(supplier: {
    whatsappPhone?: string | null;
    phone?: string | null;
  }): string | null {
    const raw = (supplier.whatsappPhone ?? supplier.phone ?? '').trim();
    return raw || null;
  }

  buildPurchaseOrderWhatsAppBody(po: {
    number: string;
    lines: Array<{ description: string; quantity: unknown; unit?: string | null }>;
  }): string {
    const lines = po.lines
      .map((l) => {
        const qty = Number(l.quantity);
        const qtyLabel = Number.isFinite(qty) ? String(qty) : String(l.quantity);
        const unit = l.unit?.trim() ? ` ${l.unit.trim()}` : '';
        return `• ${l.description}: ${qtyLabel}${unit}`;
      })
      .join('\n');
    return `Purchase order ${po.number}\nPlease supply:\n${lines}\nThank you.`;
  }

  /**
   * Convert an APPROVED PR into a DRAFT PO.
   * Uses selected/cheapest offer when present; otherwise preferredSupplier + standardCost.
   * Does not require certification (supplier was already chosen on the request).
   */
  async convertRequestToPo(prId: string, userId?: string) {
    const pr = await this.prisma.purchaseRequest.findUniqueOrThrow({
      where: { id: prId },
      include: {
        lines: { include: { inventoryItem: { select: { id: true, standardCost: true, unit: true } } } },
        offers: true,
      },
    });
    if (pr.status !== PurchaseRequestStatus.APPROVED) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Purchase request must be approved before conversion.',
      });
    }
    if (pr.purchaseOrderId) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Purchase request already converted.',
      });
    }

    const selectedOffer =
      pr.offers.find((o) => o.isSelected) ??
      [...pr.offers].sort((a, b) => {
        const priceDiff = Number(a.unitPrice) - Number(b.unitPrice);
        if (priceDiff !== 0) return priceDiff;
        return Number(b.qualityScore ?? 0) - Number(a.qualityScore ?? 0);
      })[0];

    let supplierId: string;
    let unitPriceForAll: number | null = null;
    let selectedOfferId: string | null = null;

    if (selectedOffer) {
      supplierId = selectedOffer.supplierId;
      unitPriceForAll = Number(selectedOffer.unitPrice);
      selectedOfferId = selectedOffer.id;
    } else if (pr.preferredSupplierId) {
      supplierId = pr.preferredSupplierId;
    } else {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message:
          'Choose a preferred supplier on the request, or add a supplier offer, before converting.',
      });
    }

    const number = await this.sequences.next('PORD', 'PORD');
    const lines = pr.lines.map((l) => {
      const unitPrice =
        unitPriceForAll != null && Number.isFinite(unitPriceForAll)
          ? unitPriceForAll
          : Number(l.inventoryItem?.standardCost ?? 0) || 0;
      const lineTotal = Number(l.quantity) * unitPrice;
      return {
        description: l.description,
        quantity: roundMoney(Number(l.quantity)),
        unit: l.unit || l.inventoryItem?.unit || 'pcs',
        unitPrice: roundMoney(unitPrice),
        taxRate: roundMoney(0.16),
        lineTotal: roundMoney(lineTotal * 1.16),
        inventoryItemId: l.inventoryItemId ?? undefined,
        salesOrderId: l.salesOrderId ?? undefined,
        salesOrderLineId: l.salesOrderLineId ?? undefined,
        fabricProcurementId: l.fabricProcurementId ?? undefined,
      };
    });
    const subtotal = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice), 0);
    const taxAmount = subtotal * 0.16;

    const po = await this.prisma.$transaction(async (tx) => {
      const created = await tx.purchaseOrder.create({
        data: {
          number,
          supplierId,
          warehouseId: pr.warehouseId ?? undefined,
          status: PurchaseOrderStatus.DRAFT,
          subtotal: roundMoney(subtotal),
          taxAmount: roundMoney(taxAmount),
          total: roundMoney(subtotal + taxAmount),
          notes: pr.reason ?? undefined,
          lines: { create: lines },
        },
        include: { lines: true, supplier: true },
      });
      await tx.purchaseRequest.update({
        where: { id: prId },
        data: {
          status: PurchaseRequestStatus.ORDERED,
          purchaseOrderId: created.id,
        },
      });
      if (selectedOfferId) {
        await tx.supplierQuoteOffer.update({
          where: { id: selectedOfferId },
          data: { isSelected: true },
        });
      }
      return created;
    });

    await this.prisma.auditEvent.create({
      data: {
        userId: userId,
        action: 'purchase-request.convert',
        entityType: 'PurchaseOrder',
        entityId: po.id,
        newValues: { purchaseRequestId: prId },
      },
    });
    return po;
  }

  /**
   * Mark PO SENT and WhatsApp the supplier. Always persists SENT even if WhatsApp fails.
   */
  async sendPurchaseOrder(
    poId: string,
    userId?: string,
  ): Promise<PurchaseOrderSendResult> {
    const existing = await this.prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: poId },
      include: {
        supplier: true,
        lines: true,
      },
    });
    if (
      existing.status !== PurchaseOrderStatus.APPROVED &&
      existing.status !== PurchaseOrderStatus.SENT
    ) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Only approved or sent purchase orders can be messaged to the supplier.',
      });
    }

    const body = this.buildPurchaseOrderWhatsAppBody(existing);
    const to = this.supplierWhatsAppTo(existing.supplier);
    let whatsapp: PurchaseWhatsAppResult = { ok: false, to, body };

    if (!to) {
      whatsapp = {
        ok: false,
        to: null,
        body,
        error: 'Supplier has no WhatsApp or phone number.',
      };
    } else {
      try {
        const result = await this.whatsapp.send({ to, body });
        whatsapp = { ok: Boolean(result.ok), to, body };
        if (!result.ok) {
          whatsapp.error = 'WhatsApp provider reported failure.';
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'WhatsApp send failed.';
        this.logger.warn(`PO ${existing.number} WhatsApp failed: ${message}`);
        whatsapp = { ok: false, to, body, error: message };
      }
    }

    const po = await this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: PurchaseOrderStatus.SENT,
        whatsappSentAt: new Date(),
        whatsappLastBody: body,
        whatsappLastTo: to,
      },
      include: { supplier: true, lines: true },
    });

    await this.prisma.auditEvent.create({
      data: {
        userId: userId,
        action:
          existing.status === PurchaseOrderStatus.SENT
            ? 'purchase-order.resend-whatsapp'
            : 'purchase-order.send',
        entityType: 'PurchaseOrder',
        entityId: poId,
        newValues: {
          whatsappOk: whatsapp.ok,
          whatsappTo: to,
        },
      },
    });

    return { purchaseOrder: po, whatsapp };
  }

  /**
   * One-shot: convert PR → approve PO → send + WhatsApp.
   * Accepts APPROVED (not yet converted) or already-linked ORDERED with a draft/approved PO.
   */
  async sendRequestToSupplier(prId: string, userId?: string): Promise<PurchaseOrderSendResult> {
    let pr = await this.prisma.purchaseRequest.findUniqueOrThrow({
      where: { id: prId },
      include: { purchaseOrder: true },
    });

    if (pr.status === PurchaseRequestStatus.APPROVED && !pr.purchaseOrderId) {
      await this.convertRequestToPo(prId, userId);
      pr = await this.prisma.purchaseRequest.findUniqueOrThrow({
        where: { id: prId },
        include: { purchaseOrder: true },
      });
    }

    if (!pr.purchaseOrderId || !pr.purchaseOrder) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Purchase request must be approved before sending to the supplier.',
      });
    }

    let poStatus = pr.purchaseOrder.status;
    if (poStatus === PurchaseOrderStatus.DRAFT) {
      await this.prisma.purchaseOrder.update({
        where: { id: pr.purchaseOrderId },
        data: { status: PurchaseOrderStatus.APPROVED },
      });
      await this.prisma.auditEvent.create({
        data: {
          userId: userId,
          action: 'purchase-order.approve',
          entityType: 'PurchaseOrder',
          entityId: pr.purchaseOrderId,
        },
      });
      poStatus = PurchaseOrderStatus.APPROVED;
    }

    if (poStatus === PurchaseOrderStatus.SENT) {
      // Resend WhatsApp without flipping status again.
      const po = await this.prisma.purchaseOrder.findUniqueOrThrow({
        where: { id: pr.purchaseOrderId },
        include: { supplier: true, lines: true },
      });
      const body = this.buildPurchaseOrderWhatsAppBody(po);
      const to = this.supplierWhatsAppTo(po.supplier);
      let whatsapp: PurchaseWhatsAppResult = { ok: false, to, body };
      if (!to) {
        whatsapp = {
          ok: false,
          to: null,
          body,
          error: 'Supplier has no WhatsApp or phone number.',
        };
      } else {
        try {
          const result = await this.whatsapp.send({ to, body });
          whatsapp = { ok: Boolean(result.ok), to, body };
          if (!result.ok) whatsapp.error = 'WhatsApp provider reported failure.';
        } catch (err) {
          const message = err instanceof Error ? err.message : 'WhatsApp send failed.';
          whatsapp = { ok: false, to, body, error: message };
        }
      }
      const updated = await this.prisma.purchaseOrder.update({
        where: { id: po.id },
        data: {
          whatsappSentAt: new Date(),
          whatsappLastBody: body,
          whatsappLastTo: to,
        },
        include: { supplier: true, lines: true },
      });
      return { purchaseOrder: updated, whatsapp };
    }

    if (poStatus !== PurchaseOrderStatus.APPROVED) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `Cannot send purchase order in status ${poStatus}.`,
      });
    }

    return this.sendPurchaseOrder(pr.purchaseOrderId, userId);
  }

  async materialDemand() {
    const OPEN_PO = new Set<PurchaseOrderStatus>([
      PurchaseOrderStatus.DRAFT,
      PurchaseOrderStatus.APPROVED,
      PurchaseOrderStatus.SENT,
      PurchaseOrderStatus.PARTIALLY_RECEIVED,
    ]);
    const [items, purchaseOrders, snapRows] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where: { archivedAt: null, itemClass: 'RAW_MATERIAL' },
        select: {
          id: true,
          sku: true,
          nameEn: true,
          nameAr: true,
          nameHe: true,
          unit: true,
          imageUrl: true,
          category: true,
          standardCost: true,
          balances: { select: { availableQty: true, reservedQty: true } },
        },
      }),
      this.prisma.purchaseOrder.findMany({
        where: { archivedAt: null, status: { in: [...OPEN_PO] } },
        select: {
          number: true,
          expectedDeliveryDate: true,
          lines: { select: { inventoryItemId: true, quantity: true } },
          goodsReceipts: {
            select: {
              lines: {
                select: { inventoryItemId: true, receivedQty: true, rejectedQty: true },
              },
            },
          },
        },
      }),
      this.prisma.productionOrderWorkflowSnapshotMaterialInput.findMany({
        where: {
          snapshotNode: {
            isSkipped: false,
            snapshot: {
              productionOrder: {
                archivedAt: null,
                status: { notIn: ['COMPLETED', 'CANCELLED'] },
              },
            },
          },
        },
        select: {
          sku: true,
          qtyPerUnit: true,
          quantityMode: true,
          stageCode: true,
          snapshotNode: {
            select: {
              stageCode: true,
              stageInstanceId: true,
              snapshot: {
                select: {
                  productionOrder: {
                    select: {
                      id: true,
                      number: true,
                      quantity: true,
                      tasks: {
                        select: {
                          stageInstanceId: true,
                          plannedStart: true,
                          stageDefinition: { select: { code: true } },
                        },
                      },
                      schedules: {
                        where: {
                          status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW', 'DRAFT'] },
                        },
                        orderBy: { version: 'desc' },
                        take: 1,
                        select: {
                          allocations: {
                            select: {
                              plannedStart: true,
                              productionTask: {
                                select: {
                                  stageInstanceId: true,
                                  stageDefinition: { select: { code: true } },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    type Need = {
      qty: number;
      requiredBy: Date | null;
      orderNumber: string;
      productionOrderId: string;
      stageCode: string;
    };
    const bySku = new Map<string, Need[]>();
    for (const row of snapRows) {
      const po = row.snapshotNode.snapshot.productionOrder;
      const qty = scaleMaterialQty(Number(row.qtyPerUnit), Number(po.quantity) || 1, row.quantityMode);
      if (!(qty > 0)) continue;
      const stageCode = row.stageCode || row.snapshotNode.stageCode;
      const latest = po.schedules[0];
      const fromAlloc = latest?.allocations.find((a) => {
        const code = a.productionTask?.stageDefinition?.code;
        const instance = a.productionTask?.stageInstanceId;
        return code === stageCode || instance === row.snapshotNode.stageInstanceId;
      })?.plannedStart;
      const fromTask = po.tasks.find(
        (t) =>
          t.stageInstanceId === row.snapshotNode.stageInstanceId ||
          t.stageDefinition?.code === stageCode,
      )?.plannedStart;
      const requiredBy = fromAlloc ?? fromTask ?? null;
      const list = bySku.get(row.sku) ?? [];
      list.push({
        qty,
        requiredBy,
        orderNumber: po.number,
        productionOrderId: po.id,
        stageCode,
      });
      bySku.set(row.sku, list);
    }

    const incomingByItem = new Map<string, Array<{ qty: number; readyAt: Date | null; poNumber: string }>>();
    for (const po of purchaseOrders) {
      const received = new Map<string, number>();
      for (const grn of po.goodsReceipts) {
        for (const line of grn.lines) {
          const accepted = Number(line.receivedQty) - Number(line.rejectedQty ?? 0);
          received.set(line.inventoryItemId, (received.get(line.inventoryItemId) ?? 0) + accepted);
        }
      }
      for (const line of po.lines) {
        if (!line.inventoryItemId) continue;
        const remaining = Number(line.quantity) - (received.get(line.inventoryItemId) ?? 0);
        if (!(remaining > 0)) continue;
        const list = incomingByItem.get(line.inventoryItemId) ?? [];
        list.push({
          qty: remaining,
          readyAt: po.expectedDeliveryDate,
          poNumber: po.number,
        });
        incomingByItem.set(line.inventoryItemId, list);
      }
    }

    return items
      .map((item) => {
        const needs = bySku.get(item.sku) ?? [];
        if (!needs.length) return null;
        const onHand = item.balances.reduce((s, b) => s + Number(b.availableQty), 0);
        const reserved = item.balances.reduce((s, b) => s + Number(b.reservedQty), 0);
        const free = onHand - reserved;
        const requiredQty = needs.reduce((s, n) => s + n.qty, 0);
        const incoming = incomingByItem.get(item.id) ?? [];
        const incomingQty = incoming.reduce((s, r) => s + r.qty, 0);
        const stillNeeded = Math.max(0, requiredQty - Math.max(0, free) - incomingQty);
        const datedRequired = needs
          .map((n) => n.requiredBy)
          .filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()))
          .sort((a, b) => a.getTime() - b.getTime());
        const nextRequiredBy = datedRequired[0] ?? null;
        const status = classifyMaterialDemand({
          requiredQty,
          freeQty: free,
          incoming,
          nextRequiredBy,
        });
        return {
          inventoryItemId: item.id,
          sku: item.sku,
          nameEn: item.nameEn,
          nameAr: item.nameAr,
          nameHe: item.nameHe,
          unit: item.unit,
          category: item.category,
          imageUrl: canonicalInventoryImageUrl(item),
          standardCost: item.standardCost != null ? Number(item.standardCost) : null,
          onHandQty: onHand,
          reservedQty: reserved,
          freeQty: free,
          availableQty: free,
          requiredQty,
          incomingQty,
          stillNeeded,
          nextEta: incoming
            .map((r) => r.readyAt)
            .filter((d): d is Date => d instanceof Date)
            .sort((a, b) => a.getTime() - b.getTime())[0] ?? null,
          nextRequiredBy,
          status,
          incoming: incoming.map((r) => ({
            qty: r.qty,
            eta: r.readyAt,
            purchaseOrderNumber: r.poNumber,
          })),
          affected: needs.map((n) => ({
            productionOrderId: n.productionOrderId,
            productionOrderNumber: n.orderNumber,
            stageCode: n.stageCode,
            qty: n.qty,
            requiredBy: n.requiredBy,
          })),
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => {
        const rank: Record<string, number> = { NO_ETA: 0, SHORTAGE: 1, AT_RISK: 2, COVERED: 3 };
        const rs = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
        if (rs !== 0) return rs;
        return a.sku.localeCompare(b.sku);
      });
  }

  async patchPurchaseOrderEta(id: string, expectedDeliveryDate: Date | null, userId: string) {
    const existing = await this.prisma.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: { lines: { select: { inventoryItemId: true, inventoryItem: { select: { sku: true } } } } },
    });
    const locked = new Set<PurchaseOrderStatus>([
      PurchaseOrderStatus.RECEIVED,
      PurchaseOrderStatus.CANCELLED,
      PurchaseOrderStatus.CLOSED,
    ]);
    if (locked.has(existing.status)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Cannot change ETA on a received or cancelled purchase order.',
      });
    }
    const po = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { expectedDeliveryDate },
      include: { lines: { include: { inventoryItem: true } }, supplier: true },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'purchase-order.update-eta',
        entityType: 'PurchaseOrder',
        entityId: id,
        newValues: { expectedDeliveryDate: expectedDeliveryDate?.toISOString() ?? null },
      },
    });
    const skus = [
      ...new Set(
        existing.lines
          .map((l) => l.inventoryItem?.sku?.trim())
          .filter((sku): sku is string => Boolean(sku)),
      ),
    ];
    const productionOrderIds = await this.productionOrdersAffectedBySkus(skus);
    if (this.schedulingQueue) {
      for (const productionOrderId of productionOrderIds) {
        this.schedulingQueue
          .enqueue('REPLAN', { productionOrderId, event: 'purchase-eta' })
          .catch(() => undefined);
      }
    }
    return { ...po, replannedProductionOrderIds: productionOrderIds };
  }

  private async productionOrdersAffectedBySkus(skus: string[]): Promise<string[]> {
    if (!skus.length) return [];
    const ids = new Set<string>();
    const snapshotHits = await this.prisma.productionOrderWorkflowSnapshotMaterialInput.findMany({
      where: {
        sku: { in: skus },
        snapshotNode: {
          snapshot: {
            productionOrder: { archivedAt: null, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
          },
        },
      },
      select: {
        snapshotNode: { select: { snapshot: { select: { productionOrderId: true } } } },
      },
    });
    for (const row of snapshotHits) ids.add(row.snapshotNode.snapshot.productionOrderId);

    const candidates = await this.prisma.productionOrder.findMany({
      where: {
        archivedAt: null,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        OR: [
          { status: 'WAITING_FOR_MATERIALS' },
          { schedules: { some: { materialReadyAt: { not: null } } } },
        ],
      },
      select: {
        id: true,
        product: { select: { bomDefaults: true } },
        workflowSnapshot: {
          select: { nodes: { select: { materialInputs: { select: { id: true, sku: true } } } } },
        },
      },
    });
    const skuSet = new Set(skus);
    for (const po of candidates) {
      const mapped = (po.workflowSnapshot?.nodes ?? []).flatMap((n) => n.materialInputs ?? []);
      if (mapped.length) {
        if (mapped.some((m) => skuSet.has(m.sku))) ids.add(po.id);
        continue;
      }
      const bom = po.product?.bomDefaults as { materials?: Array<{ sku?: string }> } | null;
      const bomSkus = (bom?.materials ?? []).map((m) => String(m.sku ?? '').trim()).filter(Boolean);
      if (bomSkus.some((sku) => skuSet.has(sku))) ids.add(po.id);
    }
    return [...ids];
  }
}
