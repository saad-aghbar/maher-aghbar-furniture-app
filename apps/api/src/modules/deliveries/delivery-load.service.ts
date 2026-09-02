import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeliveryStatus,
  InventoryItemClass,
  InventoryLotStatus,
  InventoryTracking,
  Prisma,
} from '@maher/database';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { InventoryService } from '../inventory/inventory.service';
import { StagePipelineService } from '../production/stage-pipeline.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InvoicesService } from '../invoices/invoices.service';
import { canonicalInventoryImageUrl } from '../inventory/inventory-image';
import {
  packLabelForPieceIndex,
  pieceLabelsFromMetadata,
  type PieceLabel,
} from '../production/piece-labels';

type Tx = Prisma.TransactionClient;

const OPEN_STATUSES: DeliveryStatus[] = [DeliveryStatus.PLANNED, DeliveryStatus.READY];
const HISTORY_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.OUT_FOR_DELIVERY,
  DeliveryStatus.DELIVERED,
];

@Injectable()
export class DeliveryLoadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly pipeline: StagePipelineService,
    private readonly notifications: NotificationsService,
    private readonly invoices: InvoicesService,
  ) {}

  /** Floor drivers are always scoped to their own assignments. */
  isDriverScoped(user: AuthUser): boolean {
    const roles = user.roles ?? [];
    if (roles.includes('SYSTEM_ADMINISTRATOR')) return false;
    const staffish = roles.some(
      (r) =>
        r === 'DELIVERY_OPERATIONS' ||
        r === 'WAREHOUSE_MANAGEMENT' ||
        r === 'PRODUCTION_SUPERVISOR' ||
        r === 'SALES' ||
        r === 'FINANCE' ||
        r === 'STAFF',
    );
    if (staffish) return false;
    if ((user.permissions ?? []).includes('production-task.update-any')) return false;
    return roles.includes('PRODUCTION_WORKER');
  }

  /** Piece 10: never casually bypass incomplete package checklist. */
  canBypassLoadChecklist(_user: AuthUser): boolean {
    return false;
  }

  async assertDriverAccess(deliveryId: string, user: AuthUser) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      select: {
        id: true,
        number: true,
        status: true,
        driverId: true,
        salesOrderId: true,
        customerId: true,
        deliveryAddress: true,
        deliveryDate: true,
        notes: true,
      },
    });
    if (!delivery) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Delivery not found.' });
    }
    if (this.isDriverScoped(user)) {
      if (delivery.driverId !== user.id) {
        throw new ForbiddenException({
          code: 'DELIVERY_NOT_ASSIGNED',
          message: 'This delivery is not assigned to you.',
        });
      }
    }
    return delivery;
  }

  /**
   * Expand FG lots into package checklist rows.
   * pieceCount = max(1, expectedPieceCount × lot.quantity).
   */
  async materializeLoadPieces(deliveryId: string, salesOrderId: string | null, tx?: Tx) {
    const db = tx ?? this.prisma;
    if (!salesOrderId) return [];

    const lots = await db.inventoryLot.findMany({
      where: {
        salesOrderId,
        status: { in: [InventoryLotStatus.AVAILABLE, InventoryLotStatus.RESERVED] },
        inventoryItem: { itemClass: InventoryItemClass.FINISHED_GOOD, archivedAt: null },
      },
      select: {
        id: true,
        quantity: true,
        productionOrderId: true,
        stageInstanceId: true,
      },
    });

    const stageInstanceIds = [
      ...new Set(lots.map((l) => l.stageInstanceId).filter((id): id is string => Boolean(id))),
    ];
    const snapByStage =
      stageInstanceIds.length > 0
        ? await db.productionOrderWorkflowSnapshotNode.findMany({
            where: { stageInstanceId: { in: stageInstanceIds } },
            select: { stageInstanceId: true, expectedPieceCount: true },
          })
        : [];
    const pieceCountByStage = new Map(
      snapByStage.map((n) => [
        n.stageInstanceId!,
        Math.max(1, Math.floor(Number(n.expectedPieceCount) || 1)),
      ]),
    );

    // Fallback: packaging snapshot expectedPieceCount via production order when stage link missing.
    const poIds = [
      ...new Set(lots.map((l) => l.productionOrderId).filter((id): id is string => Boolean(id))),
    ];
    const packNodes =
      poIds.length > 0
        ? await db.productionOrderWorkflowSnapshotNode.findMany({
            where: {
              snapshot: { productionOrderId: { in: poIds } },
              OR: [
                { inventoryTracking: InventoryTracking.PRODUCES_FINISHED },
                { stageCode: { in: ['PACKAGING', 'PACK'] } },
              ],
              isSkipped: false,
            },
            select: {
              expectedPieceCount: true,
              snapshot: { select: { productionOrderId: true } },
            },
          })
        : [];
    const packCountByPo = new Map<string, number>();
    for (const n of packNodes) {
      const poId = n.snapshot.productionOrderId;
      const count = Math.max(1, Math.floor(Number(n.expectedPieceCount) || 1));
      if (!packCountByPo.has(poId) || count > (packCountByPo.get(poId) ?? 1)) {
        packCountByPo.set(poId, count);
      }
    }

    const desired: Array<{ inventoryLotId: string; pieceIndex: number }> = [];
    for (const lot of lots) {
      const fromStage =
        lot.stageInstanceId != null ? pieceCountByStage.get(lot.stageInstanceId) : undefined;
      const perUnit =
        fromStage != null && fromStage > 0
          ? fromStage
          : lot.productionOrderId
            ? (packCountByPo.get(lot.productionOrderId) ?? 1)
            : 1;
      const qty = Math.max(1, Math.floor(Number(lot.quantity) || 1));
      const pieceCount = Math.max(1, perUnit * qty);
      for (let i = 1; i <= pieceCount; i += 1) {
        desired.push({ inventoryLotId: lot.id, pieceIndex: i });
      }
    }

    const existing = await db.deliveryLoadPiece.findMany({
      where: { deliveryId },
      select: { id: true, inventoryLotId: true, pieceIndex: true, loadedAt: true },
    });
    const existingKey = new Set(existing.map((e) => `${e.inventoryLotId}:${e.pieceIndex}`));
    const desiredKey = new Set(desired.map((d) => `${d.inventoryLotId}:${d.pieceIndex}`));

    const toCreate = desired.filter((d) => !existingKey.has(`${d.inventoryLotId}:${d.pieceIndex}`));
    if (toCreate.length) {
      await db.deliveryLoadPiece.createMany({
        data: toCreate.map((d) => ({
          deliveryId,
          inventoryLotId: d.inventoryLotId,
          pieceIndex: d.pieceIndex,
        })),
        skipDuplicates: true,
      });
    }

    // Drop checklist rows for lots no longer in factory (only if not loaded yet).
    const stale = existing.filter(
      (e) => !desiredKey.has(`${e.inventoryLotId}:${e.pieceIndex}`) && !e.loadedAt,
    );
    if (stale.length) {
      await db.deliveryLoadPiece.deleteMany({
        where: { id: { in: stale.map((s) => s.id) } },
      });
    }

    return db.deliveryLoadPiece.findMany({
      where: { deliveryId },
      orderBy: [{ inventoryLotId: 'asc' }, { pieceIndex: 'asc' }],
    });
  }

  async listMine(
    user: AuthUser,
    query: {
      page: number;
      pageSize: number;
      skip: number;
      take: number;
      scope?: 'open' | 'completed' | 'all';
      status?: string;
      q?: string;
    },
  ) {
    const scope = query.scope ?? 'open';
    const statusFilter =
      query.status != null
        ? { status: query.status as DeliveryStatus }
        : scope === 'open'
          ? { status: { in: OPEN_STATUSES } }
          : scope === 'completed'
            ? { status: { in: HISTORY_STATUSES } }
            : {};

    const where: Prisma.DeliveryWhereInput = {
      driverId: user.id,
      ...statusFilter,
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: 'insensitive' } },
              { customer: { name: { contains: query.q, mode: 'insensitive' } } },
              { customer: { nameEn: { contains: query.q, mode: 'insensitive' } } },
              { customer: { nameAr: { contains: query.q, mode: 'insensitive' } } },
              { salesOrder: { number: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
      // Hide until packaging produced FG (same "don't show locked work" rule).
      ...(scope === 'open'
        ? {
            salesOrderId: { not: null },
            salesOrder: {
              inventoryLots: {
                some: {
                  status: { in: [InventoryLotStatus.AVAILABLE, InventoryLotStatus.RESERVED] },
                  inventoryItem: { itemClass: InventoryItemClass.FINISHED_GOOD, archivedAt: null },
                },
              },
            },
          }
        : {}),
    };

    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.delivery.count({ where }),
      this.prisma.delivery.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              nameAr: true,
              nameEn: true,
              nameHe: true,
              code: true,
            },
          },
          items: true,
          salesOrder: {
            select: {
              id: true,
              number: true,
              status: true,
              projectName: true,
              externalOrderNumber: true,
              lines: {
                orderBy: { sortOrder: 'asc' as const },
                take: 1,
                select: {
                  description: true,
                  product: {
                    select: {
                      nameEn: true,
                      nameAr: true,
                      nameHe: true,
                      imageUrl: true,
                      galleryUrls: true,
                    },
                  },
                },
              },
              inventoryLots: {
                where: {
                  status: {
                    in: [InventoryLotStatus.AVAILABLE, InventoryLotStatus.RESERVED, InventoryLotStatus.DELIVERED],
                  },
                  inventoryItem: {
                    itemClass: InventoryItemClass.FINISHED_GOOD,
                    archivedAt: null,
                  },
                },
                orderBy: { producedAt: 'desc' as const },
                take: 1,
                select: {
                  inventoryItem: {
                    select: {
                      nameEn: true,
                      nameAr: true,
                      nameHe: true,
                      imageUrl: true,
                      product: {
                        select: {
                          nameEn: true,
                          nameAr: true,
                          nameHe: true,
                          imageUrl: true,
                          galleryUrls: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          loadPieces: { select: { id: true, pieceIndex: true, loadedAt: true } },
        },
        orderBy: [{ deliveryDate: 'asc' }, { createdAt: 'desc' }],
        skip: query.skip,
        take: query.take,
      }),
    ]);

    return {
      data: rows.map((d) => {
        const sortedPieces = [...d.loadPieces].sort(
          (a, b) => (a.pieceIndex ?? 0) - (b.pieceIndex ?? 0),
        );
        const total = sortedPieces.length;
        const loaded = sortedPieces.filter((p) => p.loadedAt).length;
        const firstMissing = sortedPieces.find((p) => !p.loadedAt);
        const firstMissingPackageIndex =
          firstMissing != null
            ? firstMissing.pieceIndex != null && firstMissing.pieceIndex > 0
              ? firstMissing.pieceIndex
              : sortedPieces.indexOf(firstMissing) + 1
            : null;
        const { loadPieces: _lp, salesOrder, ...rest } = d;
        const lineProduct = salesOrder?.lines?.[0]?.product;
        const lotItem = salesOrder?.inventoryLots?.[0]?.inventoryItem;
        const lotProduct = lotItem?.product;
        const productTitle =
          lotProduct?.nameEn ||
          lotProduct?.nameAr ||
          lineProduct?.nameEn ||
          lineProduct?.nameAr ||
          lotItem?.nameEn ||
          salesOrder?.lines?.[0]?.description ||
          null;
        const imageUrl =
          lotProduct?.imageUrl ||
          lotProduct?.galleryUrls?.[0] ||
          lineProduct?.imageUrl ||
          lineProduct?.galleryUrls?.[0] ||
          lotItem?.imageUrl ||
          canonicalInventoryImageUrl(lotItem ?? { imageUrl: null }) ||
          null;
        return {
          ...rest,
          salesOrder: salesOrder
            ? {
                id: salesOrder.id,
                number: salesOrder.number,
                status: salesOrder.status,
                projectName: salesOrder.projectName,
                externalOrderNumber: salesOrder.externalOrderNumber,
              }
            : null,
          productTitle,
          productNameEn: lotProduct?.nameEn ?? lineProduct?.nameEn ?? lotItem?.nameEn ?? null,
          productNameAr: lotProduct?.nameAr ?? lineProduct?.nameAr ?? lotItem?.nameAr ?? null,
          productNameHe: lotProduct?.nameHe ?? lineProduct?.nameHe ?? lotItem?.nameHe ?? null,
          imageUrl,
          loadProgress: { loaded, total },
          firstMissingPackageIndex,
          allLoaded: total > 0 && loaded === total,
        };
      }),
      meta: paginatedMeta(query.page, query.pageSize, totalItems),
    };
  }

  async getLoadSheet(deliveryId: string, user: AuthUser) {
    const delivery = await this.assertDriverAccess(deliveryId, user);
    await this.materializeLoadPieces(deliveryId, delivery.salesOrderId);

    const full = await this.prisma.delivery.findUniqueOrThrow({
      where: { id: deliveryId },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            name: true,
            nameEn: true,
            nameAr: true,
            nameHe: true,
          },
        },
        salesOrder: {
          select: {
            id: true,
            number: true,
            status: true,
            projectName: true,
            externalOrderNumber: true,
            deliveryAddress: true,
          },
        },
        loadPieces: {
          orderBy: [{ inventoryLotId: 'asc' }, { pieceIndex: 'asc' }],
          include: {
            inventoryLot: {
              include: {
                inventoryItem: {
                  include: {
                    product: {
                      select: {
                        id: true,
                        nameEn: true,
                        nameAr: true,
                        nameHe: true,
                        imageUrl: true,
                        sku: true,
                      },
                    },
                  },
                },
                warehouse: {
                  select: {
                    id: true,
                    code: true,
                    nameEn: true,
                    nameAr: true,
                    nameHe: true,
                  },
                },
                location: { select: { id: true, code: true, name: true } },
                productionOrder: {
                  select: {
                    id: true,
                    number: true,
                    productDescription: true,
                    quantity: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const poIds = [
      ...new Set(
        full.loadPieces
          .map((p) => p.inventoryLot.productionOrder?.id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const stageInstanceIds = [
      ...new Set(
        full.loadPieces
          .map((p) => (p.inventoryLot as { stageInstanceId?: string | null }).stageInstanceId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    // Prefer stage-linked packaging snapshot; fall back to PO packaging node.
    const packMetaByStage = new Map<string, { count: number; labels: PieceLabel[] }>();
    const packMetaByPo = new Map<string, { count: number; labels: PieceLabel[] }>();
    if (stageInstanceIds.length || poIds.length) {
      const snapNodes = await this.prisma.productionOrderWorkflowSnapshotNode.findMany({
        where: {
          OR: [
            ...(stageInstanceIds.length
              ? [{ stageInstanceId: { in: stageInstanceIds } }]
              : []),
            ...(poIds.length
              ? [
                  {
                    snapshot: { productionOrderId: { in: poIds } },
                    OR: [
                      { inventoryTracking: InventoryTracking.PRODUCES_FINISHED },
                      { stageCode: { in: ['PACKAGING', 'PACK'] } },
                    ],
                    isSkipped: false,
                  },
                ]
              : []),
          ],
        },
        select: {
          stageInstanceId: true,
          expectedPieceCount: true,
          metadata: true,
          snapshot: { select: { productionOrderId: true } },
        },
      });
      for (const n of snapNodes) {
        const labels = pieceLabelsFromMetadata(n.metadata);
        const count = Math.max(
          1,
          labels.length || Math.floor(Number(n.expectedPieceCount) || 1),
        );
        const meta = { count, labels };
        if (n.stageInstanceId) packMetaByStage.set(n.stageInstanceId, meta);
        const poId = n.snapshot.productionOrderId;
        if (poId && !packMetaByPo.has(poId)) packMetaByPo.set(poId, meta);
      }
    }

    const byLot = new Map<string, typeof full.loadPieces>();
    for (const piece of full.loadPieces) {
      const list = byLot.get(piece.inventoryLotId) ?? [];
      list.push(piece);
      byLot.set(piece.inventoryLotId, list);
    }

    const products = [...byLot.entries()].map(([lotId, pieces]) => {
      const lot = pieces[0]!.inventoryLot;
      const item = lot.inventoryItem;
      const product = item.product;
      const totalPieces = pieces.length;
      const imageUrl =
        product?.imageUrl ??
        canonicalInventoryImageUrl(item) ??
        null;
      const stageId = (lot as { stageInstanceId?: string | null }).stageInstanceId ?? null;
      const poId = lot.productionOrder?.id ?? null;
      const packMeta =
        (stageId ? packMetaByStage.get(stageId) : undefined) ??
        (poId ? packMetaByPo.get(poId) : undefined) ??
        null;
      const packagesPerUnit = packMeta?.count ?? Math.max(1, totalPieces);
      return {
        inventoryLotId: lotId,
        productNameEn: product?.nameEn ?? item.nameEn,
        productNameAr: product?.nameAr ?? item.nameAr,
        productNameHe: product?.nameHe ?? item.nameHe,
        sku: item.sku,
        imageUrl,
        lotQuantity: Number(lot.quantity),
        lotQrCode: lot.qrCode,
        warehouse: lot.warehouse,
        location: lot.location,
        productionOrder: lot.productionOrder
          ? {
              id: lot.productionOrder.id,
              number: lot.productionOrder.number,
              productDescription: lot.productionOrder.productDescription,
              quantity: Number(lot.productionOrder.quantity),
            }
          : null,
        pieces: pieces.map((p) => {
          const named = packLabelForPieceIndex(
            packMeta?.labels,
            p.pieceIndex,
            packagesPerUnit,
          );
          const fallback = `Package ${p.pieceIndex} of ${totalPieces}`;
          return {
            id: p.id,
            pieceIndex: p.pieceIndex,
            label: named?.nameEn?.trim() || named?.nameAr?.trim() || fallback,
            nameEn: named?.nameEn ?? null,
            nameAr: named?.nameAr ?? null,
            nameHe: named?.nameHe ?? null,
            loadedAt: p.loadedAt?.toISOString() ?? null,
            loadedById: p.loadedById,
          };
        }),
      };
    });

    const totalPieces = full.loadPieces.length;
    const loadedPieces = full.loadPieces.filter((p) => p.loadedAt).length;

    return {
      id: full.id,
      number: full.number,
      status: full.status,
      deliveryAddress: full.deliveryAddress,
      deliveryDate: full.deliveryDate,
      notes: full.notes,
      driverId: full.driverId,
      customer: full.customer,
      salesOrder: full.salesOrder,
      loadProgress: { loaded: loadedPieces, total: totalPieces },
      allLoaded: totalPieces > 0 && loadedPieces === totalPieces,
      canDepart:
        OPEN_STATUSES.includes(full.status) &&
        totalPieces > 0 &&
        loadedPieces === totalPieces,
      products,
    };
  }

  async setPieceLoaded(deliveryId: string, pieceId: string, user: AuthUser, loaded: boolean) {
    const delivery = await this.assertDriverAccess(deliveryId, user);
    if (!OPEN_STATUSES.includes(delivery.status)) {
      throw new BadRequestException({
        code: 'DELIVERY_NOT_OPENABLE',
        message: 'Cannot change load checklist after this order is confirmed on the truck.',
      });
    }

    const piece = await this.prisma.deliveryLoadPiece.findFirst({
      where: { id: pieceId, deliveryId },
    });
    if (!piece) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Load piece not found.' });
    }

    await this.prisma.deliveryLoadPiece.update({
      where: { id: pieceId },
      data: loaded
        ? { loadedAt: new Date(), loadedById: user.id }
        : { loadedAt: null, loadedById: null },
    });

    // Checking packages only marks them on the truck. Confirm load (depart)
    // is a separate step so the driver can finish other stops on the same run.
    return this.getLoadSheet(deliveryId, user);
  }

  async depart(
    deliveryId: string,
    user: AuthUser,
  ) {
    const existing = await this.assertDriverAccess(deliveryId, user);

    if (existing.status === DeliveryStatus.OUT_FOR_DELIVERY) {
      return this.getLoadSheet(deliveryId, user);
    }
    if (existing.status === DeliveryStatus.DELIVERED) {
      throw new BadRequestException({
        code: 'DELIVERY_ALREADY_DELIVERED',
        message: 'Delivery is already delivered.',
      });
    }
    if (!OPEN_STATUSES.includes(existing.status)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `Cannot depart delivery from status ${existing.status}.`,
      });
    }

    await this.materializeLoadPieces(deliveryId, existing.salesOrderId);
    const pieces = await this.prisma.deliveryLoadPiece.findMany({
      where: { deliveryId },
      select: { id: true, loadedAt: true },
    });
    if (pieces.length === 0) {
      throw new BadRequestException({
        code: 'DELIVERY_NO_FINISHED_GOODS',
        message: 'No finished-goods packages are ready to load for this delivery.',
      });
    }
    const allLoaded = pieces.every((p) => p.loadedAt);
    if (!allLoaded) {
      const missing = pieces.filter((p) => !p.loadedAt).length;
      throw new BadRequestException({
        code: 'DELIVERY_LOAD_INCOMPLETE',
        message:
          missing === 1
            ? '1 package is still missing from this load.'
            : `${missing} packages are still missing from this load.`,
        missing,
        total: pieces.length,
        loaded: pieces.length - missing,
      });
    }

    const delivery = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.delivery.update({
        where: { id: deliveryId },
        data: {
          status: DeliveryStatus.OUT_FOR_DELIVERY,
          ...(existing.driverId ? {} : { driverId: user.id }),
        },
      });

      if (existing.salesOrderId) {
        await this.inventory.issueForDelivery(deliveryId, existing.salesOrderId, user.id, tx);
      }

      // Explicit human confirm only. Legacy audits may still say delivery.depart.auto —
      // that path is removed; do not recreate automatic departure.
      await tx.auditEvent.create({
        data: {
          userId: user.id,
          action: 'delivery.depart',
          entityType: 'Delivery',
          entityId: deliveryId,
          newValues: {
            status: DeliveryStatus.OUT_FOR_DELIVERY,
            driverId: updated.driverId,
          },
        },
      });

      return updated;
    });

    if (existing.salesOrderId) {
      const productionOrders = await this.prisma.productionOrder.findMany({
        where: { salesOrderId: existing.salesOrderId, archivedAt: null },
        select: { id: true },
      });
      for (const po of productionOrders) {
        await this.pipeline.rollupProgress(po.id).catch(() => undefined);
      }
    }

    await this.notifications
      .notifyCustomerUsers(existing.customerId, {
        templateCode: 'DELIVERY_APPROACHING',
        vars: { number: delivery.number },
        linkUrl: `/sales-orders/${existing.salesOrderId ?? ''}`,
      })
      .catch(() => undefined);

    // Order invoice is created when the truck leaves the factory (shipped),
    // not when the dealer confirms delivery.
    if (existing.salesOrderId) {
      await this.invoices
        .ensureFromSalesOrder(existing.salesOrderId, user.id)
        .catch(() => undefined);
    }

    return this.getLoadSheet(deliveryId, user);
  }
}
