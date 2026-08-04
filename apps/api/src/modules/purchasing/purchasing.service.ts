import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PurchaseRequestStatus, Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { roundMoney } from '../../common/helpers/money.util';
import { NotificationsService } from '../notifications/notifications.service';

const OPEN_PR_STATUSES: PurchaseRequestStatus[] = [
  PurchaseRequestStatus.DRAFT,
  PurchaseRequestStatus.SUBMITTED,
  PurchaseRequestStatus.APPROVED,
];

@Injectable()
export class PurchasingService {
  private readonly logger = new Logger(PurchasingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly notifications: NotificationsService,
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
      if (!item) return;
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
}
