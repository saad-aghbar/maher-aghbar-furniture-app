/**
 * Read-only capacity + materials pull-forward audit against maher_erp T0.
 * Prisma reads only. Simulations stay in memory. Does not Sync, generate, or receive.
 *
 * Usage: pnpm smoke:scheduling-pull-forward-audit
 */
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { bomReservationNeeds } from '../apps/api/src/common/helpers/inventory-reservation.util.ts';
import { calculateDurationMinutes } from '../apps/api/src/modules/scheduling/domain/duration-calculator.ts';
import {
  applyMaterialNotBefore,
  assessMaterialReadiness,
  inventoryGroupKey,
  inventorySkuKey,
  requirementFromNeeds,
} from '../apps/api/src/modules/scheduling/domain/material-readiness.ts';
import {
  attachEmptyDayCauses,
  classifyLiveOrderStatus,
  cloneInventory,
  creditOwnReservation,
  nextWorkingYmds,
  simulatePolicy,
  stageStartLegalForMaterials,
} from '../apps/api/src/modules/scheduling/domain/pull-forward-sim.ts';
import { WorkingCalendar } from '../apps/api/src/modules/scheduling/domain/working-calendar.ts';
import { ymdInTimezone } from '../apps/api/src/modules/scheduling/domain/factory-replan.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'tmp-scheduling-pull-forward-audit.json');
const T0 = new Date('2026-08-16T11:00:00.000Z'); // demo as-of 14:00 Asia/Amman

function loadDotenv() {
  try {
    const text = readFileSync(resolve(ROOT, '.env'), 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* already loaded */
  }
}
loadDotenv();

const require = createRequire(resolve(ROOT, 'packages/database/package.json'));
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function iso(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function jsonSafe(value) {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (v instanceof Date ? v.toISOString() : v)),
  );
}

function latestActiveSchedule(schedules) {
  const active = schedules.filter((s) =>
    ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW', 'DRAFT'].includes(s.status),
  );
  const pool = active.length ? active : schedules;
  return [...pool].sort((a, b) => b.version - a.version)[0] ?? null;
}

function loadInventoryMap(items, openPos) {
  const map = {
    fabricMeters: { available: 0, reserved: 0, incoming: [] },
    woodUnits: { available: 0, reserved: 0, incoming: [] },
    foamBlocks: { available: 0, reserved: 0, incoming: [] },
  };
  const itemById = new Map(items.map((i) => [i.id, i]));
  const skuRows = [];
  for (const item of items) {
    const reserved = item.balances.reduce((s, b) => s + Number(b.reservedQty), 0);
    const onHand = item.balances.reduce((s, b) => s + Number(b.availableQty), 0);
    const free = onHand - reserved;
    const groupKey = inventoryGroupKey(String(item.materialGroup ?? item.category));
    if (groupKey) {
      map[groupKey].available += free;
      map[groupKey].reserved += reserved;
    }
    const sku = item.sku?.trim();
    if (sku) {
      const key = inventorySkuKey(sku);
      if (!map[key]) map[key] = { available: 0, reserved: 0, incoming: [] };
      map[key].available += free;
      map[key].reserved += reserved;
      skuRows.push({
        sku,
        itemId: item.id,
        onHand,
        reserved,
        free,
        group: item.materialGroup ?? item.category,
        unit: item.unit,
      });
    }
  }
  for (const po of openPos) {
    const receivedByItem = new Map();
    for (const grn of po.goodsReceipts) {
      for (const line of grn.lines) {
        receivedByItem.set(
          line.inventoryItemId,
          (receivedByItem.get(line.inventoryItemId) ?? 0) + Number(line.receivedQty),
        );
      }
    }
    const remainingByItem = new Map();
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
      if (groupKey) map[groupKey].incoming.push({ qty: remaining, readyAt, poNumber: po.number });
      const sku = item.sku?.trim();
      if (sku) {
        const key = inventorySkuKey(sku);
        if (!map[key]) map[key] = { available: 0, reserved: 0, incoming: [] };
        map[key].incoming.push({ qty: remaining, readyAt, poNumber: po.number });
      }
    }
  }
  return { map, skuRows };
}

async function main() {
  console.log(`pull-forward audit T0=${T0.toISOString()} (read-only)`);

  const calendarRow = await prisma.factoryCalendar.findFirst({
    where: { isDefault: true },
    include: { exceptions: { orderBy: { date: 'asc' } } },
  });
  if (!calendarRow) throw new Error('No factory calendar');
  const calendar = new WorkingCalendar({
    timezone: calendarRow.timezone,
    workingWeekdays: calendarRow.workingWeekdays,
    shiftStart: calendarRow.shiftStart,
    shiftEnd: calendarRow.shiftEnd,
    breaks: calendarRow.breaks ?? [],
    exceptions: calendarRow.exceptions.map((e) => ({
      date: e.date,
      type: e.type,
      shiftStart: e.shiftStart,
      shiftEnd: e.shiftEnd,
      note: e.note,
    })),
  });
  const bufferDays = calendarRow.deliveryBufferWorkingDays ?? 1;

  const [workersRaw, stageDefs, items, openPos, pos, purchaseRequests] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
        archivedAt: null,
        roles: { some: { role: { kind: 'PRODUCTION_WORKER' } } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        department: { select: { code: true } },
        workerSkills: { where: { isActive: true }, select: { stageDefinitionId: true } },
      },
    }),
    prisma.productionStageDefinition.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        nameEn: true,
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
        unit: true,
        balances: { select: { availableQty: true, reservedQty: true } },
      },
    }),
    prisma.purchaseOrder.findMany({
      where: {
        archivedAt: null,
        status: { in: ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] },
      },
      select: {
        number: true,
        expectedDeliveryDate: true,
        status: true,
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
        productDescription: true,
        product: {
          select: {
            sku: true,
            bomDefaults: true,
            productionProfile: { select: { id: true } },
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
        salesOrder: { select: { id: true, number: true, status: true, projectName: true } },
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
            nodes: true,
            edges: true,
          },
        },
        schedules: {
          select: {
            id: true,
            version: true,
            status: true,
            planningMode: true,
            unschedulableReason: true,
            materialReadyAt: true,
            materialRisk: true,
            requestedDateFeasible: true,
            committedDeliveryDate: true,
            requestedDeliveryDate: true,
            earliestAvailableDate: true,
            allocations: {
              select: {
                id: true,
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
    prisma.purchaseRequest.findMany({
      where: { archivedAt: null },
      select: {
        number: true,
        requiredDate: true,
        status: true,
        reason: true,
        purchaseOrder: { select: { number: true, expectedDeliveryDate: true } },
      },
    }),
  ]);

  const workers = workersRaw.map((w) => ({
    id: w.id,
    isActive: true,
    departmentCode: w.department?.code ?? null,
    skillStageDefinitionIds: w.workerSkills.map((s) => s.stageDefinitionId),
    name: `${w.firstName ?? ''} ${w.lastName ?? ''}`.trim(),
  }));
  const stagesMeta = stageDefs.map((s) => ({
    stageDefinitionId: s.id,
    code: s.code,
    schedulingResourceMode: s.schedulingResourceMode,
    resourceSlots: s.resourceSlots,
    skilledWorkerCount: new Set(s.workerSkills.map((x) => x.userId)).size,
    nameEn: s.nameEn,
  }));
  const { map: inventory, skuRows } = loadInventoryMap(items, openPos);

  const simOrders = [];
  const orderFacts = [];
  for (const po of pos) {
    const latest = latestActiveSchedule(po.schedules);
    const snapshot = po.workflowSnapshot;
    const snapByInstance = new Map(
      (snapshot?.nodes ?? []).filter((n) => n.stageInstanceId).map((n) => [n.stageInstanceId, n]),
    );
    const dependsByInstance = new Map();
    if (snapshot) {
      const codeByNodeId = new Map(snapshot.nodes.map((n) => [n.id, n.stageCode]));
      for (const node of snapshot.nodes) {
        if (!node.stageInstanceId || node.isSkipped) continue;
        const preds = snapshot.edges
          .filter((e) => e.toSnapshotNodeId === node.id)
          .map((e) => codeByNodeId.get(e.fromSnapshotNodeId))
          .filter(Boolean);
        dependsByInstance.set(node.stageInstanceId, preds);
      }
    }
    const estimateByDef = new Map((po.product?.stageEstimates ?? []).map((e) => [e.stageDefinitionId, e]));
    const plannerStages = [];
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
          snap?.schedulingResourceMode ?? task.stageDefinition.schedulingResourceMode ?? 'WORKER_CONSTRAINED',
        resourceSlots: snap?.resourceSlots ?? task.stageDefinition.resourceSlots ?? 1,
      });
    }
    if (!plannerStages.length) continue;

    const bom = po.product?.bomDefaults ?? null;
    const needs = bomReservationNeeds(bom, Number(po.quantity) || 1);
    const required = requirementFromNeeds(needs);
    const soStatus = po.salesOrder?.status;
    const creditOwn = Boolean(soStatus && soStatus !== 'WAITING_FOR_MATERIALS');
    const view = creditOwn ? creditOwnReservation(inventory, required) : inventory;
    const liveMat = assessMaterialReadiness(required, view);
    const consumingRawCodes = (snapshot?.nodes ?? [])
      .filter((n) => !n.isSkipped && n.consumesRawMaterials)
      .map((n) => n.stageCode);
    const applied = applyMaterialNotBefore(plannerStages, liveMat.materialReadyAt, consumingRawCodes);

    const currentAllocations = [];
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
        manuallyAdjusted: a.manuallyAdjusted,
        taskStatus: a.productionTask?.status ?? task?.status ?? null,
        estimatedMinutes: a.estimatedMinutes,
      });
    }
    for (const task of po.tasks) {
      if (task.status !== 'IN_PROGRESS' && task.status !== 'COMPLETED') continue;
      if (currentAllocations.some((a) => a.stageCode === task.stageDefinition?.code)) continue;
      if (!task.plannedStart || !task.plannedCompletion) continue;
      currentAllocations.push({
        stageCode: task.stageDefinition.code,
        stageDefinitionId: task.stageDefinitionId,
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
      ? calendar.latestProductionCompletion(promiseDate, bufferDays)
      : null;
    const projected =
      currentAllocations.length > 0
        ? currentAllocations.reduce(
            (max, a) => (a.plannedEnd.getTime() > max.getTime() ? a.plannedEnd : max),
            currentAllocations[0].plannedEnd,
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
      now: T0,
    });

    simOrders.push({
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
      stages: applied.stages.map((s) => ({ ...s, notBefore: undefined })),
      currentAllocations,
      bufferMinutes: 0,
    });

    orderFacts.push({
      id: po.id,
      number: po.number,
      sku: po.product?.sku ?? null,
      projectName: po.salesOrder?.projectName ?? po.productDescription,
      soNumber: po.salesOrder?.number ?? null,
      soStatus: soStatus ?? null,
      poStatus: po.status,
      priority: po.priority,
      requestedDeliveryDate: iso(po.requiredDeliveryDate),
      committedDeliveryDate: iso(po.committedDeliveryDate),
      planningMode: latest?.planningMode ?? null,
      scheduleStatus: latest?.status ?? null,
      scheduleVersion: latest?.version ?? null,
      storedMaterialReadyAt: iso(latest?.materialReadyAt),
      storedMaterialRisk: latest?.materialRisk ?? null,
      unschedulableReason: latest?.unschedulableReason ?? null,
      liveMaterialReady: liveMat.ready,
      liveMaterialReadyAt: iso(liveMat.materialReadyAt),
      liveMaterialRisk: liveMat.risk,
      consumingRawCodes,
      orderMaterialFloor: consumingRawCodes.length === 0 && Boolean(liveMat.materialReadyAt),
      required,
      needs,
      creditOwnReservation: creditOwn,
      primaryStatus,
      allocationCount: currentAllocations.length,
      currentStart: iso(
        currentAllocations.length
          ? currentAllocations.reduce(
              (min, a) => (a.plannedStart.getTime() < min.getTime() ? a.plannedStart : min),
              currentAllocations[0].plannedStart,
            )
          : null,
      ),
      currentEnd: iso(projected),
      snapshotNodeCount: snapshot?.nodes?.length ?? 0,
    });
  }

  const world = {
    calendar,
    workers,
    now: T0,
    inventory: cloneInventory(inventory),
    orders: simOrders,
    stages: stagesMeta,
  };

  console.log(`orders=${simOrders.length} workers=${workers.length} stages=${stagesMeta.length}`);

  const current = simulatePolicy(world, 'CURRENT');
  const earliest = simulatePolicy(world, 'EARLIEST');
  const c5 = simulatePolicy(world, 'N_DAY', 5);
  const c10 = simulatePolicy(world, 'N_DAY', 10);
  const c20 = simulatePolicy(world, 'N_DAY', 20);
  const tagged = attachEmptyDayCauses(current, earliest, world);

  const nowYmd = ymdInTimezone(T0, calendar.timezone);
  const horizon = nextWorkingYmds(calendar, nowYmd, 30);

  const consumersBySku = new Map();
  for (const fact of orderFacts) {
    for (const need of fact.needs ?? []) {
      const sku = need.sku?.trim();
      if (!sku) continue;
      if (!consumersBySku.has(sku)) consumersBySku.set(sku, []);
      consumersBySku.get(sku).push({
        po: fact.number,
        project: fact.projectName,
        qty: need.qty,
        requested: fact.requestedDeliveryDate,
        committed: fact.committedDeliveryDate,
        stageStarts: (latestAllocs(current, fact.id) ?? []).map((a) => ({
          stage: a.stageCode,
          start: iso(a.plannedStart),
        })),
      });
    }
  }

  function latestAllocs(metrics, orderId) {
    return metrics.allocations.filter((a) => a.orderId === orderId);
  }

  const materialTimeline = skuRows
    .map((row) => {
      const inv = inventory[inventorySkuKey(row.sku)] ?? { incoming: [] };
      const incoming = (inv.incoming ?? []).map((lot) => ({
        qty: lot.qty,
        eta: iso(lot.readyAt),
        poNumber: lot.poNumber ?? null,
      }));
      const consuming = consumersBySku.get(row.sku) ?? [];
      const stageStarts = consuming.flatMap((c) => c.stageStarts.map((s) => s.start).filter(Boolean));
      const nextRequiredBy = stageStarts.length
        ? stageStarts.sort()[0]
        : 'NONE — no canonical material required-by; closest is consuming-stage plannedStart when scheduled';
      const nextDemand = consuming.reduce((s, c) => s + Number(c.qty || 0), 0);
      const incomingQty = incoming.reduce((s, l) => s + l.qty, 0);
      const uncovered = Math.max(0, nextDemand - row.free);
      const shortage = Math.max(0, nextDemand - row.free - incomingQty);
      let risk = 'SAFE';
      if (shortage > 1e-9) risk = 'SHORTAGE';
      else if (uncovered > 1e-9) {
        const eta = incoming.map((l) => l.eta).filter(Boolean).sort()[0];
        const requiredBy =
          typeof nextRequiredBy === 'string' && /^\d{4}-\d{2}-\d{2}/.test(nextRequiredBy)
            ? nextRequiredBy
            : null;
        if (eta && requiredBy && eta > requiredBy) risk = 'MATERIAL_RISK';
      }
      return {
        sku: row.sku,
        onHand: row.onHand,
        reserved: row.reserved,
        free: row.free,
        incomingQty,
        incoming,
        nextRequiredBy,
        orders: consuming.map((c) => ({ po: c.po, project: c.project, qty: c.qty })),
        nextDemand,
        shortage,
        risk,
      };
    })
    .filter((row) => row.incomingQty > 0 || row.reserved > 0 || row.sku === 'MAT-ITAL-VEL' || row.shortage > 0)
    .sort((a, b) => Number(a.incoming[0]?.eta ?? '9999') - Number(b.incoming[0]?.eta ?? '9999') || a.sku.localeCompare(b.sku));

  const cedarFact =
    orderFacts.find((f) => f.projectName === 'Cedar Italian velvet recliner' || f.number === 'PO-2026-00056') ??
    null;
  const cedarSim = cedarFact ? earliest.orders.find((o) => o.orderId === cedarFact.id) : null;
  const cedarCurrentAlloc = cedarFact ? latestAllocs(current, cedarFact.id) : [];
  const cedarEarliestAlloc = cedarFact ? latestAllocs(earliest, cedarFact.id) : [];
  const velvetRow = skuRows.find((r) => r.sku === 'MAT-ITAL-VEL');
  const velvetInv = inventory[inventorySkuKey('MAT-ITAL-VEL')];
  const velvetReady = velvetInv?.incoming?.[0]?.readyAt ?? null;

  const cedarStagesBeforeVelvet = cedarEarliestAlloc
    .filter((a) => velvetReady && a.plannedStart.getTime() < velvetReady.getTime())
    .map((a) => ({ stage: a.stageCode, start: iso(a.plannedStart), end: iso(a.plannedEnd) }));
  const cedarUpholstery = cedarEarliestAlloc.find((a) => a.stageCode === 'UPHOLSTERY');
  const cedarIdleDays = tagged.days
    .filter((d) => d.bucket === 'EMPTY' || d.bucket === 'LT_25')
    .map((d) => {
      const start = calendar.intervalsForLocalYmd(d.ymd)[0]?.start;
      const legal = cedarEarliestAlloc.filter((a) => {
        if (!start) return false;
        const overlap = a.plannedStart <= start && a.plannedEnd > start
          ? true
          : ymdInTimezone(a.plannedStart, calendar.timezone) === d.ymd;
        return overlap;
      });
      const could =
        start && velvetReady && start.getTime() < velvetReady.getTime()
          ? cedarStagesBeforeVelvet.length > 0
          : cedarEarliestAlloc.length > 0;
      return {
        ymd: d.ymd,
        cause: d.cause,
        occupancyUtilPct: Number(d.occupancyUtilPct.toFixed(1)),
        cedarAllocationsOnDay: legal.map((a) => a.stageCode),
        cedarCouldConsume: could && legal.length > 0,
      };
    });

  const dayTable = tagged.days.map((d, i) => {
    const e = earliest.days[i];
    const t = c10.days[i];
    return {
      ymd: d.ymd,
      open: d.open,
      overtime: d.overtime,
      occupancyAvailable: d.occupancyAvailableMinutes,
      currentOccupancyAlloc: d.occupancyAllocatedMinutes,
      currentOccupancyUtil: Number(d.occupancyUtilPct.toFixed(1)),
      currentStageBucketUtil: Number(d.stageBucketUtilPct.toFixed(1)),
      currentOrders: d.distinctOrders,
      currentAllocs: d.allocationCount,
      earliestOccupancyUtil: e ? Number(e.occupancyUtilPct.toFixed(1)) : null,
      earliestOccupancyAlloc: e?.occupancyAllocatedMinutes ?? null,
      c10OccupancyUtil: t ? Number(t.occupancyUtilPct.toFixed(1)) : null,
      bucket: d.bucket,
      cause: d.cause,
      stageBreakdown: d.stageBreakdown.filter((s) => s.allocatedMinutes > 0 || s.availableMinutes > 0).slice(0, 12),
    };
  });

  const front10 = (m) => {
    const slice = m.days.slice(0, 10);
    const avg =
      slice.length === 0
        ? 0
        : slice.reduce((s, d) => s + d.occupancyUtilPct, 0) / slice.length;
    return {
      avgOccupancyUtilPct: Number(avg.toFixed(2)),
      emptyDays: slice.filter((d) => d.bucket === 'EMPTY').length,
      daysLt25: slice.filter((d) => d.bucket === 'EMPTY' || d.bucket === 'LT_25').length,
    };
  };

  const policySummary = (m) => ({
    policy: m.policy,
    nWorkingDays: m.nWorkingDays ?? null,
    avgOccupancyUtilPct: Number(m.avgOccupancyUtilPct.toFixed(2)),
    front10WorkingDays: front10(m),
    emptyDays: m.emptyDays,
    daysLt25: m.daysLt25,
    daysGt85: m.daysGt85,
    ordersFinishedEarlier: m.ordersFinishedEarlier,
    meanDaysEarly: Number(m.meanDaysEarly.toFixed(2)),
    maxDaysEarly: m.maxDaysEarly,
    materialViolations: m.materialViolations,
    wipUnknown: m.wipUnknown,
    placedOrders: m.placedOrders,
    blockedOrders: m.blockedOrders,
    occupancyUtilAtTargets: m.occupancyUtilAtTargets,
  });

  const movableLater = orderFacts
    .map((f) => {
      const er = earliest.orders.find((o) => o.orderId === f.id);
      if (!er?.placed || !er.earliestCompletion || !f.currentStart) return null;
      const currentStart = new Date(f.currentStart);
      const earliestStart = er.allocations.reduce(
        (min, a) => (a.plannedStart.getTime() < min.getTime() ? a.plannedStart : min),
        er.allocations[0]?.plannedStart ?? currentStart,
      );
      if (earliestStart.getTime() + 60_000 >= currentStart.getTime()) return null;
      return {
        number: f.number,
        project: f.projectName,
        primaryStatus: f.primaryStatus,
        planningMode: f.planningMode,
        currentStart: f.currentStart,
        earliestStart: iso(earliestStart),
        materialReadyAt: iso(er.materialReadyAt) ?? f.liveMaterialReadyAt,
        consumingRawCodes: f.consumingRawCodes,
        reason: er.blockReason ?? 'MOVABLE_EARLIER',
      };
    })
    .filter(Boolean);

  const granularityCounts = {
    ordersWithConsumingFlags: orderFacts.filter((f) => f.consumingRawCodes.length > 0).length,
    ordersWithOrderWideFloor: orderFacts.filter((f) => f.orderMaterialFloor).length,
    ordersTotal: orderFacts.length,
  };

  const evidence = {
    t0: iso(T0),
    timezone: calendarRow.timezone,
    workingWeekdays: calendarRow.workingWeekdays,
    shift: `${calendarRow.shiftStart}–${calendarRow.shiftEnd}`,
    deliveryBufferWorkingDays: bufferDays,
    horizonWorkingDays: horizon,
    workerCount: workers.length,
    incompleteProductionOrders: pos.length,
    simulatedOrders: simOrders.length,
    policy: {
      current: policySummary(current),
      earliest: policySummary(earliest),
      n5: policySummary(c5),
      n10: policySummary(c10),
      n20: policySummary(c20),
    },
    days: dayTable,
    emptyLowCauses: tagged.days
      .filter((d) => d.bucket === 'EMPTY' || d.bucket === 'LT_25')
      .map((d) => ({ ymd: d.ymd, bucket: d.bucket, cause: d.cause, util: Number(d.occupancyUtilPct.toFixed(1)) })),
    movableLater,
    granularityCounts,
    materialTimeline,
    purchaseRequests: purchaseRequests.map((pr) => ({
      number: pr.number,
      requiredDate: iso(pr.requiredDate),
      poExpected: iso(pr.purchaseOrder?.expectedDeliveryDate),
      reason: pr.reason,
      status: pr.status,
    })),
    cedar: cedarFact
      ? {
          ...cedarFact,
          velvet: {
            sku: 'MAT-ITAL-VEL',
            onHand: velvetRow?.onHand ?? null,
            reserved: velvetRow?.reserved ?? null,
            free: velvetRow?.free ?? null,
            incoming: (velvetInv?.incoming ?? []).map((l) => ({ qty: l.qty, eta: iso(l.readyAt), po: l.poNumber })),
          },
          earliestPlaced: cedarSim?.placed ?? false,
          earliestBlock: cedarSim?.blockReason ?? null,
          earliestCompletion: iso(cedarSim?.earliestCompletion),
          stagesBeforeVelvet: cedarStagesBeforeVelvet,
          upholsteryEarliestStart: iso(cedarUpholstery?.plannedStart),
          upholsteryLegal: cedarUpholstery
            ? stageStartLegalForMaterials({
                plannedStart: cedarUpholstery.plannedStart,
                stageCode: 'UPHOLSTERY',
                consumingStageCodes: cedarFact.consumingRawCodes,
                materialReadyAt: velvetReady,
              })
            : null,
          currentAllocations: cedarCurrentAlloc.map((a) => ({
            stage: a.stageCode,
            start: iso(a.plannedStart),
            end: iso(a.plannedEnd),
          })),
          earliestAllocations: cedarEarliestAlloc.map((a) => ({
            stage: a.stageCode,
            start: iso(a.plannedStart),
            end: iso(a.plannedEnd),
            legal: stageStartLegalForMaterials({
              plannedStart: a.plannedStart,
              stageCode: a.stageCode,
              consumingStageCodes: cedarFact.consumingRawCodes,
              materialReadyAt: liveReadyAt(cedarFact, velvetReady),
            }),
          })),
          idleDaysVsCedar: cedarIdleDays.slice(0, 30),
        }
      : null,
    planningModeCounts: countBy(orderFacts, (f) => f.planningMode ?? 'NONE'),
    primaryStatusCounts: countBy(orderFacts, (f) => f.primaryStatus),
    waitingForMaterials: orderFacts.filter((f) => f.poStatus === 'WAITING_FOR_MATERIALS' || f.soStatus === 'WAITING_FOR_MATERIALS').map((f) => f.number),
    jointSimulation: {
      earliestMaterialViolations: earliest.materialViolations,
      c10MaterialViolations: c10.materialViolations,
      pass: earliest.materialViolations === 0 && c10.materialViolations === 0,
    },
    orderFacts,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(jsonSafe(evidence), null, 2));
  console.log(`wrote ${OUT}`);
  console.log('CURRENT', evidence.policy.current);
  console.log('EARLIEST', evidence.policy.earliest);
  console.log('N10', evidence.policy.n10);
  console.log('empty/low causes', JSON.stringify(countBy(evidence.emptyLowCauses, (d) => d.cause ?? 'none')));
  console.log('Cedar', cedarFact?.number, cedarFact?.liveMaterialReadyAt, 'consuming', cedarFact?.consumingRawCodes);
  console.log('joint', evidence.jointSimulation);
}

function liveReadyAt(fact, velvetReady) {
  if (fact.liveMaterialReadyAt) return new Date(fact.liveMaterialReadyAt);
  return velvetReady;
}

function countBy(rows, keyFn) {
  const out = {};
  for (const row of rows) {
    const k = String(keyFn(row));
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
