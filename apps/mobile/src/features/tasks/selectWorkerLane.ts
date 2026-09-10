import { localizedName } from '@maher/i18n';
import type { Locale } from '@maher/types';
import type { ProductionFlowStage } from '@/features/production-flow/selectProductionFlow';
import type { WorkerOrderLaneNode } from './api';
import { isLaneTaskOpenable } from './selectWorkerOrder';
import { liveElapsedMinutes, liveTaskProgressPercent } from './liveTaskProgressPercent';

export function localizedLaneStageName(node: WorkerOrderLaneNode, locale: Locale): string {
  const named = localizedName(locale, {
    nameEn: node.nameEn ?? node.stageName,
    nameAr: node.nameAr ?? undefined,
    nameHe: node.nameHe ?? undefined,
  });
  return named || node.stageName || node.stageCode;
}

export function workerStageAccess(
  node: WorkerOrderLaneNode,
): NonNullable<ProductionFlowStage['workerAccess']> {
  if (node.lockState.kind === 'done') return 'done';
  if (!node.assignedToMe) return 'foreign';
  if (isLaneTaskOpenable(node) || node.status === 'IN_PROGRESS' || node.status === 'PAUSED') {
    return 'available';
  }
  return 'assigned';
}

function flowStatus(node: WorkerOrderLaneNode): string {
  const access = workerStageAccess(node);
  if (access === 'done') return 'COMPLETED';
  if (access === 'available') {
    if (node.status === 'IN_PROGRESS' || node.status === 'PAUSED') return 'IN_PROGRESS';
    return 'READY';
  }
  return 'PENDING';
}

export function workerLaneToFlowStages(
  lane: WorkerOrderLaneNode[],
  locale: Locale,
  now?: Date | number,
): ProductionFlowStage[] {
  return lane.map((node, index) => {
    const workerAccess = workerStageAccess(node);
    const running = node.status === 'IN_PROGRESS';
    const elapsed = liveElapsedMinutes({
      running,
      openStartedAt: node.openStartedAt,
      closedSeconds: node.actualSeconds ?? 0,
      now,
    });
    const frozenElapsed = running
      ? Math.max(elapsed, node.elapsedMinutes ?? 0)
      : (node.elapsedMinutes ?? elapsed);
    const progressPercent =
      workerAccess === 'done'
        ? 100
        : liveTaskProgressPercent({
            status: node.status,
            elapsedMinutes: frozenElapsed,
            estimatedMinutes: node.estimatedMinutes,
          });
    return {
      code: node.stageCode,
      name: localizedLaneStageName(node, locale),
      status: flowStatus(node),
      progressPercent,
      workerAccess,
      dependsOnCodes: node.dependsOnIds.length > 0 ? node.dependsOnIds : node.dependsOnCodes,
      sortOrder: node.sortOrder ?? index,
      graphKey: node.id,
      snapshotNodeId: node.id,
      taskId: node.taskId,
      assignees: [],
      actualStart: null,
      actualEnd: null,
      plannedEnd: node.plannedCompletion,
      isOverdue: false,
      blockers: [],
      notes: null,
      attachmentCount: 0,
      photos: [],
    };
  });
}

export function selectNextStationHint(lane: WorkerOrderLaneNode[]): WorkerOrderLaneNode | null {
  return (
    lane.find((node) => isLaneTaskOpenable(node)) ??
    lane.find((node) => node.assignedToMe && node.lockState.kind === 'locked') ??
    null
  );
}

export function findLaneNodeByGraphKey(
  lane: WorkerOrderLaneNode[],
  graphKey: string | undefined,
): WorkerOrderLaneNode | null {
  if (!graphKey) return null;
  return lane.find((node) => node.id === graphKey) ?? null;
}
