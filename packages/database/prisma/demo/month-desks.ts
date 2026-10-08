/**
 * Desk rows attached to the month factory (no piece-island numbers).
 * WIP, QC defects, outbound load, warehouse count, schedule crumbs, contracts, documents.
 */
import {
  ContractStatus,
  DeliveryStatus,
  DocumentVisibility,
  InventoryLotStatus,
  InventoryTxType,
  ReturnReason,
  SalesOrderStatus,
  TaskStatus,
  WipKitStatus,
  type PrismaClient,
} from '@prisma/client';
import { money } from '../seed/util';
import { addDays, demoAsOf } from './clock';
import { defaultBinIdForWarehouse } from '../seed/warehouse-bins';
import { applyDemoMovement } from './stock';
import type { SeqBag } from './seq';

export async function seedMonthDesks(
  prisma: PrismaClient,
  opts: { adminId: string; driverId?: string; warehouseUserId: string; counters: SeqBag },
): Promise<void> {
  const asOf = demoAsOf();
  await seedWipAndBlockers(prisma, opts.adminId);
  await seedQualityDefect(prisma);
  await seedDeliveries(prisma, opts);
  await seedWarehouse(prisma, opts);
  await seedScheduleCrumbs(prisma, opts.adminId, asOf);
  await seedCommercial(prisma, opts.adminId, asOf);
  await seedExtraReturn(prisma, asOf);
  console.log('  month desks attached');
}

async function seedWipAndBlockers(prisma: PrismaClient, adminId: string) {
  const po = await prisma.productionOrder.findFirst({
    where: { salesOrder: { projectName: 'Mecca Street armchair frames' } },
    include: {
      stages: { include: { stageDefinition: true } },
      tasks: { include: { stageDefinition: true } },
    },
  });
  if (!po) return;
  const carpentry = po.stages.find((s) => s.stageDefinition.code === 'CARPENTRY');
  const foam = po.stages.find((s) => s.stageDefinition.code === 'FOAM');
  const task = po.tasks.find((t) => t.stageDefinition?.code === 'CARPENTRY') ?? po.tasks[0];
  if (!carpentry || !task) return;
  const semi = await prisma.warehouse.findUnique({ where: { code: 'SEMI' } });
  const semiBin = semi ? await defaultBinIdForWarehouse(prisma, semi.id) : null;
  const kit = await prisma.wipKit.create({
    data: {
      productionOrderId: po.id,
      stageInstanceId: carpentry.id,
      producingTaskId: task.id,
      status: WipKitStatus.READY,
      expectedPieceCount: 2,
      qrCode: 'WIP-MECCA-ARM-1',
      warehouseId: semi?.id,
      locationId: semiBin,
    },
  });
  await prisma.wipPiece.create({
    data: { kitId: kit.id, sortOrder: 0, label: 'Frame A', qrCode: 'WIP-MECCA-ARM-1-A' },
  });
  await prisma.wipPiece.create({
    data: { kitId: kit.id, sortOrder: 1, label: 'Frame B', qrCode: 'WIP-MECCA-ARM-1-B' },
  });
  if (foam) {
    await prisma.wipHandoff.create({
      data: {
        kitId: kit.id,
        productionOrderId: po.id,
        sourceStageInstanceId: carpentry.id,
        destinationStageInstanceId: foam.id,
        quantity: money(1),
        receivedById: adminId,
        receivedAt: demoAsOf(),
      },
    });
  }

  const paused = await prisma.productionTask.findFirst({
    where: { status: TaskStatus.IN_PROGRESS, productionOrder: { salesOrder: { number: { not: { startsWith: 'SO-COST-' } } } } },
  });
  if (paused) {
    await prisma.productionTask.update({
      where: { id: paused.id },
      data: { status: TaskStatus.PAUSED },
    });
    await prisma.taskBlocker.create({
      data: {
        taskId: paused.id,
        category: 'MACHINE_PROBLEM',
        reason: 'Sander belt snapped — waiting on stores.',
        reportedById: adminId,
      },
    });
  }
  const blocked = await prisma.productionTask.findFirst({
    where: {
      status: { in: [TaskStatus.READY, TaskStatus.NOT_STARTED] },
      id: { not: paused?.id },
      productionOrder: { salesOrder: { projectName: 'Airport road ottoman run' } },
    },
  });
  if (blocked) {
    await prisma.productionTask.update({
      where: { id: blocked.id },
      data: { status: TaskStatus.BLOCKED },
    });
    await prisma.taskBlocker.create({
      data: {
        taskId: blocked.id,
        category: 'MATERIAL_MISSING',
        reason: 'Olive velvet roll not on the bench yet.',
        reportedById: adminId,
      },
    });
  }

  const usageTask = po.tasks.find((t) => t.stageDefinition?.code === 'MATERIAL_PREP') ?? task;
  const beech = await prisma.inventoryItem.findUnique({ where: { sku: 'MAT-BEECH' } });
  if (beech && usageTask) {
    await prisma.productionTaskMaterialUsage.create({
      data: {
        taskId: usageTask.id,
        productionOrderId: po.id,
        inventoryItemId: beech.id,
        sku: beech.sku,
        expectedQty: money(8),
        actualQty: money(8),
        varianceQty: money(0),
      },
    });
  }
}

async function seedQualityDefect(prisma: PrismaClient) {
  const inspection = await prisma.qualityInspection.findFirst({
    where: { result: 'FAILED_REWORK_REQUIRED' },
    include: { items: true },
  });
  if (!inspection) return;
  await prisma.qualityDefect.create({
    data: {
      inspectionId: inspection.id,
      description: 'Stitch pulled on the right arm.',
      stageCode: 'UPHOLSTERY',
      severity: 'MAJOR',
      correctiveAction: 'Restitch and reinspect.',
    },
  });
}

async function seedDeliveries(
  prisma: PrismaClient,
  opts: { adminId: string; driverId?: string },
) {
  const planned = await prisma.delivery.findMany({
    where: { status: DeliveryStatus.PLANNED },
    orderBy: { deliveryDate: 'asc' },
    take: 4,
    include: { salesOrder: { select: { customerId: true } } },
  });
  const [ready, out, failed, resched] = planned;
  if (ready) {
    await prisma.delivery.update({ where: { id: ready.id }, data: { status: DeliveryStatus.READY } });
  }
  if (out) {
    await prisma.delivery.update({
      where: { id: out.id },
      data: { status: DeliveryStatus.OUT_FOR_DELIVERY, driverId: opts.driverId ?? out.driverId },
    });
  }
  if (failed) {
    await prisma.delivery.update({
      where: { id: failed.id },
      data: {
        status: DeliveryStatus.FAILED,
        failureReason: 'Showroom closed — nobody to receive.',
        deliveryDate: addDays(demoAsOf(), 2),
      },
    });
  }
  if (resched) {
    await prisma.delivery.update({
      where: { id: resched.id },
      data: { status: DeliveryStatus.RESCHEDULED, deliveryDate: addDays(demoAsOf(), 4) },
    });
  }

  const balqis = await prisma.user.findUnique({ where: { username: 'balqis' }, select: { id: true, customerId: true } });
  if (balqis?.customerId) {
    const delivered = await prisma.delivery.findFirst({
      where: { status: DeliveryStatus.DELIVERED, customerId: balqis.customerId, customerConfirmedAt: null },
      orderBy: { deliveryDate: 'desc' },
    });
    if (delivered) {
      await prisma.delivery.update({
        where: { id: delivered.id },
        data: {
          customerConfirmedAt: delivered.deliveryDate ?? demoAsOf(),
          customerConfirmedById: balqis.id,
          actualDeliveredAt: delivered.deliveryDate ?? demoAsOf(),
        },
      });
    }
  }

  const hold = await prisma.salesOrder.findFirst({
    where: { number: 'SO-SHELF-HOLD' },
    select: { id: true, customerId: true, deliveryAddress: true },
  });
  if (hold) {
    await prisma.delivery.create({
      data: {
        number: 'DLV-SHELF-FAIL',
        salesOrderId: hold.id,
        customerId: hold.customerId,
        deliveryAddress: hold.deliveryAddress ?? 'Amman',
        deliveryDate: addDays(demoAsOf(), 2),
        status: DeliveryStatus.FAILED,
        failureReason: 'Showroom closed — nobody to receive.',
        driverId: opts.driverId,
      },
    });
    await prisma.delivery.create({
      data: {
        number: 'DLV-SHELF-RESCHED',
        salesOrderId: hold.id,
        customerId: hold.customerId,
        deliveryAddress: hold.deliveryAddress ?? 'Amman',
        deliveryDate: addDays(demoAsOf(), 5),
        status: DeliveryStatus.RESCHEDULED,
        notes: 'Moved to the next working morning.',
        driverId: opts.driverId,
      },
    });
  }

  const lot = await prisma.inventoryLot.findFirst({
    where: { status: InventoryLotStatus.AVAILABLE, deliveryLoadPieces: { none: {} } },
  });
  const host = await prisma.delivery.findFirst({ where: { status: { in: [DeliveryStatus.OUT_FOR_DELIVERY, DeliveryStatus.READY, DeliveryStatus.DELIVERED] } } });
  if (lot && host) {
    await prisma.deliveryLoadPiece.create({
      data: {
        deliveryId: host.id,
        inventoryLotId: lot.id,
        pieceIndex: 0,
        loadedAt: demoAsOf(),
        loadedById: opts.driverId ?? opts.adminId,
      },
    });
  }
}

async function seedWarehouse(
  prisma: PrismaClient,
  opts: { adminId: string; warehouseUserId: string; counters: SeqBag },
) {
  const raw = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'RAW' } });
  const balances = await prisma.inventoryBalance.findMany({
    where: { warehouseId: raw.id },
    take: 8,
  });
  const count = await prisma.inventoryCount.create({
    data: {
      number: 'CNT-DEMO-MONTH',
      warehouseId: raw.id,
      status: 'POSTED',
      countedAt: demoAsOf(),
      notes: 'Month count matches the ledger.',
      createdById: opts.warehouseUserId,
      lines: {
        create: balances.map((b) => ({
          inventoryItemId: b.inventoryItemId,
          locationId: b.locationId,
          systemQty: b.availableQty,
          countedQty: b.availableQty,
          varianceQty: money(0),
        })),
      },
    },
  });
  void count;

  const brass = await prisma.inventoryItem.findUnique({ where: { sku: 'MAT-BRASS' } });
  const rawBin = await defaultBinIdForWarehouse(prisma, raw.id);
  if (brass && Number((await prisma.inventoryBalance.findFirst({ where: { inventoryItemId: brass.id, warehouseId: raw.id } }))?.availableQty ?? 0) >= 1) {
    await applyDemoMovement(prisma, {
      type: InventoryTxType.SCRAP,
      itemId: brass.id,
      warehouseId: raw.id,
      quantity: 1,
      unitCost: 6.5,
      userId: opts.warehouseUserId,
      at: demoAsOf(),
      notes: 'Scrapped one bent brass foot',
      outbound: true,
      counters: opts.counters,
    });
    await prisma.inventoryLot.create({
      data: {
        inventoryItemId: brass.id,
        warehouseId: raw.id,
        locationId: rawBin,
        quantity: money(1),
        remainingQty: money(1),
        status: InventoryLotStatus.QUARANTINED,
        qrCode: 'LOT-BRASS-QUAR',
        sourceKey: 'demo:brass-quarantine',
      },
    });
  }

  const beech = await prisma.inventoryItem.findUnique({
    where: { sku: 'MAT-BEECH' },
    include: { balances: true },
  });
  if (beech) {
    const available = beech.balances.reduce((sum, row) => sum + Number(row.availableQty), 0);
    const target = 18;
    if (available > target) {
      await applyDemoMovement(prisma, {
        type: InventoryTxType.INVENTORY_ADJUSTMENT,
        itemId: beech.id,
        warehouseId: raw.id,
        locationId: rawBin ?? undefined,
        quantity: available - target,
        unitCost: 11.5,
        userId: opts.warehouseUserId,
        at: demoAsOf(),
        notes: 'Month close — beech left under reorder for the low-stock desk',
        outbound: true,
        counters: opts.counters,
      });
    }
  }
}

async function seedScheduleCrumbs(prisma: PrismaClient, adminId: string, asOf: Date) {
  const po = await prisma.productionOrder.findFirst({
    where: { salesOrder: { projectName: 'Jabal Amman dining set' } },
    include: { salesOrder: true, schedules: { include: { allocations: true }, take: 1 } },
  });
  if (po?.salesOrder) {
    const alloc = po.schedules[0]?.allocations[0];
    await prisma.scheduleChangeHistory.create({
      data: {
        productionOrderId: po.id,
        salesOrderId: po.salesOrderId,
        allocationId: alloc?.id,
        kind: 'REASSIGN',
        actorId: adminId,
        reason: 'Moved dining chairs onto the afternoon carpenter.',
        oldStart: alloc?.plannedStart,
        newStart: alloc?.plannedStart,
      },
    });
    if (po.productId) {
      await prisma.schedulingEstimateProposal.create({
        data: {
          productionOrderId: po.id,
          productId: po.productId,
          complexity: 'MODIFIED',
          stageEstimates: [{ stageCode: 'CARPENTRY', minutesPerUnit: 90 }],
          confidence: 'MEDIUM',
          reasons: ['Oak dining chairs run longer than the beech armchair estimate.'],
          status: 'PENDING',
        },
      });
    }
  }
  await prisma.schedulingReplanRun.create({
    data: {
      status: 'COMPLETED',
      actorId: adminId,
      changeType: 'CALENDAR',
      reason: 'Month factory extra shift',
      completedAt: asOf,
      result: { planned: true },
    },
  });
}

async function seedCommercial(prisma: PrismaClient, adminId: string, asOf: Date) {
  const dealers = await prisma.customer.findMany({
    where: { users: { some: { username: { in: ['nile', 'oasis', 'balqis'] } } } },
    include: { users: { select: { username: true } }, salesOrders: { take: 1, select: { id: true, total: true } } },
  });
  const statuses: ContractStatus[] = [ContractStatus.ACTIVE, ContractStatus.DRAFT, ContractStatus.EXPIRED];
  for (const [i, dealer] of dealers.entries()) {
    const so = dealer.salesOrders[0];
    await prisma.contract.create({
      data: {
        number: `CTR-${dealer.users[0]?.username?.toUpperCase() ?? i}`,
        customerId: dealer.id,
        salesOrderId: so?.id,
        startDate: addDays(asOf, -20),
        endDate: addDays(asOf, statuses[i] === ContractStatus.EXPIRED ? -1 : 340),
        contractValue: so?.total ?? money(10000),
        status: statuses[i] ?? ContractStatus.ACTIVE,
        terms: 'Showroom supply for the season.',
        warranty: '12 months workmanship',
      },
    });
    if (so) {
      await prisma.document.create({
        data: {
          fileName: `${dealer.users[0]?.username ?? 'dealer'}-order.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 24000,
          storageKey: `demo/docs/${dealer.id}.pdf`,
          category: 'ORDER',
          visibility: DocumentVisibility.CUSTOMER_VISIBLE,
          description: 'Signed order copy',
          uploadedById: adminId,
          customerId: dealer.id,
          salesOrderId: so.id,
        },
      });
    }
    await prisma.communicationLog.create({
      data: {
        customerId: dealer.id,
        contactName: dealer.nameEn ?? dealer.name,
        type: i === 0 ? 'WHATSAPP' : 'EMAIL',
        subject: 'Delivery window',
        summary: 'Confirmed the showroom can receive weekday mornings.',
        occurredAt: addDays(asOf, -2),
        employeeId: adminId,
      },
    });
  }

  const option = await prisma.specOptionValue.findFirst({ where: { code: 'OAK' } });
  const line = await prisma.salesOrderLine.findFirst({
    where: { salesOrder: { projectName: 'Jabal Amman dining set' } },
  });
  if (option && line) {
    await prisma.salesOrderLineOption.create({
      data: { salesOrderLineId: line.id, specOptionValueId: option.id, note: 'Oak frame as specified' },
    });
  }

  const po = await prisma.productionOrder.findFirst({ select: { id: true } });
  if (po) {
    await prisma.document.create({
      data: {
        fileName: 'shop-drawing.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 18000,
        storageKey: 'demo/docs/shop-drawing.pdf',
        category: 'DRAWING',
        visibility: DocumentVisibility.INTERNAL,
        uploadedById: adminId,
        productionOrderId: po.id,
      },
    });
  }
}

async function seedExtraReturn(prisma: PrismaClient, asOf: Date) {
  const so = await prisma.salesOrder.findFirst({
    where: {
      status: SalesOrderStatus.DELIVERED,
      projectName: 'Khalda bed after rework',
      returns: { none: {} },
    },
    include: { lines: { take: 1 } },
  });
  if (!so || !so.lines[0]) return;
  await prisma.returnRequest.create({
    data: {
      number: 'RT-DEMO-002',
      customerId: so.customerId,
      salesOrderId: so.id,
      productDesc: so.lines[0].description,
      quantity: money(1),
      reason: ReturnReason.MANUFACTURING_DEFECT,
      description: 'Headboard finish did not match the swatch after the first repair.',
      approvalStatus: 'PENDING',
      createdAt: asOf,
    },
  });
}
