import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryTracking,
  Prisma,
  WipKitStatus,
} from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import {
  canConsumeQty,
  custodyFilterForKit,
  incomingWorkStatus,
  kitFeedsConsumerNode,
  remainingReceivable,
  type IncomingWorkStatusKey,
  type WipCustodyFilter,
} from './workflow/domain/wip-handoff';
import { labelForPieceIndex, pieceLabelsFromMetadata } from './piece-labels';
import {
  classifyFloorTaskPhase,
  groupIncomingByPredecessorStage,
  isWipDiscrepancyCategory,
  presentCustody,
  type WipDiscrepancyCategory,
} from './floor-execution';

type Tx = Prisma.TransactionClient;

const kitInclude = {
  productionOrder: {
    select: {
      id: true,
      number: true,
      productDescription: true,
      quantity: true,
      status: true,
      product: {
        select: { id: true, nameEn: true, nameAr: true, nameHe: true, sku: true, imageUrl: true },
      },
      salesOrder: {
        select: {
          id: true,
          number: true,
          customer: {
            select: {
              id: true,
              code: true,
              name: true,
              nameEn: true,
              nameAr: true,
            },
          },
        },
      },
    },
  },
  stageInstance: {
    include: {
      stageDefinition: {
        select: {
          id: true,
          code: true,
          nameEn: true,
          nameAr: true,
          nameHe: true,
        },
      },
    },
  },
  warehouse: { select: { id: true, code: true, nameEn: true, nameAr: true, type: true } },
  location: { select: { id: true, code: true, name: true, warehouseId: true } },
  pieces: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      photoDocument: {
        select: { id: true, fileName: true, storageKey: true, mimeType: true },
      },
      inventoryLot: {
        select: {
          id: true,
          quantity: true,
          status: true,
          qrCode: true,
          inventoryItemId: true,
        },
      },
    },
  },
  producingTask: {
    select: {
      id: true,
      number: true,
      assignedEmployee: {
        select: { id: true, firstName: true, lastName: true },
      },
      materialUsages: {
        select: {
          id: true,
          sku: true,
          expectedQty: true,
          actualQty: true,
          varianceQty: true,
          isExtra: true,
          inventoryItem: {
            select: { id: true, nameEn: true, nameAr: true, sku: true },
          },
        },
      },
    },
  },
  claimedByTask: { select: { id: true, number: true } },
  claimedByUser: {
    select: { id: true, firstName: true, lastName: true },
  },
} satisfies Prisma.WipKitInclude;

export type WipKitDetail = Prisma.WipKitGetPayload<{ include: typeof kitInclude }>;

type IncomingLine = {
  predecessorSnapshotNodeId: string | null;
  predecessorStageInstanceId: string | null;
  fromStageCode: string;
  fromStageNameEn: string;
  fromStageNameAr: string;
  fromStageNameHe: string | null;
  kitId: string | null;
  qrCode: string | null;
  kitStatus: string | null;
  expected: number;
  produced: number;
  available: number;
  received: number;
  outstanding: number;
  statusKey: IncomingWorkStatusKey;
  /** Flattened display fields for worker Incoming cards. */
  outputNameEn: string | null;
  outputNameAr: string | null;
  outputNameHe: string | null;
  thumbDocumentId: string | null;
  productionOrderNumber: string | null;
  salesOrderNumber: string | null;
  yourStageCode: string | null;
  yourStageNameEn: string | null;
  yourStageNameAr: string | null;
  yourStageNameHe: string | null;
  kit: WipKitDetail | null;
};

function firstPieceThumb(kit: WipKitDetail | null): string | null {
  if (!kit?.pieces?.length) return null;
  const withPhoto = [...kit.pieces]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((p) => p.photoDocumentId);
  return withPhoto?.photoDocumentId ?? null;
}

function kitOutputName(kit: WipKitDetail | null): {
  en: string | null;
  ar: string | null;
  he: string | null;
} {
  const product = kit?.productionOrder?.product;
  if (product) {
    return {
      en: product.nameEn ?? null,
      ar: product.nameAr ?? null,
      he: product.nameHe ?? null,
    };
  }
  const desc = kit?.productionOrder?.productDescription?.trim();
  return { en: desc || null, ar: desc || null, he: null };
}

@Injectable()
export class WipKitService {
  constructor(private readonly prisma: PrismaService) {}

  /** Whether this snapshot node should register a WIP kit on produce. */
  static producesWipKit(snap: {
    inventoryTracking: InventoryTracking | string;
    requiresPhotos?: boolean | null;
  }): boolean {
    return (
      snap.inventoryTracking === InventoryTracking.PRODUCES_SEMI_FINISHED ||
      snap.inventoryTracking === 'PRODUCES_SEMI_FINISHED'
    );
  }

  async listBoard(query?: {
    stageCode?: string;
    status?: WipKitStatus | WipKitStatus[];
    productionOrderId?: string;
    /** Waiting pickup / At station / Received / In use */
    custody?: WipCustodyFilter | string;
    /** active = hide consumed; history = presence during from/to (includes consumed) */
    scope?: 'active' | 'history';
    from?: string;
    to?: string;
    warehouseId?: string;
    q?: string;
  }) {
    // Existing SEMI lots (pre-kit era) → READY kits so the floor board is never empty for real stock.
    await this.backfillKitsFromOpenLots();

    const scope = query?.scope === 'history' ? 'history' : 'active';
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    let fromStart: Date | null = null;
    let toEnd: Date | null = null;
    if (scope === 'history') {
      const fromRaw = query?.from
        ? new Date(query.from)
        : new Date(now.getTime() - 30 * dayMs);
      const toRaw = query?.to ? new Date(query.to) : now;
      fromStart = new Date(fromRaw);
      fromStart.setHours(0, 0, 0, 0);
      toEnd = new Date(toRaw);
      toEnd.setHours(23, 59, 59, 999);
    }

    const statusFilter = query?.status
      ? Array.isArray(query.status)
        ? { in: query.status }
        : query.status
      : scope === 'history'
        ? {
            in: [
              WipKitStatus.OPEN,
              WipKitStatus.READY,
              WipKitStatus.CLAIMED,
              WipKitStatus.CONSUMED,
              WipKitStatus.CANCELLED,
            ],
          }
        : { in: [WipKitStatus.OPEN, WipKitStatus.READY, WipKitStatus.CLAIMED, WipKitStatus.CONSUMED] };

    const q = String(query?.q ?? '').trim();
    const kits = await this.prisma.wipKit.findMany({
      where: {
        status: statusFilter,
        productionOrderId: query?.productionOrderId,
        warehouseId: query?.warehouseId || undefined,
        stageInstance: query?.stageCode
          ? { stageDefinition: { code: query.stageCode } }
          : undefined,
        ...(q
          ? {
              OR: [
                { qrCode: { contains: q, mode: 'insensitive' } },
                {
                  productionOrder: {
                    OR: [
                      { number: { contains: q, mode: 'insensitive' } },
                      { productDescription: { contains: q, mode: 'insensitive' } },
                      {
                        product: {
                          OR: [
                            { nameEn: { contains: q, mode: 'insensitive' } },
                            { nameAr: { contains: q, mode: 'insensitive' } },
                            { nameHe: { contains: q, mode: 'insensitive' } },
                            { sku: { contains: q, mode: 'insensitive' } },
                          ],
                        },
                      },
                      {
                        salesOrder: {
                          OR: [
                            { number: { contains: q, mode: 'insensitive' } },
                            { projectName: { contains: q, mode: 'insensitive' } },
                            {
                              customer: {
                                OR: [
                                  { nameEn: { contains: q, mode: 'insensitive' } },
                                  { nameAr: { contains: q, mode: 'insensitive' } },
                                  { name: { contains: q, mode: 'insensitive' } },
                                  { code: { contains: q, mode: 'insensitive' } },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  stageInstance: {
                    stageDefinition: {
                      OR: [
                        { nameEn: { contains: q, mode: 'insensitive' } },
                        { nameAr: { contains: q, mode: 'insensitive' } },
                        { code: { contains: q, mode: 'insensitive' } },
                      ],
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        ...kitInclude,
        handoffs: {
          orderBy: { receivedAt: 'desc' as const },
          select: {
            id: true,
            quantity: true,
            receivedAt: true,
            destinationStageInstanceId: true,
            sourceStageInstanceId: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 500,
    });

    const custody = String(query?.custody ?? '')
      .trim()
      .toUpperCase() as WipCustodyFilter | '';

    let filtered = custody
      ? kits.filter((kit) => {
          const bucket = custodyFilterForKit({
            status: kit.status,
            handoffCount: kit.handoffs?.length ?? 0,
          });
          return bucket === custody;
        })
      : kits;

    if (scope === 'history' && fromStart && toEnd) {
      filtered = filtered.filter((kit) => {
        const entered = kit.createdAt ?? kit.updatedAt;
        if (entered > toEnd!) return false;
        if (
          (kit.status === WipKitStatus.CONSUMED || kit.status === WipKitStatus.CANCELLED) &&
          kit.updatedAt < fromStart!
        ) {
          return false;
        }
        return true;
      });
    }

    // Default board still hides CONSUMED unless history or explicitly filtered by status/custody.
    const boardKits =
      scope === 'history' || query?.status || custody
        ? filtered
        : filtered.filter((k) => k.status !== WipKitStatus.CONSUMED);

    const byStage = new Map<
      string,
      {
        stageCode: string;
        stageNameEn: string;
        stageNameAr: string;
        stageNameHe: string | null;
        kits: Array<WipKitDetail & { custody?: WipCustodyFilter | null; handoffCount?: number }>;
      }
    >();

    for (const kit of boardKits) {
      const def = kit.stageInstance.stageDefinition;
      const code = def.code;
      let section = byStage.get(code);
      if (!section) {
        section = {
          stageCode: code,
          stageNameEn: def.nameEn,
          stageNameAr: def.nameAr,
          stageNameHe: def.nameHe,
          kits: [],
        };
        byStage.set(code, section);
      }
      section.kits.push({
        ...kit,
        custody: custodyFilterForKit({
          status: kit.status,
          handoffCount: kit.handoffs?.length ?? 0,
        }),
        handoffCount: kit.handoffs?.length ?? 0,
      });
    }

    return {
      sections: [...byStage.values()].sort((a, b) =>
        a.stageCode.localeCompare(b.stageCode),
      ),
      totalKits: boardKits.length,
    };
  }

  /**
   * One kit per producing stage instance for open SEMI lots that predate kit registration.
   */
  async backfillKitsFromOpenLots(): Promise<number> {
    const lots = await this.prisma.inventoryLot.findMany({
      where: {
        status: { in: ['AVAILABLE', 'RESERVED', 'PARTIALLY_CONSUMED'] },
        stageInstanceId: { not: null },
        productionOrderId: { not: null },
        inventoryItem: { itemClass: 'SEMI_FINISHED_GOOD', archivedAt: null },
        wipPiece: null,
      },
      select: {
        id: true,
        qrCode: true,
        warehouseId: true,
        locationId: true,
        productionOrderId: true,
        stageInstanceId: true,
      },
      take: 200,
      orderBy: { producedAt: 'desc' },
    });

    let created = 0;
    for (const lot of lots) {
      const stageInstanceId = lot.stageInstanceId!;
      const productionOrderId = lot.productionOrderId!;
      const existing = await this.prisma.wipKit.findUnique({
        where: { stageInstanceId },
        select: { id: true },
      });
      if (existing) {
        // Kit exists but piece not linked to this lot — attach first free piece slot or create one.
        const piece = await this.prisma.wipPiece.findFirst({
          where: { kitId: existing.id, inventoryLotId: null },
          orderBy: { sortOrder: 'asc' },
        });
        if (piece) {
          await this.prisma.wipPiece.update({
            where: { id: piece.id },
            data: { inventoryLotId: lot.id },
          });
        }
        continue;
      }

      const stage = await this.prisma.productionStageInstance.findUnique({
        where: { id: stageInstanceId },
        include: { stageDefinition: { select: { code: true, nameEn: true } } },
      });
      const snapNode = await this.prisma.productionOrderWorkflowSnapshotNode.findFirst({
        where: { stageInstanceId },
        select: { id: true, snapshotId: true, metadata: true, expectedPieceCount: true },
      });
      const nextSnapshotNodeIds = snapNode
        ? (
            await this.prisma.productionOrderWorkflowSnapshotEdge.findMany({
              where: { fromSnapshotNodeId: snapNode.id },
              select: { toSnapshotNodeId: true },
            })
          ).map((e) => e.toSnapshotNodeId)
        : [];

      const qrCode =
        lot.qrCode?.trim() ||
        (await this.allocateKitQr(this.prisma, productionOrderId, stageInstanceId));

      if (!lot.qrCode) {
        await this.prisma.inventoryLot.update({
          where: { id: lot.id },
          data: { qrCode },
        });
      }

      let locationId = lot.locationId;
      if (!locationId && lot.warehouseId && stage?.stageDefinition.code) {
        locationId = await this.resolveOrCreateStageBin(
          this.prisma,
          lot.warehouseId,
          stage.stageDefinition.code,
          stage.stageDefinition.nameEn,
        );
        await this.prisma.inventoryLot.update({
          where: { id: lot.id },
          data: { locationId },
        });
      }

      const backfillLabels = pieceLabelsFromMetadata(snapNode?.metadata);
      const kit = await this.prisma.wipKit.create({
        data: {
          productionOrderId,
          stageInstanceId,
          snapshotNodeId: snapNode?.id ?? null,
          status: WipKitStatus.READY,
          expectedPieceCount: Math.max(
            1,
            backfillLabels.length || Number(snapNode?.expectedPieceCount) || 1,
          ),
          qrCode,
          warehouseId: lot.warehouseId,
          locationId,
          nextSnapshotNodeIds,
        },
      });
      await this.prisma.wipPiece.create({
        data: {
          kitId: kit.id,
          sortOrder: 0,
          label: labelForPieceIndex(backfillLabels, 0),
          inventoryLotId: lot.id,
          qrCode: null,
        },
      });
      created += 1;
    }
    return created;
  }

  async getById(id: string): Promise<WipKitDetail> {
    const kit = await this.prisma.wipKit.findUnique({
      where: { id },
      include: kitInclude,
    });
    if (!kit) {
      throw new NotFoundException({ code: 'WIP_KIT_NOT_FOUND', message: 'WIP kit not found.' });
    }
    return kit;
  }

  async findByScanCode(raw: string): Promise<WipKitDetail> {
    const code = String(raw ?? '').trim();
    if (!code) {
      throw new BadRequestException({ code: 'SCAN_REQUIRED', message: 'Scan code required.' });
    }

    let kit = await this.prisma.wipKit.findFirst({
      where: {
        OR: [
          { qrCode: code },
          { id: code.startsWith('WIPKIT:') ? code.slice('WIPKIT:'.length) : code },
          { pieces: { some: { qrCode: code } } },
          {
            pieces: {
              some: {
                id: code.startsWith('WIPPIECE:') ? code.slice('WIPPIECE:'.length) : '__none__',
              },
            },
          },
        ],
      },
      include: kitInclude,
    });

    if (!kit) {
      const lot = await this.prisma.inventoryLot.findFirst({
        where: { qrCode: code },
        include: { wipPiece: { select: { kitId: true } } },
      });
      if (lot?.wipPiece?.kitId) {
        kit = await this.prisma.wipKit.findUnique({
          where: { id: lot.wipPiece.kitId },
          include: kitInclude,
        });
      }
    }

    if (!kit) {
      throw new NotFoundException({
        code: 'WIP_SCAN_NOT_FOUND',
        message: 'No semi-finished kit matches this QR code.',
      });
    }
    return kit;
  }

  /**
   * After SEMI_FINISHED_RECEIPT: create/update kit + pieces from task photos.
   * Idempotent on stageInstanceId.
   */
  async registerFromTaskComplete(params: {
    tx: Tx;
    productionOrderId: string;
    stageInstanceId: string;
    taskId: string;
    userId: string;
    snapshotNode: {
      id: string;
      inventoryTracking: InventoryTracking | string;
      requiresPhotos: boolean;
      expectedPieceCount: number | null;
      outputQtyPerUnit: Prisma.Decimal | number | null;
      metadata?: unknown;
    };
    photoDocumentIds: string[];
    nextSnapshotNodeIds: string[];
    warehouseId?: string | null;
    materialOverageNotes?: string | null;
  }): Promise<{ kitId: string; qrCode: string } | null> {
    if (!WipKitService.producesWipKit(params.snapshotNode)) return null;

    const expected =
      Number(params.snapshotNode.expectedPieceCount) > 0
        ? Math.floor(Number(params.snapshotNode.expectedPieceCount))
        : 1;

    const photos =
      params.photoDocumentIds.length > 0
        ? params.photoDocumentIds
        : (
            await params.tx.document.findMany({
              where: {
                productionOrderId: params.productionOrderId,
                category: `TASK_PHOTO:${params.taskId}`,
                archivedAt: null,
              },
              orderBy: { createdAt: 'asc' },
              select: { id: true },
            })
          ).map((d) => d.id);

    if (params.snapshotNode.requiresPhotos && photos.length < 1) {
      // Soft target: need at least one photo when synthesizing; mid-task kits
      // with pieces are handled below without rebuilding from flat TASK_PHOTO.
      const existingProbe = await params.tx.wipKit.findUnique({
        where: { stageInstanceId: params.stageInstanceId },
        include: { pieces: { select: { id: true, photoDocumentId: true } } },
      });
      const midTaskPieces =
        existingProbe?.pieces.filter((p) => Boolean(p.photoDocumentId)).length ?? 0;
      if (midTaskPieces < 1) {
        throw new BadRequestException({
          code: 'WIP_PIECES_REQUIRED',
          message: 'Add at least one semi-finished piece with a photo before completion.',
          expectedPieceCount: expected,
          photoCount: photos.length,
        });
      }
    }

    const existing = await params.tx.wipKit.findUnique({
      where: { stageInstanceId: params.stageInstanceId },
      include: { pieces: true },
    });

    const qrCode =
      existing?.qrCode ??
      (await this.allocateKitQr(params.tx, params.productionOrderId, params.stageInstanceId));

    const lot = await params.tx.inventoryLot.findFirst({
      where: {
        productionOrderId: params.productionOrderId,
        stageInstanceId: params.stageInstanceId,
        status: { in: ['AVAILABLE', 'RESERVED'] },
      },
      orderBy: { producedAt: 'desc' },
    });

    const warehouseId = params.warehouseId ?? lot?.warehouseId ?? existing?.warehouseId ?? null;
    const stage = await params.tx.productionStageInstance.findUnique({
      where: { id: params.stageInstanceId },
      include: { stageDefinition: { select: { code: true, nameEn: true } } },
    });
    const locationId =
      warehouseId && stage?.stageDefinition.code
        ? await this.resolveOrCreateStageBin(
            params.tx,
            warehouseId,
            stage.stageDefinition.code,
            stage.stageDefinition.nameEn,
          )
        : null;

    if (lot) {
      await params.tx.inventoryLot.update({
        where: { id: lot.id },
        data: {
          ...(lot.qrCode ? {} : { qrCode }),
          ...(locationId ? { locationId } : {}),
        },
      });
    }

    const kit = existing
      ? await params.tx.wipKit.update({
          where: { id: existing.id },
          data: {
            status: WipKitStatus.READY,
            expectedPieceCount: expected,
            producingTaskId: params.taskId,
            snapshotNodeId: params.snapshotNode.id,
            nextSnapshotNodeIds: params.nextSnapshotNodeIds,
            warehouseId,
            locationId: locationId ?? existing.locationId,
            materialOverageNotes: params.materialOverageNotes ?? undefined,
          },
        })
      : await params.tx.wipKit.create({
          data: {
            productionOrderId: params.productionOrderId,
            stageInstanceId: params.stageInstanceId,
            snapshotNodeId: params.snapshotNode.id,
            producingTaskId: params.taskId,
            status: WipKitStatus.READY,
            expectedPieceCount: expected,
            qrCode,
            warehouseId,
            locationId,
            nextSnapshotNodeIds: params.nextSnapshotNodeIds,
            materialOverageNotes: params.materialOverageNotes ?? null,
          },
        });

    // Mid-task pieces already exist — keep them; only link lot to first piece.
    const midTaskWithPhotos = (existing?.pieces ?? []).filter((p) =>
      Boolean(p.photoDocumentId),
    );
    if (midTaskWithPhotos.length > 0) {
      const first = [...midTaskWithPhotos].sort((a, b) => a.sortOrder - b.sortOrder)[0];
      if (first && lot) {
        await params.tx.wipPiece.update({
          where: { id: first.id },
          data: { inventoryLotId: lot.id },
        });
      }
      return { kitId: kit.id, qrCode: kit.qrCode };
    }

    if (existing?.pieces.length) {
      await params.tx.wipPiece.deleteMany({ where: { kitId: kit.id } });
    }

    const pieceCount = Math.max(photos.length, expected, 1);
    const labels = pieceLabelsFromMetadata(
      params.snapshotNode.metadata ??
        (
          await params.tx.productionOrderWorkflowSnapshotNode.findFirst({
            where: { id: params.snapshotNode.id },
            select: { metadata: true },
          })
        )?.metadata,
    );

    for (let i = 0; i < pieceCount; i++) {
      const photoId = photos[i] ?? photos[photos.length - 1] ?? null;
      const pieceQr =
        pieceCount > 1 ? `${qrCode}-P${String(i + 1).padStart(2, '0')}` : null;
      await params.tx.wipPiece.create({
        data: {
          kitId: kit.id,
          sortOrder: i,
          label: labelForPieceIndex(labels, i),
          photoDocumentId: photoId,
          inventoryLotId: i === 0 ? lot?.id ?? null : null,
          qrCode: pieceQr,
        },
      });
    }

    return { kitId: kit.id, qrCode: kit.qrCode };
  }

  async claimForTask(params: {
    taskId: string;
    userId: string;
    scanCode: string;
  }) {
    // Legacy soft claim → full physical receive of remaining receivable qty.
    return this.receiveForTask({
      taskId: params.taskId,
      userId: params.userId,
      scanCode: params.scanCode,
    });
  }

  async markConsumedForStage(params: {
    tx: Tx;
    productionOrderId: string;
    consumingStageInstanceId: string;
  }) {
    const snap = await params.tx.productionOrderWorkflowSnapshotNode.findFirst({
      where: { stageInstanceId: params.consumingStageInstanceId },
      select: { id: true, consumesSemiFinished: true, snapshotId: true },
    });
    if (!snap?.consumesSemiFinished) return;

    const edges = await params.tx.productionOrderWorkflowSnapshotEdge.findMany({
      where: { snapshotId: snap.snapshotId },
      select: { fromSnapshotNodeId: true, toSnapshotNodeId: true },
    });

    const kits = await params.tx.wipKit.findMany({
      where: {
        productionOrderId: params.productionOrderId,
        status: { in: [WipKitStatus.READY, WipKitStatus.CLAIMED] },
      },
    });

    for (const kit of kits) {
      if (
        !kitFeedsConsumerNode({
          nextSnapshotNodeIds: kit.nextSnapshotNodeIds,
          snapshotNodeId: kit.snapshotNodeId,
          consumerSnapshotNodeId: snap.id,
          edges,
        })
      ) {
        continue;
      }
      await params.tx.wipKit.update({
        where: { id: kit.id },
        data: { status: WipKitStatus.CONSUMED },
      });
    }
  }

  /**
   * Kits / received coverage the consuming task must satisfy before Start.
   * Only DAG predecessors that produce SEMI for this consumesSemiFinished node.
   */
  async claimRequirementsForTask(taskId: string) {
    const incoming = await this.getIncomingForTask(taskId);
    const outstanding = incoming.lines.filter(
      (l) => l.statusKey !== 'RECEIVED' && l.statusKey !== 'WAITING_PRODUCTION',
    );
    // Waiting production also blocks start when consume is required and expected > 0.
    const blocking = incoming.lines.filter((l) => l.statusKey !== 'RECEIVED');
    return {
      required: incoming.required,
      kits: incoming.kits,
      unclaimed: outstanding.flatMap((l) => (l.kit ? [l.kit] : [])),
      allClaimed: incoming.allReceived,
      allReceived: incoming.allReceived,
      lines: incoming.lines,
      blockingCount: blocking.length,
    };
  }

  async getIncomingForTask(taskId: string) {
    const task = await this.prisma.productionTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        productionOrderId: true,
        stageInstanceId: true,
      },
    });
    if (!task?.stageInstanceId) {
      return {
        required: false,
        allReceived: true,
        lines: [] as IncomingLine[],
        kits: [] as WipKitDetail[],
      };
    }

    const snap = await this.prisma.productionOrderWorkflowSnapshotNode.findFirst({
      where: { stageInstanceId: task.stageInstanceId },
      select: {
        id: true,
        consumesSemiFinished: true,
        snapshotId: true,
        nameEnSnapshot: true,
        nameArSnapshot: true,
        nameHeSnapshot: true,
        stageCode: true,
      },
    });
    if (!snap?.consumesSemiFinished) {
      return {
        required: false,
        allReceived: true,
        lines: [] as IncomingLine[],
        kits: [] as WipKitDetail[],
      };
    }

    const edges = await this.prisma.productionOrderWorkflowSnapshotEdge.findMany({
      where: { snapshotId: snap.snapshotId },
      select: { fromSnapshotNodeId: true, toSnapshotNodeId: true },
    });
    const predecessorIds = edges
      .filter((e) => e.toSnapshotNodeId === snap.id)
      .map((e) => e.fromSnapshotNodeId);

    const predecessorNodes =
      predecessorIds.length > 0
        ? await this.prisma.productionOrderWorkflowSnapshotNode.findMany({
            where: { id: { in: predecessorIds }, isSkipped: false },
            select: {
              id: true,
              stageInstanceId: true,
              stageCode: true,
              nameEnSnapshot: true,
              nameArSnapshot: true,
              nameHeSnapshot: true,
              inventoryTracking: true,
              outputQtyPerUnit: true,
              expectedPieceCount: true,
            },
          })
        : [];

    const producingPreds = predecessorNodes.filter(
      (n) => n.inventoryTracking === InventoryTracking.PRODUCES_SEMI_FINISHED,
    );

    const kits = await this.prisma.wipKit.findMany({
      where: {
        productionOrderId: task.productionOrderId,
        status: {
          in: [WipKitStatus.OPEN, WipKitStatus.READY, WipKitStatus.CLAIMED, WipKitStatus.CONSUMED],
        },
      },
      include: kitInclude,
    });

    const relevantKits = kits.filter((k) =>
      kitFeedsConsumerNode({
        nextSnapshotNodeIds: k.nextSnapshotNodeIds,
        snapshotNodeId: k.snapshotNodeId,
        consumerSnapshotNodeId: snap.id,
        edges,
      }),
    );

    const handoffs = await this.prisma.wipHandoff.findMany({
      where: {
        productionOrderId: task.productionOrderId,
        destinationStageInstanceId: task.stageInstanceId,
      },
      select: { kitId: true, quantity: true },
    });

    const receivedByKit = new Map<string, number>();
    for (const h of handoffs) {
      receivedByKit.set(h.kitId, (receivedByKit.get(h.kitId) ?? 0) + Number(h.quantity));
    }

    const po = await this.prisma.productionOrder.findUnique({
      where: { id: task.productionOrderId },
      select: {
        quantity: true,
        number: true,
        salesOrder: { select: { number: true } },
      },
    });
    const orderQty = Number(po?.quantity ?? 1) || 1;
    const productionOrderNumber = po?.number ?? null;
    const salesOrderNumber = po?.salesOrder?.number ?? null;

    const predOutputNames = new Map<
      string,
      { en: string | null; ar: string | null; he: string | null }
    >();
    for (const pred of producingPreds) {
      const full = await this.prisma.productionOrderWorkflowSnapshotNode.findUnique({
        where: { id: pred.id },
        select: {
          outputNameEn: true,
          outputNameAr: true,
          outputNameHe: true,
        },
      });
      predOutputNames.set(pred.id, {
        en: full?.outputNameEn ?? null,
        ar: full?.outputNameAr ?? null,
        he: full?.outputNameHe ?? null,
      });
    }

    const lines: IncomingLine[] = [];
    for (const pred of producingPreds) {
      const kit =
        relevantKits.find((k) => k.stageInstanceId === pred.stageInstanceId) ??
        relevantKits.find((k) => k.snapshotNodeId === pred.id) ??
        null;
      const produced = kit ? await this.kitProducedQty(kit.id) : 0;
      const received = kit ? receivedByKit.get(kit.id) ?? 0 : 0;
      const perUnit = Number(pred.outputQtyPerUnit);
      const expected =
        Number.isFinite(perUnit) && perUnit > 0
          ? perUnit * orderQty
          : Math.max(produced, Number(pred.expectedPieceCount) || 1);
      const statusKey = incomingWorkStatus({ produced, received, expected });
      const names = predOutputNames.get(pred.id) ?? { en: null, ar: null, he: null };
      const fromKit = kitOutputName(kit);
      lines.push({
        predecessorSnapshotNodeId: pred.id,
        predecessorStageInstanceId: pred.stageInstanceId,
        fromStageCode: pred.stageCode,
        fromStageNameEn: pred.nameEnSnapshot,
        fromStageNameAr: pred.nameArSnapshot,
        fromStageNameHe: pred.nameHeSnapshot,
        kitId: kit?.id ?? null,
        qrCode: kit?.qrCode ?? null,
        kitStatus: kit?.status ?? null,
        expected,
        produced,
        available: remainingReceivable(produced, received),
        received,
        outstanding: Math.max(0, expected - received),
        statusKey,
        outputNameEn: names.en || fromKit.en,
        outputNameAr: names.ar || fromKit.ar,
        outputNameHe: names.he || fromKit.he,
        thumbDocumentId: firstPieceThumb(kit),
        productionOrderNumber,
        salesOrderNumber,
        yourStageCode: snap.stageCode,
        yourStageNameEn: snap.nameEnSnapshot,
        yourStageNameAr: snap.nameArSnapshot,
        yourStageNameHe: snap.nameHeSnapshot,
        kit,
      });
    }

    // Also surface kits that feed this node but aren't in producingPreds (edge data quirks).
    for (const kit of relevantKits) {
      if (lines.some((l) => l.kitId === kit.id)) continue;
      const produced = await this.kitProducedQty(kit.id);
      const received = receivedByKit.get(kit.id) ?? 0;
      const expected = Math.max(produced, 1);
      const statusKey = incomingWorkStatus({ produced, received, expected });
      const def = kit.stageInstance.stageDefinition;
      const fromKit = kitOutputName(kit);
      lines.push({
        predecessorSnapshotNodeId: kit.snapshotNodeId,
        predecessorStageInstanceId: kit.stageInstanceId,
        fromStageCode: def.code,
        fromStageNameEn: def.nameEn,
        fromStageNameAr: def.nameAr,
        fromStageNameHe: def.nameHe,
        kitId: kit.id,
        qrCode: kit.qrCode,
        kitStatus: kit.status,
        expected,
        produced,
        available: remainingReceivable(produced, received),
        received,
        outstanding: Math.max(0, expected - received),
        statusKey,
        outputNameEn: fromKit.en,
        outputNameAr: fromKit.ar,
        outputNameHe: fromKit.he,
        thumbDocumentId: firstPieceThumb(kit),
        productionOrderNumber,
        salesOrderNumber,
        yourStageCode: snap.stageCode,
        yourStageNameEn: snap.nameEnSnapshot,
        yourStageNameAr: snap.nameArSnapshot,
        yourStageNameHe: snap.nameHeSnapshot,
        kit,
      });
    }

    const required = lines.length > 0;
    const allReceived =
      !required || lines.every((l) => l.statusKey === 'RECEIVED' || l.expected <= 1e-9);

    const lanes = groupIncomingByPredecessorStage(lines);

    const whereHints = lines
      .filter((l) => l.kit?.location)
      .map((l) => ({
        kitId: l.kitId,
        fromStageCode: l.fromStageCode,
        locationName: l.kit?.location?.name || l.kit?.location?.code || null,
      }))
      .filter((h) => h.locationName);

    return {
      required,
      allReceived,
      lines,
      lanes,
      whereHints,
      kits: relevantKits,
      consumer: {
        snapshotNodeId: snap.id,
        stageCode: snap.stageCode,
        nameEn: snap.nameEnSnapshot,
        nameAr: snap.nameArSnapshot,
        nameHe: snap.nameHeSnapshot,
      },
      floorHint: classifyFloorTaskPhase({
        taskStatus: 'READY',
        consumesSemi: true,
        incomingRequired: required,
        allReceived,
        anyWaitingProduction: lines.some((l) => l.statusKey === 'WAITING_PRODUCTION'),
        anyReadyToCollect: lines.some((l) => l.statusKey === 'READY_TO_COLLECT'),
        anyPartial: lines.some((l) => l.statusKey === 'PARTIALLY_RECEIVED'),
      }),
    };
  }

  async getOutgoingForTask(taskId: string) {
    const task = await this.prisma.productionTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        productionOrderId: true,
        stageInstanceId: true,
      },
    });
    if (!task?.stageInstanceId) {
      return { produces: false, kits: [] as Array<Record<string, unknown>> };
    }

    const snap = await this.prisma.productionOrderWorkflowSnapshotNode.findFirst({
      where: { stageInstanceId: task.stageInstanceId },
      select: {
        id: true,
        inventoryTracking: true,
        snapshotId: true,
        expectedPieceCount: true,
        outputQtyPerUnit: true,
      },
    });
    const produces =
      snap?.inventoryTracking === InventoryTracking.PRODUCES_SEMI_FINISHED;
    if (!produces || !snap) {
      return { produces: false, kits: [] as Array<Record<string, unknown>> };
    }

    const kit = await this.prisma.wipKit.findUnique({
      where: { stageInstanceId: task.stageInstanceId },
      include: {
        ...kitInclude,
        handoffs: {
          orderBy: { receivedAt: 'desc' as const },
          include: {
            receivedBy: { select: { id: true, firstName: true, lastName: true } },
            receivingTask: { select: { id: true, number: true } },
          },
        },
      },
    });

    const edges = await this.prisma.productionOrderWorkflowSnapshotEdge.findMany({
      where: { fromSnapshotNodeId: snap.id },
      select: { toSnapshotNodeId: true },
    });
    const nextNodes =
      edges.length > 0
        ? await this.prisma.productionOrderWorkflowSnapshotNode.findMany({
            where: { id: { in: edges.map((e) => e.toSnapshotNodeId) } },
            select: {
              id: true,
              stageCode: true,
              nameEnSnapshot: true,
              nameArSnapshot: true,
              nameHeSnapshot: true,
            },
          })
        : [];

    if (!kit) {
      return {
        produces: true,
        kits: [],
        nextStages: nextNodes,
        expectedPieceCount: snap.expectedPieceCount,
      };
    }

    const produced = await this.kitProducedQty(kit.id);
    const receivedTotal = (kit.handoffs ?? []).reduce(
      (s, h) => s + Number(h.quantity),
      0,
    );
    return {
      produces: true,
      kits: [
        {
          ...kit,
          produced,
          waitingPickup: remainingReceivable(produced, receivedTotal),
          receivedTotal,
          nextStages: nextNodes,
          custody: custodyFilterForKit({
            status: kit.status,
            handoffCount: kit.handoffs?.length ?? 0,
          }),
        },
      ],
      nextStages: nextNodes,
      expectedPieceCount: snap.expectedPieceCount,
    };
  }

  async getEligibleKitsForTask(taskId: string) {
    const incoming = await this.getIncomingForTask(taskId);
    const eligible = [];
    for (const line of incoming.lines) {
      if (!line.kitId || !line.kit) continue;
      if (line.available <= 1e-9) continue;
      if (line.kit.status !== WipKitStatus.READY && line.kit.status !== WipKitStatus.CLAIMED) {
        continue;
      }
      eligible.push({
        kitId: line.kitId,
        qrCode: line.qrCode,
        fromStageCode: line.fromStageCode,
        fromStageNameEn: line.fromStageNameEn,
        fromStageNameAr: line.fromStageNameAr,
        fromStageNameHe: line.fromStageNameHe,
        available: line.available,
        produced: line.produced,
        received: line.received,
        status: line.kit.status,
        kit: line.kit,
      });
    }
    return { kits: eligible };
  }

  /**
   * Piece 8: report SEMI handoff discrepancy without completing receive.
   * Creates TaskBlocker (PREVIOUS_STAGE_DEFECT) + audit; idempotent by key.
   */
  async reportDiscrepancyForTask(params: {
    taskId: string;
    userId: string;
    category: string;
    notes?: string;
    kitId?: string;
    predecessorStageCode?: string;
    idempotencyKey?: string;
  }) {
    if (!isWipDiscrepancyCategory(params.category)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid discrepancy category.',
      });
    }
    const category = params.category as WipDiscrepancyCategory;

    if (params.idempotencyKey) {
      const prior = await this.prisma.auditEvent.findFirst({
        where: {
          action: 'wip.discrepancy',
          entityType: 'ProductionTask',
          entityId: params.taskId,
          newValues: { path: ['idempotencyKey'], equals: params.idempotencyKey },
        },
      });
      if (prior) {
        return {
          ok: true,
          idempotent: true,
          blockerId:
            prior.newValues &&
            typeof prior.newValues === 'object' &&
            'blockerId' in (prior.newValues as object)
              ? (prior.newValues as { blockerId?: string }).blockerId
              : null,
        };
      }
    }

    const task = await this.prisma.productionTask.findUnique({
      where: { id: params.taskId },
      select: { id: true, productionOrderId: true, assignedEmployeeId: true },
    });
    if (!task) {
      throw new NotFoundException({ code: 'TASK_NOT_FOUND', message: 'Task not found.' });
    }

    const reasonParts = [
      `SEMI handoff discrepancy: ${category}`,
      params.predecessorStageCode ? `from ${params.predecessorStageCode}` : null,
      params.kitId ? `kit ${params.kitId}` : null,
      params.notes?.trim() || null,
    ].filter(Boolean);

    const blocker = await this.prisma.taskBlocker.create({
      data: {
        taskId: task.id,
        category: 'PREVIOUS_STAGE_DEFECT',
        reason: reasonParts.join(' — '),
        reportedById: params.userId,
      },
    });

    await this.prisma.auditEvent.create({
      data: {
        userId: params.userId,
        action: 'wip.discrepancy',
        entityType: 'ProductionTask',
        entityId: task.id,
        newValues: {
          blockerId: blocker.id,
          category,
          kitId: params.kitId ?? null,
          predecessorStageCode: params.predecessorStageCode ?? null,
          notes: params.notes ?? null,
          idempotencyKey: params.idempotencyKey ?? null,
          productionOrderId: task.productionOrderId,
        },
      },
    });

    return {
      ok: true,
      idempotent: false,
      blockerId: blocker.id,
      phase: 'ATTENTION' as const,
      message: 'Discrepancy reported. Receipt was not completed.',
    };
  }

  async receiveForTask(params: {
    taskId: string;
    userId: string;
    scanCode?: string;
    kitId?: string;
    quantity?: number;
    idempotencyKey?: string;
  }) {
    const task = await this.prisma.productionTask.findUnique({
      where: { id: params.taskId },
      select: {
        id: true,
        productionOrderId: true,
        stageInstanceId: true,
      },
    });
    if (!task?.stageInstanceId) {
      throw new NotFoundException({ code: 'TASK_NOT_FOUND', message: 'Task not found.' });
    }

    const snap = await this.prisma.productionOrderWorkflowSnapshotNode.findFirst({
      where: { stageInstanceId: task.stageInstanceId },
      select: {
        id: true,
        consumesSemiFinished: true,
        snapshotId: true,
        stageCode: true,
        nameEnSnapshot: true,
      },
    });
    if (!snap?.consumesSemiFinished) {
      throw new BadRequestException({
        code: 'WIP_RECEIVE_NOT_APPLICABLE',
        message: 'This stage does not receive semi-finished work.',
      });
    }

    if (params.idempotencyKey) {
      const existing = await this.prisma.wipHandoff.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
        include: { kit: { include: kitInclude } },
      });
      if (existing) {
        return {
          handoff: existing,
          kit: existing.kit,
          idempotent: true,
        };
      }
    }

    let kit: WipKitDetail;
    if (params.kitId) {
      kit = await this.getById(params.kitId);
    } else if (params.scanCode) {
      // Distinguish RAW vs WIP when possible
      const code = String(params.scanCode).trim();
      const rawItem = await this.prisma.inventoryItem.findFirst({
        where: {
          OR: [{ sku: code }, { barcode: code }, { qrCode: code }],
          itemClass: { not: 'SEMI_FINISHED_GOOD' },
          archivedAt: null,
        },
        select: { id: true, sku: true, itemClass: true },
      });
      if (rawItem) {
        throw new BadRequestException({
          code: 'WIP_SCAN_IS_RAW',
          message: 'That QR is a raw material, not semi-finished work.',
        });
      }
      try {
        kit = await this.findByScanCode(code);
      } catch (err) {
        if (err instanceof NotFoundException || err instanceof BadRequestException) {
          throw err;
        }
        throw err;
      }
    } else {
      throw new BadRequestException({
        code: 'WIP_RECEIVE_TARGET_REQUIRED',
        message: 'Scan a WIP QR or choose a ready kit.',
      });
    }

    if (kit.productionOrderId !== task.productionOrderId) {
      throw new BadRequestException({
        code: 'WIP_ORDER_MISMATCH',
        message: 'This QR belongs to a different production order.',
      });
    }

    if (kit.status === WipKitStatus.CONSUMED || kit.status === WipKitStatus.CANCELLED) {
      throw new BadRequestException({
        code: 'WIP_KIT_UNAVAILABLE',
        message: 'This semi-finished kit is no longer available.',
      });
    }

    if (kit.status === WipKitStatus.OPEN) {
      throw new BadRequestException({
        code: 'WIP_NOT_READY',
        message: 'This work is still being produced and is not ready to collect.',
      });
    }

    const edges = await this.prisma.productionOrderWorkflowSnapshotEdge.findMany({
      where: { snapshotId: snap.snapshotId },
      select: { fromSnapshotNodeId: true, toSnapshotNodeId: true },
    });
    if (
      !kitFeedsConsumerNode({
        nextSnapshotNodeIds: kit.nextSnapshotNodeIds,
        snapshotNodeId: kit.snapshotNodeId,
        consumerSnapshotNodeId: snap.id,
        edges,
      })
    ) {
      throw new BadRequestException({
        code: 'WIP_WRONG_NEXT_STAGE',
        message: 'This kit is not destined for the current stage.',
      });
    }

    const produced = await this.kitProducedQty(kit.id);
    const alreadyReceivedAgg = await this.prisma.wipHandoff.aggregate({
      where: { kitId: kit.id },
      _sum: { quantity: true },
    });
    const alreadyReceived = Number(alreadyReceivedAgg._sum.quantity ?? 0);
    const available = remainingReceivable(produced, alreadyReceived);
    if (available <= 1e-9) {
      throw new BadRequestException({
        code: 'WIP_NOTHING_TO_RECEIVE',
        message: 'All produced quantity for this kit has already been received.',
      });
    }

    const requested =
      params.quantity != null && Number.isFinite(Number(params.quantity))
        ? Number(params.quantity)
        : available;
    if (!(requested > 0)) {
      throw new BadRequestException({
        code: 'WIP_RECEIVE_QTY_REQUIRED',
        message: 'Receive quantity must be greater than zero.',
      });
    }
    if (requested > available + 1e-9) {
      throw new BadRequestException({
        code: 'WIP_OVER_RECEIVE',
        message: `Cannot receive more than ${available} available.`,
        available,
      });
    }

    const destBin =
      kit.warehouseId && snap.stageCode
        ? await this.resolveOrCreateStageBin(
            this.prisma,
            kit.warehouseId,
            snap.stageCode,
            snap.nameEnSnapshot,
          )
        : null;

    const primaryLotId =
      kit.pieces.find((p) => p.inventoryLotId)?.inventoryLotId ??
      kit.pieces.find((p) => p.inventoryLot)?.inventoryLot?.id ??
      null;

    const handoff = await this.prisma.$transaction(async (tx) => {
      const row = await tx.wipHandoff.create({
        data: {
          kitId: kit.id,
          lotId: primaryLotId,
          productionOrderId: task.productionOrderId,
          sourceStageInstanceId: kit.stageInstanceId,
          destinationStageInstanceId: task.stageInstanceId!,
          quantity: requested,
          receivedById: params.userId,
          receivedAt: new Date(),
          receivingTaskId: params.taskId,
          idempotencyKey: params.idempotencyKey ?? null,
        },
      });
      await tx.wipKit.update({
        where: { id: kit.id },
        data: {
          status: WipKitStatus.CLAIMED,
          claimedAt: new Date(),
          claimedByUserId: params.userId,
          claimedByTaskId: params.taskId,
          ...(destBin ? { locationId: destBin } : {}),
        },
      });
      if (destBin && primaryLotId) {
        await tx.inventoryLot.update({
          where: { id: primaryLotId },
          data: { locationId: destBin },
        });
      }
      return row;
    });

    const updated = await this.getById(kit.id);
    return {
      handoff,
      kit: updated,
      receivedQty: requested,
      availableAfter: remainingReceivable(produced, alreadyReceived + requested),
      idempotent: false,
    };
  }

  async getKitTimeline(kitId: string) {
    const kit = await this.getById(kitId);
    const handoffs = await this.prisma.wipHandoff.findMany({
      where: { kitId },
      orderBy: { receivedAt: 'asc' },
      include: {
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
        receivingTask: { select: { id: true, number: true, name: true } },
      },
    });

    const destIds = [...new Set(handoffs.map((h) => h.destinationStageInstanceId))];
    const destStages =
      destIds.length > 0
        ? await this.prisma.productionStageInstance.findMany({
            where: { id: { in: destIds } },
            include: {
              stageDefinition: {
                select: { code: true, nameEn: true, nameAr: true, nameHe: true },
              },
            },
          })
        : [];
    const destById = new Map(destStages.map((s) => [s.id, s]));

    const events: Array<{
      type: 'PRODUCED' | 'RECEIVED' | 'CONSUMED';
      at: string;
      quantity?: number;
      labelEn: string;
      meta?: Record<string, unknown>;
    }> = [];

    events.push({
      type: 'PRODUCED',
      at: kit.updatedAt.toISOString(),
      quantity: await this.kitProducedQty(kitId),
      labelEn: `Produced at ${kit.stageInstance.stageDefinition.nameEn}`,
      meta: {
        stageCode: kit.stageInstance.stageDefinition.code,
        status: kit.status,
        locationId: kit.locationId,
        locationCode: kit.location?.code ?? null,
      },
    });

    for (const h of handoffs) {
      const dest = destById.get(h.destinationStageInstanceId);
      events.push({
        type: 'RECEIVED',
        at: h.receivedAt.toISOString(),
        quantity: Number(h.quantity),
        labelEn: `Received at ${dest?.stageDefinition.nameEn ?? 'next stage'}`,
        meta: {
          handoffId: h.id,
          receivedBy: h.receivedBy
            ? `${h.receivedBy.firstName} ${h.receivedBy.lastName}`
            : null,
          taskNumber: h.receivingTask?.number ?? null,
          destinationStageCode: dest?.stageDefinition.code ?? null,
        },
      });
    }

    if (kit.status === WipKitStatus.CONSUMED) {
      events.push({
        type: 'CONSUMED',
        at: kit.updatedAt.toISOString(),
        labelEn: 'Consumed in production',
      });
    }

    return {
      kit,
      location: kit.location,
      custody: custodyFilterForKit({
        status: kit.status,
        handoffCount: handoffs.length,
      }),
      events,
      handoffs,
    };
  }

  async assertConsumeWithinReceived(params: {
    tx: Tx;
    productionOrderId: string;
    destinationStageInstanceId: string;
    consumeQty: number;
  }) {
    const receivedAgg = await params.tx.wipHandoff.aggregate({
      where: {
        productionOrderId: params.productionOrderId,
        destinationStageInstanceId: params.destinationStageInstanceId,
      },
      _sum: { quantity: true },
    });
    const received = Number(receivedAgg._sum.quantity ?? 0);

    const issuedTxs = await params.tx.inventoryTransaction.findMany({
      where: {
        type: 'SEMI_FINISHED_ISSUE',
        referenceId: params.productionOrderId,
        idempotencyKey: {
          startsWith: `semi-issue:${params.productionOrderId}:${params.destinationStageInstanceId}:`,
        },
      },
      select: { quantity: true },
    });
    const alreadyConsumed = issuedTxs.reduce((s, t) => s + Number(t.quantity), 0);

    if (
      !canConsumeQty({
        receivedAtDestination: received,
        alreadyConsumedAtDestination: alreadyConsumed,
        consumeQty: params.consumeQty,
      })
    ) {
      throw new BadRequestException({
        code: 'WIP_CONSUME_EXCEEDS_RECEIVED',
        message:
          'Cannot consume more semi-finished quantity than was physically received at this stage.',
        received,
        alreadyConsumed,
        consumeQty: params.consumeQty,
      });
    }
  }

  private async kitProducedQty(kitId: string): Promise<number> {
    const pieces = await this.prisma.wipPiece.findMany({
      where: { kitId },
      include: { inventoryLot: { select: { quantity: true, status: true } } },
    });
    let fromLots = 0;
    for (const p of pieces) {
      if (p.inventoryLot) {
        fromLots += Number(p.inventoryLot.quantity) || 0;
      }
    }

    const receivedAgg = await this.prisma.wipHandoff.aggregate({
      where: { kitId },
      _sum: { quantity: true },
    });
    const alreadyReceived = Number(receivedAgg._sum.quantity ?? 0);

    const kit = await this.prisma.wipKit.findUnique({
      where: { id: kitId },
      select: {
        expectedPieceCount: true,
        status: true,
        stageInstanceId: true,
        productionOrderId: true,
      },
    });
    if (!kit) return 0;

    const orphanLot = await this.prisma.inventoryLot.findFirst({
      where: {
        productionOrderId: kit.productionOrderId,
        stageInstanceId: kit.stageInstanceId,
        status: { in: ['AVAILABLE', 'RESERVED', 'PARTIALLY_CONSUMED', 'CONSUMED'] },
      },
      select: { quantity: true },
      orderBy: { producedAt: 'desc' },
    });
    const orphanQty = orphanLot ? Number(orphanLot.quantity) || 0 : 0;

    const pieceCount = pieces.length;
    const expected =
      kit.status === WipKitStatus.READY ||
      kit.status === WipKitStatus.CLAIMED ||
      kit.status === WipKitStatus.CONSUMED
        ? Math.max(1, kit.expectedPieceCount || 1)
        : 0;

    // Lot qty drops after consume; handoffs preserve the original produce signal.
    return Math.max(fromLots, orphanQty, alreadyReceived, pieceCount, expected > 0 ? expected : 0);
  }

  async assessKitsReadyForOrder(productionOrderId: string): Promise<boolean> {
    const snap = await this.prisma.productionOrderWorkflowSnapshot.findUnique({
      where: { productionOrderId },
      include: { nodes: true, edges: true },
    });
    if (!snap) return true;

    const consumers = snap.nodes.filter((n) => n.consumesSemiFinished && !n.isSkipped);
    if (!consumers.length) return true;

    for (const consumer of consumers) {
      const producers = snap.nodes.filter(
        (n) =>
          !n.isSkipped &&
          n.inventoryTracking === InventoryTracking.PRODUCES_SEMI_FINISHED,
      );
      for (const producer of producers) {
        if (!producer.stageInstanceId) continue;
        const kit = await this.prisma.wipKit.findUnique({
          where: { stageInstanceId: producer.stageInstanceId },
        });
        if (!kit || kit.status === WipKitStatus.OPEN || kit.status === WipKitStatus.CANCELLED) {
          continue;
        }
        if (
          !kitFeedsConsumerNode({
            nextSnapshotNodeIds: kit.nextSnapshotNodeIds,
            snapshotNodeId: kit.snapshotNodeId ?? producer.id,
            consumerSnapshotNodeId: consumer.id,
            edges: snap.edges,
          })
        ) {
          continue;
        }
        if (kit.status !== WipKitStatus.READY && kit.status !== WipKitStatus.CLAIMED) {
          return false;
        }
      }
    }
    return true;
  }

  async listStageBins() {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { type: 'SEMI_FINISHED', isActive: true },
      orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
      include: {
        locations: { orderBy: { code: 'asc' } },
      },
    });
    return {
      warehouse: warehouse
        ? {
            id: warehouse.id,
            code: warehouse.code,
            nameEn: warehouse.nameEn,
            nameAr: warehouse.nameAr,
            type: warehouse.type,
          }
        : null,
      locations: warehouse?.locations ?? [],
    };
  }

  /** Ensure one floor bin per production stage under the default SEMI warehouse. */
  async ensureStageBins() {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { type: 'SEMI_FINISHED', isActive: true },
      orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
    });
    if (!warehouse) {
      throw new BadRequestException({
        code: 'SEMI_WAREHOUSE_MISSING',
        message: 'Create an active SEMI_FINISHED warehouse before stage bins.',
      });
    }

    const stages = await this.prisma.productionStageDefinition.findMany({
      where: { isActive: true },
      select: { code: true, nameEn: true },
      orderBy: { code: 'asc' },
    });

    const created: Array<{ id: string; code: string; name: string | null }> = [];
    for (const stage of stages) {
      const code = this.stageBinCode(stage.code);
      const existing = await this.prisma.warehouseLocation.findUnique({
        where: {
          warehouseId_code: { warehouseId: warehouse.id, code },
        },
      });
      if (existing) {
        created.push(existing);
        continue;
      }
      const row = await this.prisma.warehouseLocation.create({
        data: {
          warehouseId: warehouse.id,
          code,
          name: `${stage.nameEn} bin`,
        },
      });
      created.push(row);
    }

    return { warehouseId: warehouse.id, locations: created };
  }

  async setKitLocation(kitId: string, locationId: string | null) {
    const kit = await this.prisma.wipKit.findUnique({ where: { id: kitId } });
    if (!kit) {
      throw new NotFoundException({ code: 'WIP_KIT_NOT_FOUND', message: 'WIP kit not found.' });
    }

    let warehouseId = kit.warehouseId;
    if (locationId) {
      const location = await this.prisma.warehouseLocation.findUnique({
        where: { id: locationId },
        include: { warehouse: { select: { id: true, type: true } } },
      });
      if (!location) {
        throw new NotFoundException({
          code: 'LOCATION_NOT_FOUND',
          message: 'Warehouse location not found.',
        });
      }
      if (kit.warehouseId && location.warehouseId !== kit.warehouseId) {
        throw new BadRequestException({
          code: 'LOCATION_WAREHOUSE_MISMATCH',
          message: 'Location must belong to the kit warehouse.',
        });
      }
      if (!kit.warehouseId && location.warehouse.type !== 'SEMI_FINISHED') {
        throw new BadRequestException({
          code: 'LOCATION_NOT_SEMI',
          message: 'WIP kits must sit in a SEMI_FINISHED warehouse bin.',
        });
      }
      warehouseId = location.warehouseId;
    }

    const updated = await this.prisma.wipKit.update({
      where: { id: kitId },
      data: { locationId, warehouseId },
      include: kitInclude,
    });

    const lotId = updated.pieces.find((p) => p.inventoryLotId)?.inventoryLotId;
    if (lotId) {
      await this.prisma.inventoryLot.update({
        where: { id: lotId },
        data: { locationId },
      });
    }

    return updated;
  }

  /**
   * Live semi-finished output for a producing task (soft expected piece count).
   */
  async getTaskWipOutput(taskId: string) {
    const ctx = await this.resolveProduceSemiTask(taskId);
    const kit = await this.prisma.wipKit.findUnique({
      where: { stageInstanceId: ctx.stageInstanceId },
      include: kitInclude,
    });
    const snap = await this.prisma.productionOrderWorkflowSnapshotNode.findFirst({
      where: { stageInstanceId: ctx.stageInstanceId },
      select: {
        id: true,
        stageCode: true,
        nameEnSnapshot: true,
        nameArSnapshot: true,
        nameHeSnapshot: true,
        outputNameEn: true,
        outputNameAr: true,
        outputNameHe: true,
      },
    });
    const nextEdges = snap
      ? await this.prisma.productionOrderWorkflowSnapshotEdge.findMany({
          where: { fromSnapshotNodeId: snap.id },
          select: { toSnapshotNodeId: true },
        })
      : [];
    const nextStages =
      nextEdges.length > 0
        ? await this.prisma.productionOrderWorkflowSnapshotNode.findMany({
            where: { id: { in: nextEdges.map((e) => e.toSnapshotNodeId) } },
            select: {
              id: true,
              stageCode: true,
              nameEnSnapshot: true,
              nameArSnapshot: true,
              nameHeSnapshot: true,
            },
          })
        : [];
    const completed = kit?.pieces?.length ?? 0;
    return {
      producesSemiFinished: true,
      expectedPieceCount: ctx.expectedPieceCount,
      requiresPhotos: ctx.requiresPhotos,
      kitId: kit?.id ?? null,
      qrCode: kit?.qrCode ?? null,
      status: kit?.status ?? null,
      completedPieceCount: completed,
      stageCode: snap?.stageCode ?? null,
      stageNameEn: snap?.nameEnSnapshot ?? null,
      stageNameAr: snap?.nameArSnapshot ?? null,
      stageNameHe: snap?.nameHeSnapshot ?? null,
      outputNameEn: snap?.outputNameEn ?? kitOutputName(kit).en,
      outputNameAr: snap?.outputNameAr ?? kitOutputName(kit).ar,
      outputNameHe: snap?.outputNameHe ?? kitOutputName(kit).he,
      nextStages: nextStages.map((n) => ({
        id: n.id,
        stageCode: n.stageCode,
        nameEn: n.nameEnSnapshot,
        nameAr: n.nameArSnapshot,
        nameHe: n.nameHeSnapshot,
      })),
      pieces: (kit?.pieces ?? []).map((p) => ({
        id: p.id,
        sortOrder: p.sortOrder,
        label: p.label,
        qrCode: p.qrCode,
        photoDocumentId: p.photoDocumentId,
        photoDocument: p.photoDocument,
      })),
    };
  }

  async addTaskWipPiece(params: {
    taskId: string;
    userId: string;
    photoDocumentId: string;
    label?: string | null;
  }) {
    const ctx = await this.resolveProduceSemiTask(params.taskId);
    const doc = await this.prisma.document.findFirst({
      where: { id: params.photoDocumentId, archivedAt: null },
      select: { id: true },
    });
    if (!doc) {
      throw new BadRequestException({
        code: 'PHOTO_REQUIRED',
        message: 'Piece photo document not found.',
      });
    }

    await this.prisma.document.update({
      where: { id: doc.id },
      data: {
        productionOrderId: ctx.productionOrderId,
        category: `TASK_PHOTO:${params.taskId}`,
      },
    });

    const kit = await this.ensureLiveKit(ctx, params.taskId);
    const maxSort = await this.prisma.wipPiece.aggregate({
      where: { kitId: kit.id },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
    const pieceQr =
      sortOrder > 0
        ? `${kit.qrCode}-P${String(sortOrder + 1).padStart(2, '0')}`
        : null;
    const label =
      params.label?.trim() || labelForPieceIndex(ctx.pieceLabels, sortOrder);

    await this.prisma.wipPiece.create({
      data: {
        kitId: kit.id,
        sortOrder,
        label,
        photoDocumentId: doc.id,
        qrCode: pieceQr,
      },
    });

    if (sortOrder === 1) {
      const pieces = await this.prisma.wipPiece.findMany({
        where: { kitId: kit.id },
        orderBy: { sortOrder: 'asc' },
      });
      for (const p of pieces) {
        const code = `${kit.qrCode}-P${String(p.sortOrder + 1).padStart(2, '0')}`;
        if (p.qrCode !== code) {
          await this.prisma.wipPiece.update({
            where: { id: p.id },
            data: { qrCode: code },
          });
        }
      }
    }

    return this.getTaskWipOutput(params.taskId);
  }

  async updateTaskWipPiece(params: {
    taskId: string;
    pieceId: string;
    photoDocumentId?: string;
    label?: string | null;
  }) {
    const ctx = await this.resolveProduceSemiTask(params.taskId);
    const piece = await this.prisma.wipPiece.findFirst({
      where: {
        id: params.pieceId,
        kit: { stageInstanceId: ctx.stageInstanceId },
      },
    });
    if (!piece) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Piece not found.' });
    }
    if (params.photoDocumentId) {
      await this.prisma.document.update({
        where: { id: params.photoDocumentId },
        data: {
          productionOrderId: ctx.productionOrderId,
          category: `TASK_PHOTO:${params.taskId}`,
        },
      });
    }
    await this.prisma.wipPiece.update({
      where: { id: piece.id },
      data: {
        ...(params.photoDocumentId ? { photoDocumentId: params.photoDocumentId } : {}),
        ...(params.label !== undefined
          ? { label: params.label?.trim() || piece.label }
          : {}),
      },
    });
    return this.getTaskWipOutput(params.taskId);
  }

  async deleteTaskWipPiece(params: { taskId: string; pieceId: string }) {
    const ctx = await this.resolveProduceSemiTask(params.taskId);
    const piece = await this.prisma.wipPiece.findFirst({
      where: {
        id: params.pieceId,
        kit: { stageInstanceId: ctx.stageInstanceId },
      },
    });
    if (!piece) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Piece not found.' });
    }
    const kitId = piece.kitId;
    await this.prisma.wipPiece.delete({ where: { id: piece.id } });
    const remaining = await this.prisma.wipPiece.findMany({
      where: { kitId },
      orderBy: { sortOrder: 'asc' },
    });
    if (remaining.length === 0) {
      await this.prisma.wipKit.delete({ where: { id: kitId } });
    } else {
      const kit = await this.prisma.wipKit.findUniqueOrThrow({ where: { id: kitId } });
      for (let i = 0; i < remaining.length; i++) {
        const p = remaining[i]!;
        await this.prisma.wipPiece.update({
          where: { id: p.id },
          data: {
            sortOrder: i,
            label: /^Piece \d+$/.test(p.label ?? '') ? `Piece ${i + 1}` : p.label,
            qrCode:
              remaining.length > 1
                ? `${kit.qrCode}-P${String(i + 1).padStart(2, '0')}`
                : null,
          },
        });
      }
    }
    return this.getTaskWipOutput(params.taskId);
  }

  private async resolveProduceSemiTask(taskId: string) {
    const task = await this.prisma.productionTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        productionOrderId: true,
        stageInstanceId: true,
      },
    });
    if (!task?.stageInstanceId) {
      throw new BadRequestException({
        code: 'NO_STAGE_INSTANCE',
        message: 'Task has no stage instance for semi-finished output.',
      });
    }
    const snap = await this.prisma.productionOrderWorkflowSnapshotNode.findFirst({
      where: { stageInstanceId: task.stageInstanceId },
      select: {
        id: true,
        inventoryTracking: true,
        requiresPhotos: true,
        expectedPieceCount: true,
        metadata: true,
      },
    });
    if (!snap || !WipKitService.producesWipKit(snap)) {
      throw new BadRequestException({
        code: 'NOT_PRODUCE_SEMI',
        message: 'This stage does not produce semi-finished kits.',
      });
    }
    const expectedPieceCount =
      Number(snap.expectedPieceCount) > 0
        ? Math.floor(Number(snap.expectedPieceCount))
        : 1;
    return {
      taskId: task.id,
      productionOrderId: task.productionOrderId,
      stageInstanceId: task.stageInstanceId,
      snapshotNodeId: snap.id,
      expectedPieceCount,
      requiresPhotos: Boolean(snap.requiresPhotos),
      pieceLabels: pieceLabelsFromMetadata(snap.metadata),
    };
  }

  private async ensureLiveKit(
    ctx: {
      productionOrderId: string;
      stageInstanceId: string;
      snapshotNodeId: string;
      expectedPieceCount: number;
    },
    taskId: string,
  ) {
    const existing = await this.prisma.wipKit.findUnique({
      where: { stageInstanceId: ctx.stageInstanceId },
    });
    if (existing) {
      return this.prisma.wipKit.update({
        where: { id: existing.id },
        data: {
          producingTaskId: taskId,
          expectedPieceCount: ctx.expectedPieceCount,
          snapshotNodeId: ctx.snapshotNodeId,
          status: WipKitStatus.READY,
        },
      });
    }
    const qrCode = await this.allocateKitQr(
      this.prisma,
      ctx.productionOrderId,
      ctx.stageInstanceId,
    );
    const stage = await this.prisma.productionStageInstance.findUnique({
      where: { id: ctx.stageInstanceId },
      include: { stageDefinition: { select: { code: true, nameEn: true } } },
    });
    const nextSnapshotNodeIds = ctx.snapshotNodeId
      ? (
          await this.prisma.productionOrderWorkflowSnapshotEdge.findMany({
            where: { fromSnapshotNodeId: ctx.snapshotNodeId },
            select: { toSnapshotNodeId: true },
          })
        ).map((e) => e.toSnapshotNodeId)
      : [];
    const semiWh = await this.prisma.warehouse.findFirst({
      where: { type: 'SEMI_FINISHED', isActive: true },
      orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
    });
    const locationId =
      semiWh && stage?.stageDefinition.code
        ? await this.resolveOrCreateStageBin(
            this.prisma,
            semiWh.id,
            stage.stageDefinition.code,
            stage.stageDefinition.nameEn,
          )
        : null;
    return this.prisma.wipKit.create({
      data: {
        productionOrderId: ctx.productionOrderId,
        stageInstanceId: ctx.stageInstanceId,
        snapshotNodeId: ctx.snapshotNodeId,
        producingTaskId: taskId,
        status: WipKitStatus.READY,
        expectedPieceCount: ctx.expectedPieceCount,
        qrCode,
        warehouseId: semiWh?.id ?? null,
        locationId,
        nextSnapshotNodeIds,
      },
    });
  }

  private stageBinCode(stageCode: string): string {
    return String(stageCode ?? 'STG')
      .trim()
      .replace(/[^A-Za-z0-9_-]/g, '')
      .toUpperCase()
      .slice(0, 40) || 'STG';
  }

  private async resolveOrCreateStageBin(
    tx: Tx | PrismaService,
    warehouseId: string,
    stageCode: string,
    stageNameEn?: string | null,
  ): Promise<string> {
    const code = this.stageBinCode(stageCode);
    const existing = await tx.warehouseLocation.findUnique({
      where: { warehouseId_code: { warehouseId, code } },
    });
    if (existing) return existing.id;
    const row = await tx.warehouseLocation.create({
      data: {
        warehouseId,
        code,
        name: stageNameEn ? `${stageNameEn} bin` : `${code} bin`,
      },
    });
    return row.id;
  }

  private async allocateKitQr(
    tx: Tx | PrismaService,
    productionOrderId: string,
    stageInstanceId: string,
  ): Promise<string> {
    const po = await tx.productionOrder.findUnique({
      where: { id: productionOrderId },
      select: { number: true },
    });
    const stage = await tx.productionStageInstance.findUnique({
      where: { id: stageInstanceId },
      include: { stageDefinition: { select: { code: true } } },
    });
    const base = `WIP-${po?.number ?? 'PO'}-${stage?.stageDefinition.code ?? 'STG'}`
      .replace(/[^A-Za-z0-9-]/g, '')
      .toUpperCase();
    let candidate = base;
    let n = 0;
    while (await tx.wipKit.findUnique({ where: { qrCode: candidate } })) {
      n += 1;
      candidate = `${base}-${n}`;
    }
    return candidate;
  }
}
