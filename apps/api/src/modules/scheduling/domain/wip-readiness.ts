import { jsonIdList } from '../../../common/helpers/inventory-stage-behavior.util';
import { buildDependencyGraph, detectCycles } from './dependency-graph';
import type { PlannerStageInput } from './types';

export type WipSnapshotNode = {
  stageCode: string;
  isSkipped: boolean;
  consumesSemiFinished: boolean;
  inventoryTracking?: string | null;
  outputInventoryItemId?: string | null;
  outputQtyPerUnit?: number | null;
  consumeInventoryItemIds?: unknown;
};

export type WipLot = {
  inventoryItemId: string;
  quantity: number;
};

export type SemiFinishedNeed = {
  inventoryItemId: string | null;
  qty: number;
  producerCodes: string[];
};

function outputQty(perUnit: number | null | undefined, orderQty: number): number {
  const per = Number(perUnit);
  const safePer = Number.isFinite(per) && per > 0 ? per : 1;
  const qty = Number.isFinite(orderQty) && orderQty > 0 ? orderQty : 1;
  return safePer * qty;
}

export function resolveConsumerSemiFinishedNeeds(
  nodes: WipSnapshotNode[],
  consumer: WipSnapshotNode,
  orderQty: number,
): SemiFinishedNeed[] {
  const itemIds = jsonIdList(consumer.consumeInventoryItemIds);
  const active = nodes.filter((n) => !n.isSkipped);
  if (itemIds.length) {
    const needs: SemiFinishedNeed[] = [];
    for (const inventoryItemId of itemIds) {
      const producers = active.filter((n) => n.outputInventoryItemId === inventoryItemId);
      const skippedOnly = nodes.some(
        (n) => n.isSkipped && n.outputInventoryItemId === inventoryItemId,
      );
      if (producers.length === 0 && skippedOnly) continue;
      const qty = producers.length
        ? producers.reduce((sum, node) => sum + outputQty(node.outputQtyPerUnit, orderQty), 0)
        : orderQty;
      needs.push({
        inventoryItemId,
        qty,
        producerCodes: producers.map((p) => p.stageCode).filter(Boolean),
      });
    }
    return needs;
  }

  const producers = active.filter((n) => n.inventoryTracking === 'PRODUCES_SEMI_FINISHED');
  if (!producers.length) {
    return [{ inventoryItemId: null, qty: orderQty, producerCodes: [] }];
  }
  return [
    {
      inventoryItemId: null,
      qty: producers.reduce((sum, node) => sum + outputQty(node.outputQtyPerUnit, orderQty), 0),
      producerCodes: producers.map((p) => p.stageCode).filter(Boolean),
    },
  ];
}

export function availableWipQty(lots: WipLot[], inventoryItemId: string | null): number {
  return lots
    .filter((lot) => (inventoryItemId ? lot.inventoryItemId === inventoryItemId : true))
    .reduce((sum, lot) => sum + Number(lot.quantity), 0);
}

export function assessWipLotsReady(
  nodes: WipSnapshotNode[],
  lots: WipLot[],
  orderQty: number,
): boolean {
  const consumers = nodes.filter((n) => n.consumesSemiFinished && !n.isSkipped);
  if (!consumers.length) return true;
  for (const consumer of consumers) {
    for (const need of resolveConsumerSemiFinishedNeeds(nodes, consumer, orderQty)) {
      if (availableWipQty(lots, need.inventoryItemId) + 1e-9 < need.qty) return false;
    }
  }
  return true;
}

export type ApplyWipDepsResult = {
  stages: PlannerStageInput[];
  unknownWip: boolean;
  cyclicWip: boolean;
};

function hasCycle(stages: PlannerStageInput[]): boolean {
  return detectCycles(buildDependencyGraph(stages)).length > 0;
}

/**
 * Scheduling-only consume-by-output waits. Does not write the workflow snapshot.
 * Same-order producers still open → extra dependsOnCodes. Missing producer → unknown WIP.
 */
export function applyConsumeWipDependencies(
  stages: PlannerStageInput[],
  nodes: WipSnapshotNode[],
  lots: WipLot[],
  orderQty: number,
): ApplyWipDepsResult {
  const stageCodes = new Set(stages.map((s) => s.code));
  let unknownWip = false;
  let cyclicWip = false;
  const next = stages.map((s) => ({ ...s, dependsOnCodes: [...(s.dependsOnCodes ?? [])] }));
  const byCode = new Map(next.map((s) => [s.code, s]));

  const consumers = nodes.filter((n) => n.consumesSemiFinished && !n.isSkipped);
  for (const consumer of consumers) {
    const stage = byCode.get(consumer.stageCode);
    if (!stage) continue;
    for (const need of resolveConsumerSemiFinishedNeeds(nodes, consumer, orderQty)) {
      if (availableWipQty(lots, need.inventoryItemId) + 1e-9 >= need.qty) continue;
      const producers = need.producerCodes.filter(
        (code) => stageCodes.has(code) && code !== consumer.stageCode,
      );
      if (producers.length === 0) {
        unknownWip = true;
        continue;
      }
      for (const code of producers) {
        if (stage.dependsOnCodes.includes(code)) continue;
        stage.dependsOnCodes.push(code);
        if (hasCycle(next)) {
          stage.dependsOnCodes = stage.dependsOnCodes.filter((c) => c !== code);
          cyclicWip = true;
        }
      }
    }
  }

  return { stages: next, unknownWip, cyclicWip };
}
