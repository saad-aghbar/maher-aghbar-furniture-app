import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FabricProcurementEventKind,
  FabricProcurementState,
  InventoryTxType,
  Prisma,
  PurchaseOrderStatus,
  PurchaseRequestStatus,
} from '@maher/database';
import type { WhatsAppProvider } from '@maher/integrations';
import type { AuthUser } from '@maher/types';
import { hasPermission } from '@maher/permissions';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { WHATSAPP_PROVIDER } from '../../integrations/integrations.module';
import { InventoryService } from '../inventory/inventory.service';
import {
  assessFabricReadiness,
  buildFabricProcurementWhatsAppBody,
  fabricStageIsReady,
  summarizeFabricReadiness,
  type FabricReadinessResult,
} from '../production/fabric-readiness';
import { PurchasingService } from './purchasing.service';

const PROCUREMENT_INCLUDE = {
  requirement: {
    include: {
      inventoryItem: {
        select: {
          id: true,
          sku: true,
          nameEn: true,
          nameAr: true,
          category: true,
          unit: true,
          imageUrl: true,
        },
      },
      lineSetup: {
        select: {
          manufacturingName: true,
          requestedFabricLabel: true,
          salesOrderLineId: true,
        },
      },
    },
  },
  supplier: {
    select: {
      id: true,
      name: true,
      nameAr: true,
      nameEn: true,
      phone: true,
      whatsappPhone: true,
    },
  },
  salesOrder: {
    select: {
      id: true,
      number: true,
      projectName: true,
      customer: { select: { id: true, nameEn: true, nameAr: true, code: true } },
    },
  },
  salesOrderLine: {
    select: {
      id: true,
      description: true,
      quantity: true,
      product: { select: { id: true, nameEn: true, nameAr: true, imageUrl: true } },
    },
  },
  events: { orderBy: { createdAt: 'asc' as const } },
  lots: {
    include: {
      location: { select: { id: true, code: true, name: true } },
    },
  },
} satisfies Prisma.FabricProcurementInclude;

@Injectable()
export class FabricProcurementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly purchasing: PurchasingService,
    private readonly inventory: InventoryService,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsAppProvider,
  ) {}

  private assertRead(user?: AuthUser) {
    if (!user) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Forbidden.' });
  }

  async list(query: { q?: string; state?: string; salesOrderId?: string }, user?: AuthUser) {
    const where: Prisma.FabricProcurementWhereInput = {};
    if (query.salesOrderId) where.salesOrderId = query.salesOrderId;
    if (query.state && query.state !== 'ALL') {
      where.state = query.state as FabricProcurementState;
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { salesOrder: { number: { contains: q, mode: 'insensitive' } } },
        { salesOrder: { customer: { nameEn: { contains: q, mode: 'insensitive' } } } },
        { requirement: { requestedFabricLabel: { contains: q, mode: 'insensitive' } } },
        { requirement: { sku: { contains: q, mode: 'insensitive' } } },
        { supplier: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }
    const rows = await this.prisma.fabricProcurement.findMany({
      where,
      include: PROCUREMENT_INCLUDE,
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    return Promise.all(rows.map((row) => this.toTrackerItem(row, user)));
  }

  async getById(id: string, user?: AuthUser) {
    const row = await this.prisma.fabricProcurement.findUnique({
      where: { id },
      include: PROCUREMENT_INCLUDE,
    });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Fabric procurement not found.' });
    return this.toTrackerItem(row, user);
  }

  async trackerForSalesOrder(salesOrderId: string, user?: AuthUser) {
    const items = await this.list({ salesOrderId }, user);
    return { salesOrderId, ...summarizeFabricReadiness(items.map((i) => i.readiness)), items };
  }

  async draftWhatsApp(ids: string[], supplierId: string) {
    const rows = await this.prisma.fabricProcurement.findMany({
      where: { id: { in: ids } },
      include: PROCUREMENT_INCLUDE,
    });
    if (!rows.length) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'No fabric procurements selected.' });
    }
    const supplier = await this.prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } });
    const first = rows[0]!;
    const body = buildFabricProcurementWhatsAppBody({
      orderNumber: first.salesOrder.number,
      productName: first.salesOrderLine.description,
      dealerName: first.salesOrder.customer.nameEn ?? first.salesOrder.customer.nameAr,
      lines: rows.map((r) => ({
        procurementId: r.id,
        label: r.requirement.requestedFabricLabel || r.requirement.displayName || r.requirement.sku || 'Fabric',
        role: r.requirement.fabricRole,
        qty: r.orderedQty != null ? Number(r.orderedQty) : r.requirement.expectedQty != null ? Number(r.requirement.expectedQty) : null,
        unit: r.unit || r.requirement.unit,
      })),
    });
    return {
      body,
      to: this.purchasing.supplierWhatsAppTo(supplier),
      supplier: { id: supplier.id, name: supplier.name },
      procurementIds: rows.map((r) => r.id),
    };
  }

  async sendWhatsApp(ids: string[], supplierId: string, user: AuthUser, bodyOverride?: string) {
    const draft = await this.draftWhatsApp(ids, supplierId);
    const body = bodyOverride?.trim() || draft.body;
    const to = draft.to;
    let sendResult = { ok: false as boolean, to, body, error: undefined as string | undefined };
    if (!to) {
      sendResult.error = 'Supplier has no WhatsApp or phone number.';
    } else {
      try {
        const result = await this.whatsapp.send({ to, body });
        sendResult = {
          ok: Boolean(result.ok),
          to,
          body,
          error: result.ok ? undefined : 'WhatsApp provider reported failure.',
        };
      } catch (err) {
        sendResult = {
          ok: false,
          to,
          body,
          error: err instanceof Error ? err.message : 'WhatsApp send failed.',
        };
      }
    }

    const existing = await this.prisma.fabricProcurement.findMany({
      where: { id: { in: ids } },
    });
    let purchaseRequestId = existing.find((p) => p.purchaseRequestId)?.purchaseRequestId ?? null;
    let purchaseOrderId = existing.find((p) => p.purchaseOrderId)?.purchaseOrderId ?? null;

    if (!purchaseOrderId) {
      const rows = await this.prisma.fabricProcurement.findMany({
        where: { id: { in: ids } },
        include: { requirement: true },
      });
      const prNumber = await this.sequences.next('PREQ', 'PREQ');
      const pr = await this.prisma.purchaseRequest.create({
        data: {
          number: prNumber,
          status: PurchaseRequestStatus.APPROVED,
          reason: `Fabric for ${ids.length} requirement(s)`,
          preferredSupplierId: supplierId,
          requestedById: user.id,
          lines: {
            create: rows.map((p) => ({
              description:
                p.requirement.requestedFabricLabel ||
                p.requirement.displayName ||
                p.requirement.sku ||
                'Fabric',
              quantity: p.orderedQty ?? p.requirement.expectedQty ?? 1,
              unit: p.unit || p.requirement.unit || 'm',
              inventoryItemId: p.requirement.inventoryItemId ?? undefined,
              salesOrderId: p.salesOrderId,
              salesOrderLineId: p.salesOrderLineId,
              fabricProcurementId: p.id,
            })),
          },
        },
      });
      const po = await this.purchasing.convertRequestToPo(pr.id, user.id);
      purchaseRequestId = pr.id;
      purchaseOrderId = po.id;
      await this.prisma.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: PurchaseOrderStatus.SENT,
          whatsappSentAt: new Date(),
          whatsappLastBody: body,
          whatsappLastTo: to,
        },
      });
    } else {
      await this.prisma.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          whatsappSentAt: new Date(),
          whatsappLastBody: body,
          whatsappLastTo: to,
        },
      });
    }

    for (const id of ids) {
      await this.prisma.fabricProcurement.update({
        where: { id },
        data: {
          supplierId,
          state: FabricProcurementState.AWAITING_SUPPLIER,
          purchaseRequestId,
          purchaseOrderId,
          whatsappSentAt: new Date(),
          whatsappLastBody: body,
          whatsappLastTo: to,
        },
      });
      await this.appendEvent(
        id,
        FabricProcurementEventKind.REQUESTED,
        user.id,
        sendResult.ok ? 'WhatsApp sent' : sendResult.error,
        { body, to, ok: sendResult.ok },
        supplierId,
      );
    }

    return { ...draft, body, whatsapp: sendResult, purchaseRequestId, purchaseOrderId };
  }

  async setSupplierState(
    id: string,
    user: AuthUser,
    input: {
      state: 'SUPPLIER_CONFIRMED' | 'UNAVAILABLE' | 'PARTIALLY_AVAILABLE' | 'READY_FOR_PICKUP' | 'DELAYED';
      note?: string;
      expectedAvailableAt?: string;
    },
  ) {
    const row = await this.requireRow(id);
    const kind =
      input.state === 'SUPPLIER_CONFIRMED'
        ? FabricProcurementEventKind.SUPPLIER_CONFIRMED
        : input.state === 'UNAVAILABLE'
          ? FabricProcurementEventKind.SUPPLIER_UNAVAILABLE
          : input.state === 'READY_FOR_PICKUP'
            ? FabricProcurementEventKind.READY_FOR_PICKUP
            : input.state === 'PARTIALLY_AVAILABLE'
              ? FabricProcurementEventKind.PARTIAL
              : FabricProcurementEventKind.WAIT;
    await this.prisma.fabricProcurement.update({
      where: { id },
      data: {
        state: input.state as FabricProcurementState,
        expectedAvailableAt: input.expectedAvailableAt ? new Date(input.expectedAvailableAt) : row.expectedAvailableAt,
        notes: input.note ?? row.notes,
      },
    });
    await this.appendEvent(id, kind, user.id, input.note, { state: input.state }, row.supplierId);
    return this.getById(id, user);
  }

  async wait(id: string, user: AuthUser, note?: string, expectedAvailableAt?: string) {
    const row = await this.requireRow(id);
    await this.prisma.fabricProcurement.update({
      where: { id },
      data: {
        state: FabricProcurementState.WAITING,
        waitingSince: row.waitingSince ?? new Date(),
        expectedAvailableAt: expectedAvailableAt ? new Date(expectedAvailableAt) : row.expectedAvailableAt,
        notes: note ?? row.notes,
      },
    });
    await this.appendEvent(id, FabricProcurementEventKind.WAIT, user.id, note, null, row.supplierId);
    return this.getById(id, user);
  }

  async redirect(id: string, user: AuthUser, supplierId: string, note?: string) {
    const row = await this.requireRow(id);
    const previousSupplierId = row.supplierId;
    await this.prisma.fabricProcurement.update({
      where: { id },
      data: {
        supplierId,
        state: FabricProcurementState.NEEDS_ORDERING,
        purchaseRequestId: null,
        purchaseOrderId: null,
        whatsappSentAt: null,
      },
    });
    await this.appendEvent(
      id,
      FabricProcurementEventKind.REDIRECTED,
      user.id,
      note,
      { fromSupplierId: previousSupplierId, toSupplierId: supplierId },
      supplierId,
    );
    return this.getById(id, user);
  }

  async overrideHold(id: string, user: AuthUser, reason: string) {
    const trimmed = reason.trim();
    if (!trimmed) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Override reason is required.' });
    }
    await this.requireRow(id);
    await this.prisma.fabricProcurement.update({
      where: { id },
      data: { fabricHoldOverriddenAt: new Date() },
    });
    await this.appendEvent(id, FabricProcurementEventKind.OVERRIDE, user.id, trimmed, { reason: trimmed });
    return this.getById(id, user);
  }

  async takeInLot(params: {
    taskId: string;
    qrCode: string;
    user: AuthUser;
  }) {
    const code = params.qrCode.trim();
    if (!code) {
      throw new BadRequestException({ code: 'SCAN_REQUIRED', message: 'Scan a fabric bundle QR.' });
    }
    const task = await this.prisma.productionTask.findUnique({
      where: { id: params.taskId },
      include: {
        productionOrder: {
          select: {
            id: true,
            salesOrderId: true,
            salesOrderLineId: true,
          },
        },
        stageDefinition: { select: { code: true } },
      },
    });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Task not found.' });

    const lot = await this.prisma.inventoryLot.findFirst({
      where: { qrCode: code },
      include: {
        inventoryItem: { select: { id: true, sku: true, nameEn: true, category: true } },
        fabricProcurement: { include: { requirement: true } },
      },
    });
    if (!lot?.fabricProcurementId || !lot.fabricProcurement) {
      throw new BadRequestException({
        code: 'FABRIC_WRONG_RECEIVED',
        message: 'This QR is not an order fabric bundle.',
      });
    }
    const soId = task.productionOrder.salesOrderId;
    if (lot.salesOrderId && soId && lot.salesOrderId !== soId) {
      throw new BadRequestException({
        code: 'FABRIC_WRONG_ORDER',
        message: 'This fabric belongs to another order.',
      });
    }
    const proc = lot.fabricProcurement;
    const stageCode = task.stageDefinition?.code ?? null;
    if (
      proc.requirement.stageCode &&
      stageCode &&
      proc.requirement.stageCode.toUpperCase() !== stageCode.toUpperCase()
    ) {
      throw new BadRequestException({
        code: 'FABRIC_WRONG_STAGE',
        message: `This fabric is for ${proc.requirement.stageCode}, not this stage.`,
      });
    }
    if (proc.requirement.inventoryItemId && proc.requirement.inventoryItemId !== lot.inventoryItemId) {
      throw new BadRequestException({
        code: 'FABRIC_WRONG_RECEIVED',
        message: 'This bundle is the wrong fabric for the order.',
      });
    }
    const status = String(lot.status).toUpperCase();
    if (status === 'CONSUMED' || status === 'QUARANTINED' || status === 'DAMAGED') {
      throw new BadRequestException({
        code: 'FABRIC_ALREADY_ISSUED',
        message: 'This fabric bundle is not available to take in.',
      });
    }

    const qty = Number(lot.remainingQty ?? lot.quantity) || 0;
    if (!(qty > 0)) {
      throw new BadRequestException({
        code: 'FABRIC_ALREADY_ISSUED',
        message: 'This fabric bundle has already been issued.',
      });
    }

    const itemId = lot.inventoryItemId;
    const existing = await this.prisma.productionTaskMaterialUsage.findUnique({
      where: { taskId_inventoryItemId: { taskId: task.id, inventoryItemId: itemId } },
    });

    await this.prisma.$transaction(async (tx) => {
      await this.inventory.applyMovement({
        type: InventoryTxType.PRODUCTION_ISSUE,
        inventoryItemId: itemId,
        warehouseId: lot.warehouseId,
        quantity: qty,
        userId: params.user.id,
        referenceType: 'ProductionTask',
        referenceId: task.id,
        notes: `Fabric take-in ${lot.qrCode}`,
        idempotencyKey: `fabric-takein:${lot.id}:${task.id}`,
        db: tx,
      });
      await tx.inventoryLot.update({
        where: { id: lot.id },
        data: {
          remainingQty: 0,
          status: 'CONSUMED',
        },
      });
      if (existing) {
        await tx.productionTaskMaterialUsage.update({
          where: { id: existing.id },
          data: {
            actualQty: Number(existing.actualQty ?? 0) + qty,
            inventoryLotId: lot.id,
            recordedById: params.user.id,
          },
        });
      } else {
        await tx.productionTaskMaterialUsage.create({
          data: {
            taskId: task.id,
            productionOrderId: task.productionOrderId,
            inventoryItemId: itemId,
            sku: lot.inventoryItem.sku,
            expectedQty: proc.requirement.expectedQty ?? qty,
            actualQty: qty,
            inventoryLotId: lot.id,
            recordedById: params.user.id,
          },
        });
      }
      await tx.fabricProcurementEvent.create({
        data: {
          procurementId: proc.id,
          kind: FabricProcurementEventKind.RECEIVED,
          userId: params.user.id,
          note: `Taken into ${task.stageDefinition?.code ?? 'stage'}`,
          payload: { lotId: lot.id, qty, taskId: task.id } as Prisma.InputJsonValue,
        },
      });
    });

    return {
      ok: true,
      lotId: lot.id,
      qty,
      label: proc.requirement.requestedFabricLabel || lot.inventoryItem.nameEn,
    };
  }

  async workerBoard(taskId: string) {
    const task = await this.prisma.productionTask.findUnique({
      where: { id: taskId },
      include: {
        productionOrder: { select: { salesOrderId: true } },
        stageDefinition: { select: { code: true } },
      },
    });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Task not found.' });
    const soId = task.productionOrder.salesOrderId;
    if (!soId) return { taskId, taken: 0, total: 0, items: [] as unknown[] };
    const items = await this.list({ salesOrderId: soId });
    const stageCode = task.stageDefinition?.code ?? null;
    const forStage = items.filter((i) => {
      const itemCode = String(i.readiness.stageCode ?? '').toUpperCase();
      const code = String(stageCode ?? '').toUpperCase();
      if (i.readiness.storedState === 'CANCELLED') return false;
      if (itemCode) return !code || itemCode === code;
      return true;
    });
    const taken = forStage.filter((i) => i.readiness.derivedStatus === 'ISSUED').length;
    return {
      taskId,
      salesOrderId: soId,
      salesOrderNumber: items[0]?.salesOrderNumber ?? null,
      taken,
      total: forStage.length,
      items: forStage.map((i) => ({
        id: i.id,
        label: i.readiness.label,
        role: i.readiness.role,
        stageCode: i.readiness.stageCode,
        derivedStatus: i.readiness.derivedStatus,
        readyForProduction: i.readiness.readyForProduction,
        expectedQty: i.readiness.expectedQty,
        arrivedQty: i.readiness.arrivedQty,
        issuedQty: i.readiness.issuedQty,
        unit: i.readiness.unit,
        imageUrl: i.imageUrl ?? null,
        lots: (i.lots ?? []).map((l) => ({
          id: l.id,
          qrCode: l.qrCode,
          remainingQty: l.remainingQty,
          status: l.status,
          locationLabel: l.locationLabel ?? null,
        })),
      })),
    };
  }

  async recordDisposition(params: {
    taskId: string;
    qrCode: string;
    user: AuthUser;
    returnedQty?: number;
    scrapQty?: number;
    scrapReason?: string;
  }) {
    const returnedQty = Math.max(0, Number(params.returnedQty) || 0);
    const scrapQty = Math.max(0, Number(params.scrapQty) || 0);
    if (!(returnedQty > 0) && !(scrapQty > 0)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Enter leftover or scrap quantity.' });
    }
    const task = await this.prisma.productionTask.findUnique({
      where: { id: params.taskId },
      include: { productionOrder: { select: { salesOrderId: true } } },
    });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Task not found.' });
    const lot = await this.prisma.inventoryLot.findFirst({
      where: { qrCode: params.qrCode.trim() },
      include: { fabricProcurement: true },
    });
    if (!lot?.fabricProcurementId) {
      throw new BadRequestException({
        code: 'FABRIC_WRONG_RECEIVED',
        message: 'This QR is not an order fabric bundle.',
      });
    }
    if (lot.salesOrderId && task.productionOrder.salesOrderId && lot.salesOrderId !== task.productionOrder.salesOrderId) {
      throw new BadRequestException({
        code: 'FABRIC_WRONG_ORDER',
        message: 'This fabric belongs to another order.',
      });
    }
    const usage = await this.prisma.productionTaskMaterialUsage.findFirst({
      where: { taskId: task.id, inventoryLotId: lot.id },
    });
    if (!usage) {
      throw new BadRequestException({
        code: 'FABRIC_NOT_READY',
        message: 'Take this fabric in before recording leftover or scrap.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      if (returnedQty > 0) {
        await this.inventory.applyMovement({
          type: InventoryTxType.PRODUCTION_RETURN,
          inventoryItemId: lot.inventoryItemId,
          warehouseId: lot.warehouseId,
          quantity: returnedQty,
          userId: params.user.id,
          referenceType: 'ProductionTask',
          referenceId: task.id,
          notes: `Fabric leftover ${lot.qrCode}`,
          locationId: lot.locationId,
          idempotencyKey: `fabric-return:${lot.id}:${task.id}:${returnedQty}`,
          db: tx,
        });
        const nextRemaining = (Number(lot.remainingQty ?? 0) || 0) + returnedQty;
        await tx.inventoryLot.update({
          where: { id: lot.id },
          data: {
            remainingQty: nextRemaining,
            status: 'AVAILABLE',
          },
        });
      }
      await tx.productionTaskMaterialUsage.update({
        where: { id: usage.id },
        data: {
          returnedQty: Number(usage.returnedQty ?? 0) + returnedQty,
          scrapQty: Number(usage.scrapQty ?? 0) + scrapQty,
          actualQty: Math.max(0, Number(usage.actualQty ?? 0) - returnedQty - scrapQty),
        },
      });
      await tx.fabricProcurementEvent.create({
        data: {
          procurementId: lot.fabricProcurementId!,
          kind: FabricProcurementEventKind.DISPOSITION,
          userId: params.user.id,
          note: params.scrapReason ?? (returnedQty > 0 ? 'Leftover returned' : 'Scrap recorded'),
          payload: { lotId: lot.id, returnedQty, scrapQty, taskId: task.id } as Prisma.InputJsonValue,
        },
      });
    });

    return { ok: true, returnedQty, scrapQty };
  }

  async assessForProductionOrder(productionOrderId: string): Promise<FabricReadinessResult[]> {
    const po = await this.prisma.productionOrder.findUnique({
      where: { id: productionOrderId },
      select: { salesOrderId: true },
    });
    if (!po?.salesOrderId) return [];
    const items = await this.list({ salesOrderId: po.salesOrderId });
    return items.map((i) => i.readiness);
  }

  stageReady(items: FabricReadinessResult[], stageCode: string | null) {
    return fabricStageIsReady(items, stageCode);
  }

  private async requireRow(id: string) {
    const row = await this.prisma.fabricProcurement.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Fabric procurement not found.' });
    return row;
  }

  private async appendEvent(
    procurementId: string,
    kind: FabricProcurementEventKind,
    userId: string,
    note?: string | null,
    payload?: unknown,
    supplierId?: string | null,
  ) {
    await this.prisma.fabricProcurementEvent.create({
      data: {
        procurementId,
        kind,
        userId,
        supplierId: supplierId ?? undefined,
        note: note ?? undefined,
        payload: payload == null ? undefined : (payload as Prisma.InputJsonValue),
      },
    });
  }

  private async toTrackerItem(
    row: Prisma.FabricProcurementGetPayload<{ include: typeof PROCUREMENT_INCLUDE }>,
    user?: AuthUser,
  ) {
    const usageRows = await this.prisma.productionTaskMaterialUsage.findMany({
      where: {
        inventoryLotId: { in: row.lots.map((l) => l.id) },
      },
      select: { inventoryLotId: true, actualQty: true },
    });
    const usages = usageRows.map((u) => ({
      inventoryLotId: u.inventoryLotId,
      actualQty: u.actualQty != null ? Number(u.actualQty) : null,
    }));
    const readiness = assessFabricReadiness({
      requirement: {
        id: row.requirementId,
        salesOrderId: row.salesOrderId,
        label:
          row.requirement.requestedFabricLabel ||
          row.requirement.displayName ||
          row.requirement.sku ||
          'Fabric',
        sku: row.requirement.sku,
        inventoryItemId: row.requirement.inventoryItemId,
        expectedQty: row.requirement.expectedQty != null ? Number(row.requirement.expectedQty) : null,
        qtyIsEstimate: row.requirement.qtyIsEstimate,
        unit: row.unit || row.requirement.unit,
        fabricRole: row.requirement.fabricRole,
        stageCode: row.requirement.stageCode,
      },
      procurement: {
        state: row.state,
        fabricHoldOverriddenAt: row.fabricHoldOverriddenAt,
        expectedAvailableAt: row.expectedAvailableAt,
      },
      lots: row.lots.map((l) => ({
        id: l.id,
        quantity: Number(l.quantity),
        remainingQty: l.remainingQty != null ? Number(l.remainingQty) : null,
        status: l.status,
        allocationMode: l.allocationMode,
        salesOrderId: l.salesOrderId,
        locationId: l.locationId,
        inventoryItemId: l.inventoryItemId,
      })),
      usages,
    });

    const perms = user?.permissions ?? [];
    const showSupplier = hasPermission(perms, 'supplier.read');
    const showCost = hasPermission(perms, 'inventory.cost.read');
    return {
      id: row.id,
      salesOrderId: row.salesOrderId,
      salesOrderNumber: row.salesOrder.number,
      dealerName: row.salesOrder.customer.nameEn ?? row.salesOrder.customer.nameAr,
      productName: row.salesOrderLine.description || row.requirement.lineSetup.manufacturingName,
      productImageUrl: row.salesOrderLine.product?.imageUrl ?? null,
      imageUrl: row.requirement.inventoryItem?.imageUrl ?? null,
      supplier: showSupplier
        ? row.supplier
          ? { id: row.supplier.id, name: row.supplier.name, phone: row.supplier.whatsappPhone || row.supplier.phone }
          : null
        : null,
      purchaseOrderId: row.purchaseOrderId,
      purchaseRequestId: row.purchaseRequestId,
      whatsappSentAt: row.whatsappSentAt,
      whatsappLastBody: row.whatsappLastBody,
      whatsappLastTo: showSupplier ? row.whatsappLastTo : null,
      state: row.state,
      expectedAvailableAt: row.expectedAvailableAt,
      events: row.events,
      lots: row.lots.map((l) => ({
        id: l.id,
        qrCode: l.qrCode,
        quantity: Number(l.quantity),
        remainingQty: l.remainingQty != null ? Number(l.remainingQty) : null,
        locationId: l.locationId,
        locationLabel: l.location?.name?.trim() || l.location?.code || null,
        status: l.status,
        unitCost: showCost && l.unitCost != null ? Number(l.unitCost) : null,
      })),
      readiness,
    };
  }
}
