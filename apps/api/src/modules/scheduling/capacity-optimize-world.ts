/**
 * Live SimWorld for capacity optimize. Prisma reads only; does not persist.
 */
import { bomReservationNeeds } from '../../common/helpers/inventory-reservation.util';
import type { BomDefaults } from '../../common/helpers/order-costing.util';
import type { PrismaService } from '../../common/prisma.service';
import { calculateDurationMinutes } from './domain/duration-calculator';
import {
  assessMaterialReadiness,
  frozenInputsFromSnapshotNodes,
  inventoryGroupKey,
  inventorySkuKey,
  requirementFromNeeds,
} from './domain/material-readiness';
import { classifyLiveOrderStatus } from './domain/pull-forward-sim';
import type { SimCurrentAllocation, SimOrderInput, SimWorld, StageCapacityMeta } from './domain/pull-forward-sim';
import { creditOwnReservation } from './domain/pull-forward-sim';
import type { InventoryAvailability, PlannerStageInput, WorkerCandidate } from './domain/types';
import type { WorkingCalendar } from './domain/working-calendar';

const ACTIVE_SCHEDULE = new Set(['APPROVED', 'PROPOSED', 'NEEDS_REVIEW', 'DRAFT']);

function latestActiveSchedule<T extends { status: string; version: number }>(schedules: T[]): T | null {
  const active = schedules.filter((s) => ACTIVE_SCHEDULE.has(s.status));
  const pool = active.length ? active : schedules;
  return [...pool].sort((a, b) => b.version - a.version)[0] ?? null;
}

function inventoryFromItems(
  items: Array<{
    id: string;
    sku: string | null;
    category: string | null;
    materialGroup: string | null;
    balances: Array<{ availableQty: unknown; reservedQty: unknown }>;
  }>,
  openPos: Array<{
    expectedDeliveryDate: Date | null;
    lines: Array<{ inventoryItemId: string | null; quantity: unknown }>;
    goodsReceipts: Array<{ lines: Array<{ inventoryItemId: string; receivedQty: unknown }> }>;
  }>,
): Record<string, InventoryAvailability> {
  const map: Record<string, InventoryAvailability> = {
    fabricMeters: { available: 0, reserved: 0, incoming: [] },
    woodUnits: { available: 0, reserved: 0, incoming: [] },
    foamBlocks: { available: 0, reserved: 0, incoming: [] },
  };
  const ensure = (key: string): Required<Pick<InventoryAvailability, 'available' | 'reserved' | 'incoming'>> & InventoryAvailability => {
    const existing = map[key];
    if (!existing) {
      map[key] = { available: 0, reserved: 0, incoming: [] };
    } else {
      existing.reserved = existing.reserved ?? 0;
      existing.incoming = existing.incoming ?? [];
    }
    return map[key] as Required<Pick<InventoryAvailability, 'available' | 'reserved' | 'incoming'>> &
      InventoryAvailability;
  };
  const itemById = new Map(items.map((i) => [i.id, i]));
  for (const item of items) {
    const reserved = item.balances.reduce((s, b) => s + Number(b.reservedQty), 0);
    const free = item.balances.reduce(
      (s, b) => s + Number(b.availableQty) - Number(b.reservedQty),
      0,
    );
    const groupKey = inventoryGroupKey(String(item.materialGroup ?? item.category));
    if (groupKey) {
      const group = ensure(groupKey);
      group.available += free;
      group.reserved += reserved;
    }
    const sku = item.sku?.trim();
    if (sku) {
      const row = ensure(inventorySkuKey(sku));
      row.available += free;
      row.reserved += reserved;
    }
  }
  for (const po of openPos) {
    const receivedByItem = new Map<string, number>();
    for (const grn of po.goodsReceipts) {
      for (const line of grn.lines) {
        receivedByItem.set(
          line.inventoryItemId,
          (receivedByItem.get(line.inventoryItemId) ?? 0) + Number(line.receivedQty),
        );
      }
    }
    const remainingByItem = new Map<string, number>();
    for (const line of po.lines) {
      if (!line.inventoryItemId) continue;
      remainingByItem.set(
        line.inventoryItemId,
        (remainingByItem.get(line.inventoryItemId) ?? 0) + Number(line.quantity),
      );
    }
    for (const [itemId, ordered] of remainingByItem) {
      const remaining = ordered - (receivedByItem.get(itemId) ?? 0);
      if (remaining <= 1e-9) continue;
      const readyAt = po.expectedDeliveryDate;
      if (!(readyAt instanceof Date) || Number.isNaN(readyAt.getTime())) continue;
      const item = itemById.get(itemId);
      if (!item) continue;
      const groupKey = inventoryGroupKey(String(item.materialGroup ?? item.category));
      if (groupKey) ensure(groupKey).incoming.push({ qty: remaining, readyAt });
      const sku = item.sku?.trim();
      if (sku) ensure(inventorySkuKey(sku)).incoming.push({ qty: remaining, readyAt });
    }
  }
  return map;
}

export async function loadCapacityOptimizeWorld(
  prisma: PrismaService,
  opts: { calendar: WorkingCalendar; bufferWorkingDays: number; now: Date },
): Promise<SimWorld> {
  const { calendar, bufferWorkingDays, now } = opts;
  const [workersRaw, stageDefs, items, openPos, pos] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
        archivedAt: null,
        roles: { some: { role: { kind: 'PRODUCTION_WORKER' } } },
      },
      select: {
        id: true,
        department: { select: { code: true } },
        workerSkills: { where: { isActive: true }, select: { stageDefinitionId: true } },
      },
    }),
    prisma.productionStageDefinition.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        schedulingResourceMode: true,
        resourceSlots: true,
        workerSkills: {
          where: { isActive: true, user: { isActive: true, archivedAt: null } },
          select: { userId: true },
        },
      },
    }),
    prisma.inventoryItem.findMany({
      where: { archivedAt: null, isActive: true, itemClass: 'RAW_MATERIAL' },
      select: {
        id: true,
        sku: true,
        category: true,
        materialGroup: true,
        balances: { select: { availableQty: true, reservedQty: true } },
      },
    }),
    prisma.purchaseOrder.findMany({
      where: {
        archivedAt: null,
        status: { in: ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] },
      },
      select: {
        expectedDeliveryDate: true,
        lines: { select: { inventoryItemId: true, quantity: true } },
        goodsReceipts: {
          select: { lines: { select: { inventoryItemId: true, receivedQty: true } } },
        },
      },
    }),
    prisma.productionOrder.findMany({
      where: { archivedAt: null, status: { notIn: ['CANCELLED', 'COMPLETED'] } },
      select: {
        id: true,
        number: true,
        quantity: true,
        status: true,
        priority: true,
        createdAt: true,
        customerId: true,
        requiredDeliveryDate: true,
        committedDeliveryDate: true,
        product: {
          select: {
            bomDefaults: true,
            productionProfile: { select: { bufferPercent: true } },
            stageEstimates: {
              select: {
                stageDefinitionId: true,
                setupMinutes: true,
                minutesPerUnit: true,
                fixedMinutes: true,
                quantityScalingMode: true,
                batchSize: true,
                batchMinutes: true,
                maxParallelUnits: true,
                isRequired: true,
                overrideDepartment: { select: { code: true } },
              },
            },
          },
        },
        salesOrder: { select: { id: true, status: true } },
        tasks: {
          select: {
            id: true,
            status: true,
            estimatedMinutes: true,
            assignedEmployeeId: true,
            plannedStart: true,
            plannedCompletion: true,
            stageInstanceId: true,
            stageDefinitionId: true,
            stageDefinition: {
              select: {
                id: true,
                code: true,
                dependsOnCodes: true,
                estimatedHours: true,
                responsibleDepartment: true,
                schedulingResourceMode: true,
                resourceSlots: true,
              },
            },
          },
        },
        workflowSnapshot: {
          select: {
            nodes: { include: { materialInputs: true } },
            edges: true,
          },
        },
        schedules: {
          select: {
            id: true,
            version: true,
            status: true,
            unschedulableReason: true,
            materialReadyAt: true,
            materialRisk: true,
            earliestAvailableDate: true,
            allocations: {
              select: {
                plannedStart: true,
                plannedEnd: true,
                estimatedMinutes: true,
                isPinned: true,
                manuallyAdjusted: true,
                employeeId: true,
                resourceSlot: true,
                productionTaskId: true,
                productionTask: {
                  select: {
                    status: true,
                    stageDefinitionId: true,
                    stageDefinition: { select: { code: true, id: true } },
                  },
                },
              },
            },
          },
        },
        inventoryLots: {
          where: { status: 'AVAILABLE', inventoryItem: { itemClass: 'SEMI_FINISHED_GOOD' } },
          select: { inventoryItemId: true, quantity: true },
        },
      },
    }),
  ]);

  const workers: WorkerCandidate[] = workersRaw.map((w) => ({
    id: w.id,
    isActive: true,
    departmentCode: w.department?.code ?? null,
    skillStageDefinitionIds: w.workerSkills.map((s) => s.stageDefinitionId),
  }));
  const stages: StageCapacityMeta[] = stageDefs.map((s) => ({
    stageDefinitionId: s.id,
    code: s.code,
    schedulingResourceMode: s.schedulingResourceMode,
    resourceSlots: s.resourceSlots,
    skilledWorkerCount: new Set(s.workerSkills.map((x) => x.userId)).size,
  }));
  const inventory = inventoryFromItems(items, openPos);
  const orders: SimOrderInput[] = [];

  for (const po of pos) {
    const latest = latestActiveSchedule(po.schedules);
    const snapshot = po.workflowSnapshot;
    const snapByInstance = new Map(
      (snapshot?.nodes ?? [])
        .filter((n) => n.stageInstanceId)
        .map((n) => [n.stageInstanceId!, n]),
    );
    const dependsByInstance = new Map<string, string[]>();
    if (snapshot) {
      const codeByNodeId = new Map(snapshot.nodes.map((n) => [n.id, n.stageCode]));
      for (const node of snapshot.nodes) {
        if (!node.stageInstanceId || node.isSkipped) continue;
        const preds = snapshot.edges
          .filter((e) => e.toSnapshotNodeId === node.id)
          .map((e) => codeByNodeId.get(e.fromSnapshotNodeId)!)
          .filter(Boolean);
        dependsByInstance.set(node.stageInstanceId, preds);
      }
    }
    const estimateByDef = new Map(
      (po.product?.stageEstimates ?? []).map((e) => [e.stageDefinitionId, e]),
    );
    const plannerStages: PlannerStageInput[] = [];
    for (const task of po.tasks) {
      if (!task.stageDefinition || !task.stageDefinitionId) continue;
      const snap = task.stageInstanceId ? snapByInstance.get(task.stageInstanceId) : undefined;
      if (snap?.isSkipped) continue;
      const estimate = estimateByDef.get(task.stageDefinitionId);
      if (!snap && estimate && !estimate.isRequired) continue;
      const estimatedMinutes = estimate
        ? calculateDurationMinutes({
            quantityScalingMode: estimate.quantityScalingMode,
            quantity: Number(po.quantity),
            setupMinutes: estimate.setupMinutes,
            minutesPerUnit: estimate.minutesPerUnit,
            fixedMinutes: estimate.fixedMinutes,
            batchSize: estimate.batchSize ?? undefined,
            batchMinutes: estimate.batchMinutes ?? undefined,
            maxParallelUnits: estimate.maxParallelUnits ?? undefined,
          })
        : (snap?.estimatedMinutes ??
          task.estimatedMinutes ??
          Math.max(30, Math.round(Number(task.stageDefinition.estimatedHours ?? 1) * 60)));
      plannerStages.push({
        code: task.stageDefinition.code,
        stageDefinitionId: task.stageDefinitionId,
        dependsOnCodes:
          (task.stageInstanceId ? dependsByInstance.get(task.stageInstanceId) : undefined) ??
          task.stageDefinition.dependsOnCodes,
        estimatedMinutes,
        departmentCode:
          estimate?.overrideDepartment?.code ??
          snap?.responsibleDepartmentCode ??
          task.stageDefinition.responsibleDepartment ??
          null,
        productionTaskId: task.id,
        stageInstanceId: task.stageInstanceId ?? null,
        preferredEmployeeId: task.assignedEmployeeId ?? null,
        schedulingResourceMode:
          snap?.schedulingResourceMode ??
          task.stageDefinition.schedulingResourceMode ??
          'WORKER_CONSTRAINED',
        resourceSlots: snap?.resourceSlots ?? task.stageDefinition.resourceSlots ?? 1,
      });
    }
    if (!plannerStages.length) continue;

    const bom = (po.product?.bomDefaults ?? null) as BomDefaults | null;
    const needs = bomReservationNeeds(bom, Number(po.quantity) || 1);
    const required = requirementFromNeeds(needs);
    const soStatus = po.salesOrder?.status;
    const creditOwn = Boolean(soStatus && soStatus !== 'WAITING_FOR_MATERIALS');
    const view = creditOwn ? creditOwnReservation(inventory, required) : inventory;
    const liveMat = assessMaterialReadiness(required, view);
    const consumingRawCodes = (snapshot?.nodes ?? [])
      .filter((n) => !n.isSkipped && n.consumesRawMaterials)
      .map((n) => n.stageCode);
    const stageMaterialInputs = frozenInputsFromSnapshotNodes(snapshot?.nodes ?? []);

    const currentAllocations: SimCurrentAllocation[] = [];
    const taskById = new Map(po.tasks.map((t) => [t.id, t]));
    for (const a of latest?.allocations ?? []) {
      const task = a.productionTaskId ? taskById.get(a.productionTaskId) : null;
      currentAllocations.push({
        stageCode: a.productionTask?.stageDefinition?.code ?? task?.stageDefinition?.code ?? 'UNKNOWN',
        stageDefinitionId:
          a.productionTask?.stageDefinitionId ??
          a.productionTask?.stageDefinition?.id ??
          task?.stageDefinitionId ??
          '',
        plannedStart: a.plannedStart,
        plannedEnd: a.plannedEnd,
        employeeId: a.employeeId,
        resourceSlot: a.resourceSlot,
        isPinned: a.isPinned,
        manuallyAdjusted: a.manuallyAdjusted ?? false,
        taskStatus: a.productionTask?.status ?? task?.status ?? null,
        estimatedMinutes: a.estimatedMinutes,
      });
    }
    for (const task of po.tasks) {
      if (task.status !== 'IN_PROGRESS' && task.status !== 'COMPLETED') continue;
      if (currentAllocations.some((a) => a.stageCode === task.stageDefinition?.code)) continue;
      if (!task.plannedStart || !task.plannedCompletion || !task.stageDefinition) continue;
      currentAllocations.push({
        stageCode: task.stageDefinition.code,
        stageDefinitionId: task.stageDefinitionId ?? '',
        plannedStart: task.plannedStart,
        plannedEnd: task.plannedCompletion,
        employeeId: task.assignedEmployeeId,
        isPinned: true,
        taskStatus: task.status,
        estimatedMinutes: task.estimatedMinutes ?? 60,
      });
    }

    const promiseDate = po.committedDeliveryDate ?? po.requiredDeliveryDate;
    const latestCompletionTarget = promiseDate
      ? calendar.latestProductionCompletion(promiseDate, bufferWorkingDays)
      : null;
    const projected =
      currentAllocations.length > 0
        ? currentAllocations.reduce(
            (max, a) => (a.plannedEnd.getTime() > max.getTime() ? a.plannedEnd : max),
            currentAllocations[0]!.plannedEnd,
          )
        : latest?.earliestAvailableDate ?? null;
    const primaryStatus = classifyLiveOrderStatus({
      productionOrderStatus: po.status,
      scheduleStatus: latest?.status ?? null,
      committedDeliveryDate: po.committedDeliveryDate,
      requestedDeliveryDate: po.requiredDeliveryDate,
      projectedCompletion: projected,
      unschedulableReason: latest?.unschedulableReason,
      materialRisk: latest?.materialRisk ?? liveMat.risk,
      now,
    });
    const bufferPercent = po.product?.productionProfile?.bufferPercent ?? 10;
    const totalMinutes = plannerStages.reduce((sum, s) => sum + s.estimatedMinutes, 0);

    orders.push({
      id: po.id,
      number: po.number,
      customerId: po.customerId ?? po.salesOrder?.id ?? 'unknown',
      priority: po.priority,
      committedDeliveryDate: po.committedDeliveryDate,
      requestedDeliveryDate: po.requiredDeliveryDate,
      latestCompletionTarget,
      createdAt: po.createdAt,
      primaryStatus,
      required,
      consumingStageCodes: consumingRawCodes,
      stageMaterialInputs,
      creditOwnReservation: creditOwn,
      wipNodes: (snapshot?.nodes ?? []).map((n) => ({
        stageCode: n.stageCode,
        isSkipped: n.isSkipped,
        consumesSemiFinished: n.consumesSemiFinished,
        inventoryTracking: n.inventoryTracking,
        outputInventoryItemId: n.outputInventoryItemId,
        outputQtyPerUnit: n.outputQtyPerUnit != null ? Number(n.outputQtyPerUnit) : null,
        consumeInventoryItemIds: n.consumeInventoryItemIds,
      })),
      wipLots: po.inventoryLots.map((lot) => ({
        inventoryItemId: lot.inventoryItemId,
        quantity: Number(lot.quantity),
      })),
      orderQty: Number(po.quantity) || 1,
      stages: plannerStages.map((s) => ({ ...s, notBefore: undefined })),
      currentAllocations,
      bufferMinutes: Math.round((bufferPercent / 100) * totalMinutes),
    });
  }

  return { calendar, workers, now, inventory, orders, stages };
}
