import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ProductionOrderOriginType,
  ReturnChargeStatus,
  ReturnLifecycleState,
  ReturnResolution,
  ReturnResponsibility,
} from '@maher/database';
import { can } from '@maher/permissions';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { roundMoney } from '../../common/helpers/money.util';
import { InventoryService } from '../inventory/inventory.service';
import { InvoicesService } from '../invoices/invoices.service';
import { WorkflowSnapshotService } from '../production/workflow/workflow-snapshot.service';
import { ensureFabricProcurementsForProductionOrder } from '../production/ensure-fabric-procurements';
import {
  applyLifecycle,
  tryApplyLifecycle,
  type ReturnLifecycleState as Lifecycle,
} from './return-lifecycle';
import { allOutboundPiecesReady } from './return-case-aggregate';
import { syncReturnCaseLifecycle } from './return-piece.service';
import {
  assertChargeUnlocked,
  moneyEquals,
  nextChargeStatus,
  productionBlockedBy,
  shouldResetChargeStamps,
  validateChargeInput,
} from './return-charge-policy';

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly inventory: InventoryService,
    private readonly snapshots: WorkflowSnapshotService,
    private readonly invoices: InvoicesService,
  ) {}

  async assertReturnQuantity(params: {
    customerId: string;
    salesOrderId?: string | null;
    salesOrderLineId?: string | null;
    quantity: number;
    excludeReturnId?: string;
  }) {
    if (!params.salesOrderId && !params.salesOrderLineId) return;
    if (params.salesOrderLineId) {
      const line = await this.prisma.salesOrderLine.findFirst({
        where: {
          id: params.salesOrderLineId,
          salesOrder: { customerId: params.customerId, archivedAt: null },
        },
        select: { id: true, quantity: true, salesOrderId: true },
      });
      if (!line) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'salesOrderLineId is invalid for this customer.',
        });
      }
      if (params.salesOrderId && params.salesOrderId !== line.salesOrderId) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'salesOrderLineId does not belong to this sales order.',
        });
      }
      const used = await this.prisma.returnRequest.aggregate({
        where: {
          salesOrderLineId: line.id,
          approvalStatus: { not: 'REJECTED' },
          ...(params.excludeReturnId ? { id: { not: params.excludeReturnId } } : {}),
        },
        _sum: { quantity: true },
      });
      const already = Number(used._sum.quantity ?? 0);
      if (already + params.quantity - 1e-9 > Number(line.quantity)) {
        throw new BadRequestException({
          code: 'RETURN_QTY_EXCEEDS',
          message: 'Returned quantity exceeds the ordered quantity for this line.',
        });
      }
      return;
    }

    const so = await this.prisma.salesOrder.findFirst({
      where: { id: params.salesOrderId!, customerId: params.customerId, archivedAt: null },
      include: { lines: { select: { quantity: true } } },
    });
    if (!so) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'salesOrderId is invalid for this customer.',
      });
    }
    const ordered = so.lines.reduce((sum, line) => sum + Number(line.quantity), 0);
    const used = await this.prisma.returnRequest.aggregate({
      where: {
        salesOrderId: so.id,
        approvalStatus: { not: 'REJECTED' },
        ...(params.excludeReturnId ? { id: { not: params.excludeReturnId } } : {}),
      },
      _sum: { quantity: true },
    });
    if (Number(used._sum.quantity ?? 0) + params.quantity - 1e-9 > ordered) {
      throw new BadRequestException({
        code: 'RETURN_QTY_EXCEEDS',
        message: 'Returned quantity exceeds the ordered quantity.',
      });
    }
  }

  async resolveLineAndProduct(params: {
    customerId: string;
    salesOrderId?: string | null;
    salesOrderLineId?: string | null;
  }) {
    if (params.salesOrderLineId) {
      const line = await this.prisma.salesOrderLine.findFirst({
        where: {
          id: params.salesOrderLineId,
          salesOrder: { customerId: params.customerId, archivedAt: null },
        },
        select: {
          id: true,
          salesOrderId: true,
          productId: true,
          description: true,
          productionOrders: { select: { id: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
      if (!line) return { salesOrderLineId: null, productId: null, sourceProductionOrderId: null };
      return {
        salesOrderLineId: line.id,
        productId: line.productId,
        sourceProductionOrderId: line.productionOrders[0]?.id ?? null,
      };
    }
    if (!params.salesOrderId) {
      return { salesOrderLineId: null, productId: null, sourceProductionOrderId: null };
    }
    const lines = await this.prisma.salesOrderLine.findMany({
      where: { salesOrderId: params.salesOrderId },
      select: { id: true, productId: true },
    });
    if (lines.length === 1) {
      const po = await this.prisma.productionOrder.findFirst({
        where: { salesOrderLineId: lines[0]!.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      return {
        salesOrderLineId: lines[0]!.id,
        productId: lines[0]!.productId,
        sourceProductionOrderId: po?.id ?? null,
      };
    }
    return { salesOrderLineId: null, productId: null, sourceProductionOrderId: null };
  }

  applyState(current: string | null | undefined, next: Lifecycle) {
    try {
      return applyLifecycle(current, next);
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : 'RETURN_INVALID_TRANSITION';
      throw new BadRequestException({
        code,
        message: err instanceof Error ? err.message : 'Invalid return transition.',
      });
    }
  }

  async markInTransit(id: string, user: AuthUser) {
    const row = await this.prisma.returnRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return not found.' });
    if (row.approvalStatus !== 'APPROVED') {
      throw new BadRequestException({
        code: 'RETURN_NOT_APPROVED',
        message: 'Return must be approved before it can travel.',
      });
    }
    const next = this.applyState(row.lifecycleState, ReturnLifecycleState.IN_TRANSIT);
    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        ...next,
        sentToFactoryAt: row.sentToFactoryAt ?? new Date(),
        sentToFactoryById: row.sentToFactoryById ?? user.id,
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'return.mark-sent',
        entityType: 'ReturnRequest',
        entityId: id,
        newValues: { lifecycleState: next.lifecycleState },
      },
    });
    return updated;
  }

  async inspect(
    id: string,
    user: AuthUser,
    body: { notes?: string; responsibility?: ReturnResponsibility },
  ) {
    const row = await this.prisma.returnRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return not found.' });
    if (!row.receivedAt && row.physicalStatus !== 'RETURNED' && row.lifecycleState !== 'RECEIVED') {
      throw new BadRequestException({
        code: 'RETURN_NOT_RECEIVED',
        message: 'Inspect only after physical receive.',
      });
    }
    const next = this.applyState(row.lifecycleState === 'INSPECTING' ? 'INSPECTING' : 'RECEIVED', 'INSPECTING');
    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        ...next,
        inspectedAt: new Date(),
        inspectedById: user.id,
        inspectionNotes: body.notes?.trim() || row.inspectionNotes,
        responsibility: body.responsibility ?? row.responsibility,
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'return.inspect',
        entityType: 'ReturnRequest',
        entityId: id,
        newValues: {
          lifecycleState: next.lifecycleState,
          notes: body.notes?.trim() || null,
        },
      },
    });
    return updated;
  }

  async createWorkOrder(
    id: string,
    user: AuthUser,
    body: {
      kind?: 'RETURN_WORK' | 'REPLACEMENT';
      factoryNotes?: string;
      skipStageCodes?: string[];
      workflowId?: string;
      materials?: Array<{
        inventoryItemId?: string;
        sku?: string;
        displayName?: string;
        category?: string;
        expectedQty?: number;
        unit?: string;
        requestedFabricLabel?: string;
        stageCode?: string;
        fabricRole?: string;
      }>;
      quantity?: number;
      allowSiblingKinds?: boolean;
    },
  ) {
    const row = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: {
        salesOrderLine: { select: { id: true, productId: true, description: true } },
        product: { select: { id: true, nameEn: true } },
        workOrders: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return not found.' });
    if (row.approvalStatus !== 'APPROVED') {
      throw new BadRequestException({
        code: 'RETURN_NOT_APPROVED',
        message: 'Return must be approved before creating factory work.',
      });
    }
    if (!row.receivedAt && row.physicalStatus !== 'RETURNED' && row.lifecycleState !== 'RECEIVED' && row.lifecycleState !== 'INSPECTING') {
      throw new BadRequestException({
        code: 'RETURN_NOT_RECEIVED',
        message: 'Receive the return before creating factory work.',
      });
    }
    const blocked = productionBlockedBy(row.chargeStatus);
    if (blocked) {
      throw new BadRequestException({
        code: 'RETURN_CHARGE_NOT_CONFIRMED',
        message: blocked,
      });
    }

    const kind = body.kind === 'REPLACEMENT' ? 'REPLACEMENT' : 'RETURN_WORK';
    const existingSame = row.workOrders.find((po) => po.originType === kind);
    if (existingSame) return { productionOrder: existingSame, created: false };
    if (row.workOrders[0] && !body.allowSiblingKinds) {
      throw new BadRequestException({
        code: 'RETURN_WORK_KIND_CONFLICT',
        message: 'This return already has a factory work order of a different kind.',
      });
    }

    const nextState = kind === 'REPLACEMENT' ? ReturnLifecycleState.REPLACING : ReturnLifecycleState.REWORKING;
    const next = this.applyState(
      row.lifecycleState === 'INSPECTING' || row.lifecycleState === 'RECEIVED'
        ? row.lifecycleState
        : 'RECEIVED',
      nextState,
    );

    const prefix = kind === 'REPLACEMENT' ? 'RP' : 'RW';
    const number = await this.sequences.next(prefix, prefix);
    const productId = row.productId ?? row.salesOrderLine?.productId ?? null;
    const description =
      body.factoryNotes?.trim() ||
      `${kind === 'REPLACEMENT' ? 'Replacement' : 'Return work'} — ${row.number} — ${row.productDesc}`;

    const productionOrder = await this.prisma.$transaction(async (tx) => {
      const created = await tx.productionOrder.create({
        data: {
          number,
          salesOrderId: null,
          salesOrderLineId: null,
          customerId: row.customerId,
          productId: productId ?? undefined,
          productDescription: description,
          quantity: body.quantity != null ? roundMoney(body.quantity) : row.quantity,
          status: 'PLANNED',
          originType:
            kind === 'REPLACEMENT'
              ? ProductionOrderOriginType.REPLACEMENT
              : ProductionOrderOriginType.RETURN_WORK,
          returnRequestId: row.id,
          createdById: user.id,
          notes: body.factoryNotes?.trim() || `returnId=${row.id}; ${row.number}`,
        },
      });

      await this.snapshots.createSnapshotForProductionOrder(
        {
          productionOrderId: created.id,
          productId,
          productDescription: created.productDescription,
          quantity: Number(body.quantity ?? row.quantity),
          createdById: user.id,
          workflowId: body.workflowId,
        },
        tx,
      );

      const skipCodes = (body.skipStageCodes ?? [])
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean);
      if (skipCodes.length) {
        const nodes = await tx.productionOrderWorkflowSnapshotNode.findMany({
          where: { snapshot: { productionOrderId: created.id } },
          select: { id: true, stageCode: true, isRequired: true, stageInstanceId: true },
        });
        for (const node of nodes) {
          if (node.isRequired) continue;
          if (!skipCodes.includes(String(node.stageCode ?? '').toUpperCase())) continue;
          await tx.productionOrderWorkflowSnapshotNode.update({
            where: { id: node.id },
            data: { isSkipped: true, skipReason: 'Return work' },
          });
          if (node.stageInstanceId) {
            await tx.productionStageInstance.update({
              where: { id: node.stageInstanceId },
              data: { status: 'SKIPPED', progressPercent: 0 },
            });
            await tx.productionTask.updateMany({
              where: {
                stageInstanceId: node.stageInstanceId,
                status: { notIn: ['COMPLETED', 'CANCELLED'] },
              },
              data: { status: 'CANCELLED' },
            });
          }
        }
      }

      for (const [index, material] of (body.materials ?? []).entries()) {
        await tx.salesOrderLineMaterialRequirement.create({
          data: {
            productionOrderId: created.id,
            inventoryItemId: material.inventoryItemId,
            sku: material.sku,
            displayName: material.displayName,
            category: material.category as never,
            expectedQty: material.expectedQty != null ? roundMoney(material.expectedQty) : undefined,
            unit: material.unit || 'm',
            requestedFabricLabel: material.requestedFabricLabel,
            stageCode: material.stageCode,
            fabricRole: material.fabricRole,
            sortOrder: index,
          },
        });
      }
      await ensureFabricProcurementsForProductionOrder(tx, created.id);

      const lot = await tx.inventoryLot.findUnique({
        where: { sourceKey: `return-quarantine:${row.id}` },
      });
      if (lot) {
        await tx.inventoryLot.update({
          where: { id: lot.id },
          data: { productionOrderId: created.id },
        });
      }

      await tx.returnRequest.update({
        where: { id: row.id },
        data: {
          ...next,
          resolution: kind === 'REPLACEMENT' ? ReturnResolution.REPLACEMENT : ReturnResolution.REPAIR,
          inventoryFate: 'REWORK',
        },
      });
      return created;
    });

    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: kind === 'REPLACEMENT' ? 'return.replacement-po' : 'return.work-order',
        entityType: 'ReturnRequest',
        entityId: id,
        newValues: {
          productionOrderId: productionOrder.id,
          productionOrderNumber: productionOrder.number,
          originType: kind,
        },
      },
    });
    return { productionOrder, created: true };
  }

  async scheduleReship(id: string, user: AuthUser, body?: { address?: string; notes?: string }) {
    const row = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true } },
        salesOrder: { select: { deliveryAddress: true } },
        reshipDeliveries: { orderBy: { createdAt: 'desc' }, take: 1 },
        workOrders: { select: { id: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        pieces: { select: { state: true, decision: true, outboundEligible: true, productDesc: true } },
      },
    });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return not found.' });
    if (row.reshipDeliveries[0]) {
      return { delivery: row.reshipDeliveries[0], created: false };
    }
    if (row.pieces.length && !allOutboundPiecesReady(row.pieces)) {
      throw new BadRequestException({
        code: 'RETURN_NOT_READY',
        message: 'Wait until every returnable piece is ready before scheduling the return shipment.',
      });
    }
    let current = row.lifecycleState;
    let next = tryApplyLifecycle(current, ReturnLifecycleState.READY_TO_RETURN);
    if (next) current = next.lifecycleState;
    const returning = tryApplyLifecycle(current, ReturnLifecycleState.RETURNING);
    if (returning) next = returning;
    const address =
      body?.address?.trim() ||
      row.salesOrder?.deliveryAddress ||
      'Dealer showroom';
    const number = await this.sequences.next('DEL', 'DEL');
    const delivery = await this.prisma.$transaction(async (tx) => {
      const created = await tx.delivery.create({
        data: {
          number,
          customerId: row.customerId,
          salesOrderId: row.salesOrderId,
          purpose: 'RETURN_RESHIP',
          returnRequestId: row.id,
          deliveryAddress: address,
          notes: body?.notes ?? `Return reship ${row.number}`,
          status: 'PLANNED',
          items: {
            create: (row.pieces.filter((piece) => piece.outboundEligible).length
              ? row.pieces.filter((piece) => piece.outboundEligible)
              : [{ productDesc: row.productDesc }]
            ).map((piece) => ({
              description: 'productDesc' in piece ? piece.productDesc : row.productDesc,
              quantity: 1,
            })),
          },
        },
      });
      if (next) {
        await tx.returnRequest.update({
          where: { id: row.id },
          data: next,
        });
      }
      if (row.pieces.length) {
        await tx.returnPiece.updateMany({
          where: {
            returnRequestId: row.id,
            outboundEligible: true,
            state: 'READY_TO_RETURN',
          },
          data: { state: 'RETURNING' },
        });
        await syncReturnCaseLifecycle(tx, row.id);
      }
      return created;
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'return.reship',
        entityType: 'ReturnRequest',
        entityId: id,
        newValues: { deliveryId: delivery.id, deliveryNumber: delivery.number },
      },
    });
    return { delivery, created: true };
  }

  async setResponsibility(
    id: string,
    user: AuthUser,
    body: {
      responsibility: ReturnResponsibility;
      dealerAmount?: number;
      factoryAmount?: number;
      chargeAmount?: number;
    },
  ) {
    const row = await this.prisma.returnRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return not found.' });
    if (assertChargeUnlocked(row.chargeStatus)) {
      throw new BadRequestException({
        code: 'RETURN_CHARGE_LOCKED',
        message: 'The return invoice already exists — the charge cannot be edited.',
      });
    }

    const incomingDealer = body.dealerAmount ?? body.chargeAmount;
    const incomingFactory = body.factoryAmount;
    const dealerCandidate =
      incomingDealer !== undefined ? incomingDealer : Number(row.chargeAmount ?? 0) || null;
    const factoryCandidate =
      incomingFactory !== undefined ? incomingFactory : Number(row.factoryShareAmount ?? 0) || null;
    const validated = validateChargeInput(body.responsibility, dealerCandidate, factoryCandidate);
    if (!validated.ok) {
      throw new BadRequestException({ code: validated.code, message: validated.message });
    }

    const responsibilityChanged = body.responsibility !== row.responsibility;
    const amountsChanged =
      !moneyEquals(row.chargeAmount, validated.dealerAmount) ||
      !moneyEquals(row.factoryShareAmount, validated.factoryAmount);
    const reset = shouldResetChargeStamps({
      current: row.chargeStatus,
      responsibilityChanged,
      amountsChanged,
    });
    let chargeStatus = nextChargeStatus(body.responsibility, validated.dealerAmount, row.chargeStatus);
    if (
      !reset &&
      !responsibilityChanged &&
      !amountsChanged &&
      (row.chargeStatus === 'AWAITING_DEALER' ||
        row.chargeStatus === 'CONFIRMED' ||
        row.chargeStatus === 'REJECTED')
    ) {
      chargeStatus = row.chargeStatus;
    }

    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        responsibility: body.responsibility,
        chargeAmount: validated.dealerAmount != null ? roundMoney(validated.dealerAmount) : null,
        factoryShareAmount:
          validated.factoryAmount != null ? roundMoney(validated.factoryAmount) : null,
        chargeStatus,
        ...(reset
          ? {
              chargeSentAt: null,
              chargeConfirmedAt: null,
              chargeConfirmedById: null,
              chargeRejectedAt: null,
              chargeRejectionNote: null,
            }
          : {}),
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'return.responsibility',
        entityType: 'ReturnRequest',
        entityId: id,
        newValues: {
          responsibility: body.responsibility,
          chargeAmount: updated.chargeAmount,
          factoryShareAmount: updated.factoryShareAmount,
          chargeStatus: updated.chargeStatus,
        },
      },
    });
    return updated;
  }

  async sendCharge(id: string, user: AuthUser) {
    const row = await this.prisma.returnRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return not found.' });
    if (assertChargeUnlocked(row.chargeStatus)) {
      throw new BadRequestException({
        code: 'RETURN_CHARGE_LOCKED',
        message: 'The return invoice already exists — the charge cannot be sent again.',
      });
    }
    if (row.chargeStatus !== 'DRAFT') {
      throw new BadRequestException({
        code: 'RETURN_CHARGE_NOT_DRAFT',
        message: 'Save a dealer amount before sending it for confirmation.',
      });
    }
    if (!(Number(row.chargeAmount ?? 0) > 0)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Charge amount must be greater than zero.',
      });
    }
    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        chargeStatus: ReturnChargeStatus.AWAITING_DEALER,
        chargeSentAt: new Date(),
        chargeRejectedAt: null,
        chargeRejectionNote: null,
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'return.charge-send',
        entityType: 'ReturnRequest',
        entityId: id,
        newValues: { chargeStatus: updated.chargeStatus, chargeAmount: updated.chargeAmount },
      },
    });
    return updated;
  }

  async respondCharge(
    id: string,
    user: AuthUser,
    body: { accept: boolean; note?: string },
  ) {
    const row = await this.prisma.returnRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return not found.' });
    if (row.chargeStatus !== 'AWAITING_DEALER') {
      throw new BadRequestException({
        code: 'RETURN_CHARGE_NOT_AWAITING',
        message: 'This return is not waiting for a dealer confirmation.',
      });
    }
    const isDealer = Boolean(user.customerId);
    if (isDealer && user.customerId !== row.customerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Cannot confirm a charge for another dealer.',
      });
    }
    if (!isDealer && !can(user, 'return.inspect') && !can(user, 'sales-order.update')) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Not allowed to record a dealer charge response.',
      });
    }
    if (body.accept) {
      const updated = await this.prisma.returnRequest.update({
        where: { id },
        data: {
          chargeStatus: ReturnChargeStatus.CONFIRMED,
          chargeConfirmedAt: new Date(),
          chargeConfirmedById: user.id,
          chargeRejectedAt: null,
          chargeRejectionNote: null,
        },
      });
      await this.prisma.auditEvent.create({
        data: {
          userId: user.id,
          action: 'return.charge-accept',
          entityType: 'ReturnRequest',
          entityId: id,
          newValues: {
            chargeStatus: updated.chargeStatus,
            onBehalf: !isDealer,
          },
        },
      });
      return updated;
    }
    const note = body.note?.trim();
    if (!note) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'A rejection note is required.',
      });
    }
    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        chargeStatus: ReturnChargeStatus.REJECTED,
        chargeRejectedAt: new Date(),
        chargeRejectionNote: note,
        chargeConfirmedAt: null,
        chargeConfirmedById: null,
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'return.charge-reject',
        entityType: 'ReturnRequest',
        entityId: id,
        newValues: { chargeStatus: updated.chargeStatus, note },
      },
    });
    return updated;
  }

  async chargeDealer(id: string, user: AuthUser, body?: { amount?: number; description?: string }) {
    const row = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: { chargeInvoices: { where: { status: { not: 'CANCELLED' }, archivedAt: null }, take: 1 } },
    });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return not found.' });
    if (row.chargeInvoices[0]) return { invoice: row.chargeInvoices[0], created: false };
    if (row.chargeStatus !== 'CONFIRMED') {
      throw new BadRequestException({
        code: 'RETURN_NOT_CHARGEABLE',
        message: 'Confirm the dealer amount before creating a return invoice.',
      });
    }
    const amount = Number(body?.amount ?? row.chargeAmount ?? 0);
    if (!(amount > 0)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Charge amount must be greater than zero.',
      });
    }
    const invoice = await this.invoices.createFromReturn({
      returnId: row.id,
      customerId: row.customerId,
      amount,
      description: body?.description || `Return work ${row.number} — ${row.productDesc}`,
      userId: user.id,
    });
    return { invoice, created: true };
  }

  async markReadyToReturn(id: string) {
    const row = await this.prisma.returnRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return not found.' });
    const next = tryApplyLifecycle(row.lifecycleState, ReturnLifecycleState.READY_TO_RETURN);
    if (!next) return row;
    return this.prisma.returnRequest.update({ where: { id }, data: next });
  }
}
