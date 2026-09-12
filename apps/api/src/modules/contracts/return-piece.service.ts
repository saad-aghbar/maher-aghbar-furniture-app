import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  InventoryTxType,
  Prisma,
  ProductionOrderOriginType,
  ReturnInspectionResult,
  ReturnPieceDecision,
  ReturnPieceState,
  ReturnRecoveryOutcome,
  ReturnResolution,
} from '@maher/database';
import { isReturnWorkflowScope, type AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { roundMoney } from '../../common/helpers/money.util';
import { InventoryService } from '../inventory/inventory.service';
import { WorkflowSnapshotService } from '../production/workflow/workflow-snapshot.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { caseLifecyclePatch, summarizePieces } from './return-case-aggregate';
import {
  assertPieceTransition,
  canTransitionPiece,
  decisionAllowed,
  nextStateAfterDecision,
  nextStateAfterWorkCreated,
  normalizePieceDecision,
  outboundEligibleForDecision,
  type ReturnPieceDecision as PieceDecision,
} from './return-piece-lifecycle';
import {
  LINE_SEED_INCLUDE,
  seedReplacementProductionOrder,
  specificationsFromSnapshot,
  specSnapshotFromLine,
  type ReplacementSeedSnapshot,
} from './return-replacement-seed';
import { productionBlockedBy } from './return-charge-policy';

export const RETURN_PIECE_INCLUDE = {
  product: {
    select: { id: true, sku: true, nameAr: true, nameEn: true, nameHe: true, imageUrl: true },
  },
  salesOrder: { select: { id: true, number: true } },
  salesOrderLine: {
    select: {
      id: true,
      description: true,
      quantity: true,
      productId: true,
      product: {
        select: { id: true, sku: true, nameAr: true, nameEn: true, nameHe: true, imageUrl: true },
      },
    },
  },
  productionOrder: {
    select: {
      id: true,
      number: true,
      originType: true,
      status: true,
      progressPercent: true,
      releasedToFactoryAt: true,
    },
  },
  recoveryOrder: {
    select: {
      id: true,
      number: true,
      originType: true,
      status: true,
      progressPercent: true,
      releasedToFactoryAt: true,
    },
  },
  inventoryLot: {
    select: { id: true, status: true, qrCode: true, warehouseId: true, locationId: true, quantity: true },
  },
  custodyWarehouse: { select: { id: true, code: true, nameEn: true, nameAr: true } },
  custodyLocation: { select: { id: true, code: true, name: true } },
  recoveryLines: { orderBy: { recordedAt: 'asc' as const } },
} satisfies Prisma.ReturnPieceInclude;

const RETURN_WITH_PIECES = {
  pieces: { include: RETURN_PIECE_INCLUDE, orderBy: { pieceNo: 'asc' as const } },
} satisfies Prisma.ReturnRequestInclude;

export async function syncReturnCaseLifecycle(
  db: Prisma.TransactionClient | PrismaService,
  returnId: string,
) {
  const row = await db.returnRequest.findUnique({
    where: { id: returnId },
    include: { pieces: true },
  });
  if (!row) return null;
  const patch = caseLifecyclePatch({
    parentState: row.lifecycleState,
    approvalStatus: row.approvalStatus,
    pieces: row.pieces,
  });
  if (patch.lifecycleState === row.lifecycleState) return row;
  return db.returnRequest.update({
    where: { id: returnId },
    data: patch,
  });
}

@Injectable()
export class ReturnPieceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly inventory: InventoryService,
    private readonly snapshots: WorkflowSnapshotService,
    private readonly scheduling: SchedulingService,
  ) {}

  pieceInclude() {
    return RETURN_PIECE_INCLUDE;
  }

  async listForReturn(returnId: string) {
    return this.prisma.returnPiece.findMany({
      where: { returnRequestId: returnId },
      include: RETURN_PIECE_INCLUDE,
      orderBy: { pieceNo: 'asc' },
    });
  }

  async capabilities(returnId: string, user: AuthUser) {
    const row = await this.loadReturn(returnId);
    const summary = summarizePieces(row.pieces);
    return {
      pieceModel: true,
      decisions: ['REPAIR', 'REPLACEMENT', 'SCRAP_RECOVERY'],
      restockEnabled: false,
      pieceSummary: summary,
      permissions: {
        inspect: this.hasAny(user, ['return.inspect', 'sales-order.update']),
        work: this.hasAny(user, ['return.work', 'sales-order.update']),
        scrapApprove: this.hasAny(user, ['return.scrap.approve', 'sales-order.update']),
        replacementCreate: this.hasAny(user, [
          'return.replacement.create',
          'return.work',
          'sales-order.update',
        ]),
        recoveryPost: this.hasAny(user, ['return.recovery.post', 'return.inspect', 'sales-order.update']),
      },
    };
  }

  async materializePieces(
    returnId: string,
    items?: Array<{
      salesOrderLineId?: string | null;
      quantity: number;
      productDesc?: string;
      productId?: string | null;
      specSnapshot?: ReplacementSeedSnapshot | null;
    }>,
    db?: Prisma.TransactionClient,
  ) {
    const prisma = db ?? this.prisma;
    const row = await prisma.returnRequest.findUnique({
      where: { id: returnId },
      include: {
        pieces: { select: { id: true } },
        salesOrderLine: { include: LINE_SEED_INCLUDE },
      },
    });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return not found.' });
    if (row.pieces.length) {
      return prisma.returnPiece.findMany({
        where: { returnRequestId: returnId },
        include: RETURN_PIECE_INCLUDE,
        orderBy: { pieceNo: 'asc' },
      });
    }

    const planned = items?.length
      ? items
      : [
          {
            salesOrderLineId: row.salesOrderLineId,
            quantity: Math.max(1, Math.round(Number(row.quantity) || 1)),
            productDesc: row.productDesc,
            productId: row.productId,
            specSnapshot: row.salesOrderLine ? specSnapshotFromLine(row.salesOrderLine) : null,
          },
        ];

    const created = [];
    let pieceNo = 1;
    for (const item of planned) {
      const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
      let snapshot = item.specSnapshot ?? null;
      if (!snapshot && item.salesOrderLineId) {
        const line = await prisma.salesOrderLine.findUnique({
          where: { id: item.salesOrderLineId },
          include: LINE_SEED_INCLUDE,
        });
        if (line) snapshot = specSnapshotFromLine(line);
      }
      for (let i = 0; i < qty; i += 1) {
        created.push(
          await prisma.returnPiece.create({
            data: {
              returnRequestId: returnId,
              pieceNo,
              code: `${row.number}-P${pieceNo}`,
              salesOrderId: row.salesOrderId,
              salesOrderLineId: item.salesOrderLineId ?? row.salesOrderLineId,
              productId: item.productId ?? snapshot?.productId ?? row.productId,
              variantId: snapshot?.variantId ?? row.variantId,
              productDesc: item.productDesc || snapshot?.description || row.productDesc,
              specSnapshot: snapshot ? (snapshot as Prisma.InputJsonValue) : undefined,
              state: ReturnPieceState.AWAITING_RECEIPT,
              outboundEligible: true,
            },
            include: RETURN_PIECE_INCLUDE,
          }),
        );
        pieceNo += 1;
      }
    }
    await prisma.returnRequest.update({
      where: { id: returnId },
      data: { quantity: roundMoney(created.length) },
    });
    return created;
  }

  async receivePieces(
    returnId: string,
    user: AuthUser,
    body: {
      pieceIds?: string[];
      receivedCondition?: ReturnInspectionResult | string;
      conditionNotes?: string;
      photoKeys?: string[];
      warehouseId?: string;
      locationId?: string;
    } = {},
  ) {
    const row = await this.loadReturn(returnId);
    if (row.approvalStatus !== 'APPROVED') {
      throw new BadRequestException({
        code: 'RETURN_NOT_APPROVED',
        message: 'Return must be approved before physical receive.',
      });
    }
    if (!row.pieces.length) {
      await this.materializePieces(returnId);
    }
    const pieces = await this.prisma.returnPiece.findMany({
      where: { returnRequestId: returnId },
      orderBy: { pieceNo: 'asc' },
    });
    const selected = body.pieceIds?.length
      ? pieces.filter((piece) => body.pieceIds!.includes(piece.id))
      : pieces;
    if (!selected.length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No return pieces selected to receive.',
      });
    }

    const condition = this.normalizeInspection(body.receivedCondition);
    for (const piece of selected) {
      if (piece.state !== ReturnPieceState.AWAITING_RECEIPT) continue;
      const lot = await this.inventory.quarantineReturn(
        returnId,
        row.salesOrderId,
        1,
        user.id,
        {
          salesOrderLineId: piece.salesOrderLineId,
          productId: piece.productId,
          sourceKey: `return-piece-quarantine:${piece.id}`,
          warehouseId: body.warehouseId,
          locationId: body.locationId,
          pieceId: piece.id,
        },
      );
      await this.prisma.returnPiece.update({
        where: { id: piece.id },
        data: {
          state: ReturnPieceState.RECEIVED,
          receivedAt: new Date(),
          receivedById: user.id,
          receivedCondition: condition,
          conditionNotes: body.conditionNotes?.trim() || piece.conditionNotes,
          photoKeys: body.photoKeys?.length ? body.photoKeys : piece.photoKeys,
          custodyWarehouseId: lot.warehouseId,
          custodyLocationId: lot.locationId,
          inventoryLotId: lot.id,
        },
      });
    }

    const receivedCount = await this.prisma.returnPiece.count({
      where: { returnRequestId: returnId, state: { not: ReturnPieceState.AWAITING_RECEIPT } },
    });
    await this.prisma.returnRequest.update({
      where: { id: returnId },
      data: {
        receivedAt: row.receivedAt ?? new Date(),
        receivedById: row.receivedById ?? user.id,
        collectedAt: row.collectedAt ?? new Date(),
        collectedById: row.collectedById ?? user.id,
        receivedQuantity: roundMoney(receivedCount),
        receivedCondition: body.receivedCondition?.toString() || row.receivedCondition,
        receivedLocationId: body.locationId || row.receivedLocationId,
        receivedNotes: body.conditionNotes?.trim() || row.receivedNotes,
      },
    });
    await this.syncCase(returnId);
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'return.receive',
        entityType: 'ReturnRequest',
        entityId: returnId,
        newValues: { pieceIds: selected.map((piece) => piece.id), receivedCount },
      },
    });
    return this.loadReturn(returnId);
  }

  async decidePieces(
    returnId: string,
    user: AuthUser,
    body: {
      items: Array<{
        pieceId: string;
        decision: PieceDecision;
        inspectionNotes?: string;
        workflowId?: string;
      }>;
    },
  ) {
    const row = await this.loadReturn(returnId);
    const blocked = productionBlockedBy(row.chargeStatus);
    if (blocked) {
      throw new BadRequestException({
        code: 'RETURN_CHARGE_NOT_CONFIRMED',
        message: blocked,
      });
    }
    const items = body.items ?? [];
    if (!items.length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'At least one piece decision is required.',
      });
    }
    const byId = new Map(row.pieces.map((piece) => [piece.id, piece]));
    for (const item of items) {
      const decision = normalizePieceDecision(item.decision);
      if (!decision) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Factory decision must be REPAIR, REPLACEMENT, or SCRAP_RECOVERY.',
        });
      }
      if (decision === 'REPLACEMENT' && !this.hasAny(user, ['return.replacement.create', 'return.work', 'sales-order.update'])) {
        throw new BadRequestException({
          code: 'FORBIDDEN',
          message: 'Replacement requires return.replacement.create.',
        });
      }
      if (decision === 'SCRAP_RECOVERY' && !this.hasAny(user, ['return.scrap.approve', 'return.work', 'return.inspect', 'sales-order.update'])) {
        throw new BadRequestException({
          code: 'FORBIDDEN',
          message: 'Scrap & recover requires return.scrap.approve.',
        });
      }
      const piece = byId.get(item.pieceId);
      if (!piece || piece.returnRequestId !== returnId) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return piece not found.' });
      }
      if (piece.decision) {
        if (piece.decision === decision) continue;
        throw new BadRequestException({
          code: 'RETURN_PIECE_ALREADY_DECIDED',
          message: `Piece ${piece.code} already has a factory decision.`,
        });
      }
      if (!decisionAllowed(piece.state)) {
        throw new BadRequestException({
          code: 'RETURN_PIECE_NOT_RECEIVED',
          message: `Receive piece ${piece.code} before deciding factory work.`,
        });
      }
    }

    for (const item of items) {
      const decision = normalizePieceDecision(item.decision)!;
      const piece = byId.get(item.pieceId)!;
      if (piece.decision === decision) {
        await this.ensurePieceWork(returnId, piece.id, user, decision, item.workflowId);
        continue;
      }
      await this.applyDecision(piece.id, user, decision, item.inspectionNotes, item.workflowId);
    }

    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'return.decide-pieces',
        entityType: 'ReturnRequest',
        entityId: returnId,
        newValues: {
          items: items.map((item) => ({
            pieceId: item.pieceId,
            decision: item.decision,
            workflowId: item.workflowId,
          })),
        },
      },
    });
    return this.loadReturn(returnId);
  }

  async markCaseReady(returnId: string, user: AuthUser, pieceId?: string) {
    const pieces = await this.prisma.returnPiece.findMany({
      where: {
        returnRequestId: returnId,
        ...(pieceId ? { id: pieceId } : {}),
        outboundEligible: true,
        state: { in: [ReturnPieceState.DECIDED, ReturnPieceState.IN_PROGRESS] },
      },
    });
    for (const piece of pieces) {
      if (!(await this.canMarkPieceReady(piece))) continue;
      assertPieceTransition(piece.state, ReturnPieceState.READY_TO_RETURN);
      await this.prisma.returnPiece.update({
        where: { id: piece.id },
        data: {
          state: ReturnPieceState.READY_TO_RETURN,
          readyAt: piece.readyAt ?? new Date(),
        },
      });
    }
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'return.ready-to-return',
        entityType: 'ReturnRequest',
        entityId: returnId,
        newValues: { pieceId: pieceId ?? null },
      },
    });
    return this.syncCase(returnId);
  }

  async cancelPiece(returnId: string, pieceId: string, user: AuthUser) {
    const piece = await this.prisma.returnPiece.findFirst({
      where: { id: pieceId, returnRequestId: returnId },
    });
    if (!piece) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return piece not found.' });
    if (piece.state === ReturnPieceState.CANCELLED) return this.loadReturn(returnId);
    assertPieceTransition(piece.state, ReturnPieceState.CANCELLED);
    await this.unwindPieceWork(piece, user);
    await this.prisma.returnPiece.update({
      where: { id: piece.id },
      data: {
        state: ReturnPieceState.CANCELLED,
        outboundEligible: false,
        resolvedAt: piece.resolvedAt ?? new Date(),
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'return.piece.cancel',
        entityType: 'ReturnPiece',
        entityId: piece.id,
        newValues: { returnId },
      },
    });
    await this.syncCase(returnId);
    return this.loadReturn(returnId);
  }

  async cancelCase(returnId: string, user: AuthUser) {
    const pieces = await this.prisma.returnPiece.findMany({
      where: {
        returnRequestId: returnId,
        state: { notIn: [ReturnPieceState.RETURNED, ReturnPieceState.RECOVERED, ReturnPieceState.CANCELLED] },
      },
    });
    for (const piece of pieces) {
      if (!canTransitionPiece(piece.state, ReturnPieceState.CANCELLED)) continue;
      await this.unwindPieceWork(piece, user);
      await this.prisma.returnPiece.update({
        where: { id: piece.id },
        data: {
          state: ReturnPieceState.CANCELLED,
          outboundEligible: false,
          resolvedAt: piece.resolvedAt ?? new Date(),
        },
      });
    }
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'return.cancel',
        entityType: 'ReturnRequest',
        entityId: returnId,
      },
    });
    await this.syncCase(returnId);
    return this.loadReturn(returnId);
  }

  async onQualityResult(productionOrderId: string, passed: boolean) {
    const piece = await this.prisma.returnPiece.findFirst({
      where: {
        OR: [{ productionOrderId }, { recoveryOrderId: productionOrderId }],
      },
    });
    if (!piece) return null;
    if (!passed) {
      return this.prisma.returnPiece.update({
        where: { id: piece.id },
        data: { qcResult: ReturnInspectionResult.FAIL },
      });
    }
    if (piece.productionOrderId === productionOrderId && outboundEligibleForDecision(piece.decision)) {
      assertPieceTransition(piece.state, ReturnPieceState.READY_TO_RETURN);
      await this.prisma.returnPiece.update({
        where: { id: piece.id },
        data: {
          state: ReturnPieceState.READY_TO_RETURN,
          qcResult: ReturnInspectionResult.PASS,
          readyAt: piece.readyAt ?? new Date(),
        },
      });
    }
    await this.syncCase(piece.returnRequestId);
    return this.prisma.returnPiece.findUnique({ where: { id: piece.id }, include: RETURN_PIECE_INCLUDE });
  }

  async recordRecoveryLine(
    pieceId: string,
    user: AuthUser,
    body: {
      productionTaskId?: string;
      inventoryItemId?: string | null;
      label: string;
      quantity: number;
      unit?: string;
      condition?: ReturnInspectionResult | string;
      outcome: ReturnRecoveryOutcome | string;
      destinationWarehouseId?: string;
      destinationLocationId?: string;
      unitCost?: number;
      notes?: string;
      photoKeys?: string[];
    },
  ) {
    const piece = await this.requireRecoveryPiece(pieceId);
    const outcome = this.normalizeOutcome(body.outcome);
    if (!(Number(body.quantity) > 0)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Recovery quantity must be greater than zero.',
      });
    }
    if (outcome === ReturnRecoveryOutcome.RECOVER_TO_INVENTORY && !body.inventoryItemId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Recovered components need an inventory item.',
      });
    }
    if (outcome === ReturnRecoveryOutcome.RECOVER_TO_INVENTORY && !body.destinationWarehouseId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Recovered components need a destination warehouse.',
      });
    }
    const line = await this.prisma.returnRecoveryLine.create({
      data: {
        returnPieceId: piece.id,
        productionTaskId: body.productionTaskId,
        inventoryItemId: body.inventoryItemId ?? undefined,
        label: body.label.trim(),
        quantity: roundMoney(body.quantity),
        unit: body.unit?.trim() || 'pcs',
        condition: this.normalizeInspection(body.condition),
        outcome,
        destinationWarehouseId: body.destinationWarehouseId,
        destinationLocationId: body.destinationLocationId,
        unitCost: body.unitCost != null ? roundMoney(body.unitCost) : undefined,
        notes: body.notes?.trim() || undefined,
        photoKeys: body.photoKeys ?? [],
        recordedById: user.id,
        idempotencyKey: `return-recovery:${crypto.randomUUID()}`,
      },
    });
    return line;
  }

  async updateRecoveryLine(
    lineId: string,
    user: AuthUser,
    body: {
      inventoryItemId?: string | null;
      label?: string;
      quantity?: number;
      unit?: string;
      outcome?: ReturnRecoveryOutcome | string;
      destinationWarehouseId?: string;
      destinationLocationId?: string | null;
      notes?: string;
    },
  ) {
    const line = await this.prisma.returnRecoveryLine.findUnique({
      where: { id: lineId },
      include: { returnPiece: true },
    });
    if (!line) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recovery line not found.' });
    if (line.postedAt) {
      throw new BadRequestException({
        code: 'RECOVERY_POSTED',
        message: 'Posted recovery lines cannot be edited.',
      });
    }
    void user;
    const outcome = body.outcome != null ? this.normalizeOutcome(body.outcome) : line.outcome;
    const quantity = body.quantity != null ? roundMoney(body.quantity) : line.quantity;
    if (!(Number(quantity) > 0)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Recovery quantity must be greater than zero.',
      });
    }
    return this.prisma.returnRecoveryLine.update({
      where: { id: lineId },
      data: {
        inventoryItemId: body.inventoryItemId === undefined ? undefined : body.inventoryItemId,
        label: body.label != null ? body.label.trim() : undefined,
        quantity,
        unit: body.unit?.trim() || undefined,
        outcome,
        destinationWarehouseId: body.destinationWarehouseId,
        destinationLocationId:
          body.destinationLocationId === undefined ? undefined : body.destinationLocationId,
        notes: body.notes === undefined ? undefined : body.notes.trim() || null,
      },
    });
  }

  async deleteRecoveryLine(lineId: string, user: AuthUser) {
    const line = await this.prisma.returnRecoveryLine.findUnique({ where: { id: lineId } });
    if (!line) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recovery line not found.' });
    if (line.postedAt) {
      throw new BadRequestException({
        code: 'RECOVERY_POSTED',
        message: 'Posted recovery lines cannot be deleted.',
      });
    }
    void user;
    await this.prisma.returnRecoveryLine.delete({ where: { id: lineId } });
    return { ok: true, id: lineId };
  }

  async postRecoveryLine(lineId: string, user: AuthUser) {
    const line = await this.prisma.returnRecoveryLine.findUnique({
      where: { id: lineId },
      include: { returnPiece: true, inventoryItem: { select: { id: true, standardCost: true, unit: true } } },
    });
    if (!line) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recovery line not found.' });
    if (line.postedAt) return line;
    const qty = Number(line.quantity);
    if (line.outcome === ReturnRecoveryOutcome.RECOVER_TO_INVENTORY) {
      if (!line.inventoryItemId || !line.destinationWarehouseId) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Recovered lines need an item and warehouse before posting.',
        });
      }
      await this.inventory.applyMovement({
        type: InventoryTxType.INVENTORY_ADJUSTMENT,
        inventoryItemId: line.inventoryItemId,
        warehouseId: line.destinationWarehouseId,
        locationId: line.destinationLocationId,
        quantity: qty,
        unitCost: Number(line.unitCost ?? line.inventoryItem?.standardCost ?? 0),
        userId: user.id,
        idempotencyKey: line.idempotencyKey,
        referenceType: 'ReturnRecoveryLine',
        referenceId: line.id,
        notes: `Recovered from ${line.returnPiece.code}`,
      });
    } else if (line.inventoryItemId && line.destinationWarehouseId) {
      await this.inventory.applyMovement({
        type: line.outcome === ReturnRecoveryOutcome.DAMAGED ? InventoryTxType.DAMAGE : InventoryTxType.SCRAP,
        inventoryItemId: line.inventoryItemId,
        warehouseId: line.destinationWarehouseId,
        locationId: line.destinationLocationId,
        quantity: qty,
        unitCost: Number(line.unitCost ?? line.inventoryItem?.standardCost ?? 0),
        userId: user.id,
        outbound: true,
        idempotencyKey: line.idempotencyKey,
        referenceType: 'ReturnRecoveryLine',
        referenceId: line.id,
        notes: `${line.outcome} from ${line.returnPiece.code}`,
      });
    }
    const posted = await this.prisma.returnRecoveryLine.update({
      where: { id: line.id },
      data: { postedAt: new Date() },
    });
    await this.maybeCompleteRecovery(line.returnPieceId);
    return posted;
  }

  async completeRecoveryIfPosted(pieceId: string) {
    return this.maybeCompleteRecovery(pieceId);
  }

  async assertRecoveryFinishAllowed(pieceId: string) {
    const lines = await this.prisma.returnRecoveryLine.findMany({
      where: { returnPieceId: pieceId },
      select: { id: true, postedAt: true },
    });
    if (!lines.length || lines.some((line) => !line.postedAt)) {
      throw new BadRequestException({
        code: 'RECOVERY_LINES_UNPOSTED',
        message: 'Post every recovery line before finishing dismantle & recover.',
      });
    }
  }

  async syncCase(returnId: string) {
    return syncReturnCaseLifecycle(this.prisma, returnId);
  }

  private async applyDecision(
    pieceId: string,
    user: AuthUser,
    decision: PieceDecision,
    inspectionNotes?: string,
    workflowId?: string,
  ) {
    const piece = await this.prisma.returnPiece.findUniqueOrThrow({
      where: { id: pieceId },
      include: { returnRequest: true },
    });
    assertPieceTransition(piece.state, nextStateAfterDecision(decision));
    await this.prisma.returnPiece.update({
      where: { id: piece.id },
      data: {
        decision: decision as ReturnPieceDecision,
        state: ReturnPieceState.DECIDED,
        decidedAt: new Date(),
        decidedById: user.id,
        inspectionNotes: inspectionNotes?.trim() || piece.inspectionNotes,
        outboundEligible: outboundEligibleForDecision(decision),
      },
    });

    if (decision === 'REPAIR') {
      await this.createPieceWorkOrder(piece.returnRequestId, piece.id, user, 'RETURN_WORK', workflowId);
    } else if (decision === 'REPLACEMENT') {
      await this.createPieceWorkOrder(piece.returnRequestId, piece.id, user, 'REPLACEMENT', workflowId);
      await this.createPieceWorkOrder(piece.returnRequestId, piece.id, user, 'RETURN_RECOVERY');
    } else {
      await this.createPieceWorkOrder(piece.returnRequestId, piece.id, user, 'RETURN_RECOVERY', workflowId);
    }
    await this.syncCase(piece.returnRequestId);
  }

  private pieceNeedsWork(
    piece: { productionOrderId?: string | null; recoveryOrderId?: string | null },
    decision: PieceDecision,
  ) {
    if (decision === 'REPLACEMENT') return !piece.productionOrderId || !piece.recoveryOrderId;
    if (decision === 'SCRAP_RECOVERY') return !piece.recoveryOrderId;
    return !piece.productionOrderId;
  }

  private async ensurePieceWork(
    returnId: string,
    pieceId: string,
    user: AuthUser,
    decision: PieceDecision,
    workflowId?: string,
  ) {
    const ret = await this.prisma.returnRequest.findUnique({
      where: { id: returnId },
      select: { chargeStatus: true },
    });
    const blocked = productionBlockedBy(ret?.chargeStatus);
    if (blocked) {
      throw new BadRequestException({
        code: 'RETURN_CHARGE_NOT_CONFIRMED',
        message: blocked,
      });
    }
    const piece = await this.prisma.returnPiece.findUniqueOrThrow({
      where: { id: pieceId },
      select: { productionOrderId: true, recoveryOrderId: true },
    });
    if (!this.pieceNeedsWork(piece, decision)) return;
    if (decision === 'REPAIR') {
      await this.createPieceWorkOrder(returnId, pieceId, user, 'RETURN_WORK', workflowId);
    } else if (decision === 'REPLACEMENT') {
      await this.createPieceWorkOrder(returnId, pieceId, user, 'REPLACEMENT', workflowId);
      await this.createPieceWorkOrder(returnId, pieceId, user, 'RETURN_RECOVERY');
    } else {
      await this.createPieceWorkOrder(returnId, pieceId, user, 'RETURN_RECOVERY', workflowId);
    }
  }

  private async createPieceWorkOrder(
    returnId: string,
    pieceId: string,
    user: AuthUser,
    kind: 'RETURN_WORK' | 'REPLACEMENT' | 'RETURN_RECOVERY',
    workflowId?: string,
  ) {
    const piece = await this.prisma.returnPiece.findUniqueOrThrow({
      where: { id: pieceId },
      include: { returnRequest: true },
    });
    if (kind === 'RETURN_RECOVERY' && piece.recoveryOrderId) {
      return this.prisma.productionOrder.findUniqueOrThrow({ where: { id: piece.recoveryOrderId } });
    }
    if (kind !== 'RETURN_RECOVERY' && piece.productionOrderId) {
      return this.prisma.productionOrder.findUniqueOrThrow({ where: { id: piece.productionOrderId } });
    }

    let snapshot = (piece.specSnapshot ?? null) as ReplacementSeedSnapshot | null;
    if (!snapshot && piece.salesOrderLineId) {
      const line = await this.prisma.salesOrderLine.findUnique({
        where: { id: piece.salesOrderLineId },
        include: LINE_SEED_INCLUDE,
      });
      if (line) {
        snapshot = specSnapshotFromLine(line);
        await this.prisma.returnPiece.update({
          where: { id: piece.id },
          data: { specSnapshot: snapshot as Prisma.InputJsonValue },
        });
      }
    }
    const prefix = kind === 'REPLACEMENT' ? 'RP' : kind === 'RETURN_RECOVERY' ? 'RC' : 'RW';
    const number = await this.sequences.next(prefix, prefix);
    const resolvedWorkflowId = await this.resolvePieceWorkflowId(kind, snapshot?.workflowId, workflowId);
    const description =
      kind === 'REPLACEMENT'
        ? `Replacement — ${piece.code} — ${piece.productDesc}`
        : kind === 'RETURN_RECOVERY'
          ? `Dismantle & recover — ${piece.code} — ${piece.productDesc}`
          : `Return repair — ${piece.code} — ${piece.productDesc}`;

    const productionOrder = await this.prisma.$transaction(async (tx) => {
      const created = await tx.productionOrder.create({
        data: {
          number,
          salesOrderId: null,
          salesOrderLineId: null,
          customerId: piece.returnRequest.customerId,
          productId: piece.productId ?? undefined,
          productDescription: description,
          quantity: roundMoney(1),
          specifications: specificationsFromSnapshot(snapshot),
          status: 'PLANNED',
          priority: 'HIGH',
          originType:
            kind === 'REPLACEMENT'
              ? ProductionOrderOriginType.REPLACEMENT
              : kind === 'RETURN_RECOVERY'
                ? ProductionOrderOriginType.RETURN_RECOVERY
                : ProductionOrderOriginType.RETURN_WORK,
          returnRequestId: returnId,
          returnPieceId: piece.id,
          createdById: user.id,
          notes: `returnId=${returnId}; piece=${piece.code}`,
        },
      });

      await this.snapshots.createSnapshotForProductionOrder(
        {
          productionOrderId: created.id,
          productId: piece.productId,
          productDescription: created.productDescription,
          quantity: 1,
          specifications: created.specifications,
          createdById: user.id,
          workflowId: resolvedWorkflowId,
        },
        tx,
      );

      if (kind === 'REPLACEMENT' || kind === 'RETURN_WORK') {
        await seedReplacementProductionOrder(tx, created.id, snapshot);
      }

      if (piece.inventoryLotId && kind !== 'REPLACEMENT') {
        await tx.inventoryLot.update({
          where: { id: piece.inventoryLotId },
          data: { productionOrderId: created.id },
        });
      }

      await tx.returnPiece.update({
        where: { id: piece.id },
        data: {
          state: nextStateAfterWorkCreated(),
          ...(kind === 'RETURN_RECOVERY'
            ? { recoveryOrderId: created.id }
            : { productionOrderId: created.id }),
        },
      });

      const resolution =
        kind === 'REPLACEMENT'
          ? ReturnResolution.REPLACEMENT
          : kind === 'RETURN_WORK'
            ? ReturnResolution.REPAIR
            : piece.returnRequest.resolution;
      await tx.returnRequest.update({
        where: { id: returnId },
        data: {
          resolution: resolution ?? undefined,
          inventoryFate: kind === 'RETURN_RECOVERY' && !piece.productionOrderId ? 'SCRAP' : 'REWORK',
        },
      });
      return created;
    });

    await this.prisma.productionTask.updateMany({
      where: { productionOrderId: productionOrder.id },
      data: { priority: 'HIGH' },
    });
    try {
      await this.scheduling.generateForProductionOrder(productionOrder.id, user.id, {
        persist: true,
        reason: 'return-work-created',
        failHard: false,
      });
    } catch {
      /* Admin can still assign the return lane manually. */
    }

    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action:
          kind === 'REPLACEMENT'
            ? 'return.replacement-po'
            : kind === 'RETURN_RECOVERY'
              ? 'return.recovery-po'
              : 'return.work-order',
        entityType: 'ReturnPiece',
        entityId: piece.id,
        newValues: {
          productionOrderId: productionOrder.id,
          productionOrderNumber: productionOrder.number,
          originType: kind,
        },
      },
    });
    return productionOrder;
  }

  private async resolvePieceWorkflowId(
    kind: 'RETURN_WORK' | 'REPLACEMENT' | 'RETURN_RECOVERY',
    snapshotWorkflowId?: string | null,
    pickedWorkflowId?: string,
  ): Promise<string | undefined> {
    if (pickedWorkflowId) {
      const workflow = await this.prisma.productionWorkflow.findFirst({
        where: { id: pickedWorkflowId, archivedAt: null, status: { not: 'ARCHIVED' } },
        select: { id: true, scope: true },
      });
      if (!workflow || !isReturnWorkflowScope(workflow.scope)) {
        throw new BadRequestException({
          code: 'WORKFLOW_SCOPE_MISMATCH',
          message: 'Pick a return / recovery workflow for this piece.',
        });
      }
      return workflow.id;
    }
    if (kind === 'RETURN_RECOVERY') return this.resolveRecoveryWorkflowId();
    return snapshotWorkflowId ?? undefined;
  }

  private async resolveRecoveryWorkflowId(): Promise<string | undefined> {
    const withDismantle = await this.prisma.productionWorkflow.findFirst({
      where: {
        scope: 'RETURN',
        archivedAt: null,
        status: { not: 'ARCHIVED' },
        activeVersion: {
          nodes: { some: { stageDefinition: { code: 'DISMANTLE_RECOVER' } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    if (withDismantle) return withDismantle.id;
    const named = await this.prisma.productionWorkflow.findFirst({
      where: { code: 'RETURN_RECOVERY', archivedAt: null },
      select: { id: true },
    });
    return named?.id;
  }

  private async maybeCompleteRecovery(pieceId: string) {
    const piece = await this.prisma.returnPiece.findUnique({
      where: { id: pieceId },
      include: { recoveryLines: true },
    });
    if (!piece) return null;
    if (!piece.recoveryLines.length) return piece;
    if (piece.recoveryLines.some((line) => !line.postedAt)) return piece;
    if (piece.state === ReturnPieceState.RECOVERED) return piece;
    assertPieceTransition(piece.state, ReturnPieceState.RECOVERED);
    const updated = await this.prisma.returnPiece.update({
      where: { id: piece.id },
      data: {
        state: ReturnPieceState.RECOVERED,
        outboundEligible: false,
        resolvedAt: piece.resolvedAt ?? new Date(),
      },
    });
    await this.inventory.writeOffReturnPieceQuarantine({
      pieceId: piece.id,
      userId: piece.decidedById ?? piece.receivedById ?? 'system',
      reason: `Recovered ${piece.code}`,
    });
    await this.syncCase(piece.returnRequestId);
    return updated;
  }

  private async canMarkPieceReady(piece: {
    productionOrderId?: string | null;
    outboundEligible?: boolean | null;
  }): Promise<boolean> {
    if (!piece.outboundEligible || !piece.productionOrderId) return false;
    const open = await this.prisma.productionTask.count({
      where: {
        productionOrderId: piece.productionOrderId,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
    });
    return open === 0;
  }

  private async unwindPieceWork(
    piece: { id: string; productionOrderId?: string | null; recoveryOrderId?: string | null; code: string },
    user: AuthUser,
  ) {
    const ids = [piece.productionOrderId, piece.recoveryOrderId].filter(
      (id): id is string => Boolean(id),
    );
    if (ids.length) {
      await this.prisma.productionOrder.updateMany({
        where: { id: { in: ids }, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        data: { status: 'CANCELLED' },
      });
      await this.prisma.productionTask.updateMany({
        where: { productionOrderId: { in: ids }, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        data: { status: 'CANCELLED' },
      });
    }
    await this.inventory.writeOffReturnPieceQuarantine({
      pieceId: piece.id,
      userId: user.id,
      reason: `Cancelled ${piece.code}`,
    });
  }

  private async requireRecoveryPiece(pieceId: string) {
    const piece = await this.prisma.returnPiece.findUnique({ where: { id: pieceId } });
    if (!piece) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return piece not found.' });
    if (piece.decision !== ReturnPieceDecision.SCRAP_RECOVERY && !piece.recoveryOrderId) {
      throw new BadRequestException({
        code: 'RETURN_PIECE_NOT_RECOVERY',
        message: 'This piece is not in dismantle & recover.',
      });
    }
    return piece;
  }

  private async loadReturn(returnId: string) {
    const row = await this.prisma.returnRequest.findUnique({
      where: { id: returnId },
      include: RETURN_WITH_PIECES,
    });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return not found.' });
    return row;
  }

  private normalizeInspection(value?: string | null): ReturnInspectionResult | undefined {
    const raw = String(value ?? '').trim().toUpperCase();
    if (raw === 'PASS' || raw === 'FAIL' || raw === 'PARTIAL') return raw;
    return undefined;
  }

  private normalizeOutcome(value: string): ReturnRecoveryOutcome {
    const raw = String(value ?? '').trim().toUpperCase();
    if (raw === 'RECOVER_TO_INVENTORY' || raw === 'DISPOSE' || raw === 'DAMAGED') {
      return raw as ReturnRecoveryOutcome;
    }
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Recovery outcome must be RECOVER_TO_INVENTORY, DISPOSE, or DAMAGED.',
    });
  }

  private hasAny(user: AuthUser, codes: string[]) {
    const set = new Set(user.permissions ?? []);
    return codes.some((code) => set.has(code));
  }
}
