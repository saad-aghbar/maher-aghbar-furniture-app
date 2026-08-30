import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import {
  isQcFailResult,
  isQcPassResult,
  recommendReworkStage,
  type QualityTimelineEvent,
} from './quality-floor';
import { pieceLabelsFromJson, pieceLabelsFromMetadata } from '../production/piece-labels';

function personName(
  u: { firstName?: string | null; lastName?: string | null; username?: string | null } | null | undefined,
): string | null {
  if (!u) return null;
  const n = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
  return n || u.username || null;
}

@Injectable()
export class QualityFloorService {
  constructor(private readonly prisma: PrismaService) {}

  async listEligibleReworkStages(productionOrderId: string, category?: string | null) {
    const stages = await this.prisma.productionStageInstance.findMany({
      where: { productionOrderId },
      include: { stageDefinition: true },
    });
    const mapped = stages.map((s) => ({
      stageInstanceId: s.id,
      stageCode: s.stageDefinition.code,
      nameEn: s.stageDefinition.nameEn,
      nameAr: s.stageDefinition.nameAr,
      executionKind: s.stageDefinition.executionKind,
    }));
    return recommendReworkStage({ category, stages: mapped });
  }

  async buildTimeline(productionOrderId: string): Promise<QualityTimelineEvent[]> {
    const [inspections, reworks, usages, finTxs] = await Promise.all([
      this.prisma.qualityInspection.findMany({
        where: { productionOrderId },
        include: {
          inspector: { select: { firstName: true, lastName: true, username: true } },
          defects: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.reworkRequest.findMany({
        where: { productionOrderId },
        include: {
          tasks: {
            include: {
              assignedEmployee: { select: { firstName: true, lastName: true, username: true } },
            },
          },
          reentryStageInstance: { include: { stageDefinition: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.productionTaskMaterialUsage.findMany({
        where: {
          productionOrderId,
          task: { isRework: true },
        },
        include: {
          task: { select: { number: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.inventoryTransaction.findMany({
        where: {
          referenceType: 'ProductionOrder',
          referenceId: productionOrderId,
          type: 'FINISHED_GOODS_RECEIPT',
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const events: QualityTimelineEvent[] = [];

    for (const insp of inspections) {
      const actor = personName(insp.inspector);
      const priorFails = inspections.filter(
        (i) =>
          i.createdAt < insp.createdAt && i.result && isQcFailResult(String(i.result)),
      ).length;
      events.push({
        at: insp.createdAt.toISOString(),
        kind: priorFails > 0 ? 'REINSPECTION' : 'INSPECTION_STARTED',
        titleEn: priorFails > 0 ? 'Reinspection' : 'Inspection started',
        actorName: actor,
        meta: { inspectionId: insp.id, number: insp.number },
      });
      if (insp.result && isQcPassResult(String(insp.result))) {
        events.push({
          at: (insp.inspectedAt ?? insp.createdAt).toISOString(),
          kind: 'INSPECTION_PASSED',
          titleEn: 'Inspection passed',
          detailEn: insp.notes,
          actorName: actor,
          meta: { inspectionId: insp.id, result: insp.result },
        });
      } else if (insp.result && isQcFailResult(String(insp.result))) {
        const defect = insp.defects[0];
        events.push({
          at: (insp.inspectedAt ?? insp.createdAt).toISOString(),
          kind: 'INSPECTION_FAILED',
          titleEn: 'Inspection failed',
          detailEn: defect?.description ?? insp.notes,
          actorName: actor,
          meta: {
            inspectionId: insp.id,
            result: insp.result,
            stageCode: defect?.stageCode,
          },
        });
      }
    }

    for (const rw of reworks) {
      const worker = personName(rw.tasks[0]?.assignedEmployee);
      events.push({
        at: rw.createdAt.toISOString(),
        kind: 'REWORK_STARTED',
        titleEn: 'Rework required',
        detailEn: rw.description,
        actorName: worker,
        meta: {
          reworkId: rw.id,
          status: rw.status,
          stage: rw.reentryStageInstance?.stageDefinition?.code,
        },
      });
      if (rw.completedAt) {
        events.push({
          at: rw.completedAt.toISOString(),
          kind: 'REWORK_COMPLETED',
          titleEn: 'Rework completed',
          detailEn: rw.notes,
          actorName: worker,
          meta: { reworkId: rw.id },
        });
      }
    }

    for (const u of usages) {
      const qty = Number(u.actualQty ?? u.expectedQty ?? 0);
      events.push({
        at: u.createdAt.toISOString(),
        kind: 'REWORK_MATERIAL',
        titleEn: 'Rework material used',
        detailEn: `${u.sku} × ${qty}`,
        meta: { usageId: u.id, sku: u.sku, qty },
      });
    }

    for (const tx of finTxs) {
      events.push({
        at: tx.createdAt.toISOString(),
        kind: 'FIN_POSTED',
        titleEn: 'Finished goods posted',
        detailEn: `Qty ${Number(tx.quantity)}`,
        meta: { transactionId: tx.id },
      });
    }

    events.sort((a, b) => a.at.localeCompare(b.at));
    return events;
  }

  async getFloorContextForOrder(productionOrderId: string) {
    const po = await this.prisma.productionOrder.findUnique({
      where: { id: productionOrderId },
      include: {
        product: true,
        salesOrder: { include: { customer: true } },
        salesOrderLine: { include: { productionSetup: true } },
        stages: {
          include: {
            stageDefinition: true,
            tasks: {
              include: {
                assignedEmployee: { select: { firstName: true, lastName: true, username: true } },
              },
            },
          },
        },
      },
    });
    if (!po) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Production order not found.' });
    }

    const inspections = await this.prisma.qualityInspection.findMany({
      where: { productionOrderId },
      include: { items: true, defects: true, rework: true, inspector: true },
      orderBy: { createdAt: 'desc' },
    });
    const latest = inspections[0] ?? null;
    const openRework = await this.prisma.reworkRequest.findFirst({
      where: {
        productionOrderId,
        status: { in: ['AWAITING_STAGE', 'IN_PROGRESS'] },
      },
      include: {
        tasks: true,
        reentryStageInstance: { include: { stageDefinition: true } },
        inspection: { include: { defects: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const priorProduction = [...po.stages]
      .filter((s) => s.status === 'COMPLETED')
      .reverse()
      .find((s) => {
        const code = s.stageDefinition.code.toUpperCase();
        const kind = String(s.stageDefinition.executionKind ?? '').toUpperCase();
        return (
          kind !== 'QUALITY' &&
          kind !== 'LOGISTICS' &&
          code !== 'INSPECTION' &&
          code !== 'PACKAGING' &&
          code !== 'DELIVERY'
        );
      });

    const packagingStage = po.stages.find((s) =>
      ['PACKAGING', 'PACK'].includes(s.stageDefinition.code.toUpperCase()),
    );
    let expectedPackages: Array<{ code: string; labelEn: string; labelAr?: string }> = [];
    if (packagingStage) {
      const snap = await this.prisma.productionOrderWorkflowSnapshotNode.findFirst({
        where: { stageInstanceId: packagingStage.id },
      });
      const fromSnap = pieceLabelsFromMetadata(snap?.metadata);
      const packExp = po.salesOrderLine?.productionSetup?.packagingExpectation as
        | { pieceLabels?: unknown; expectedPieceCount?: number }
        | null
        | undefined;
      const fromSetup = pieceLabelsFromJson(packExp?.pieceLabels);
      const labels = fromSnap.length ? fromSnap : fromSetup;
      expectedPackages = labels.map((l, i) => ({
        code: `P${i + 1}`,
        labelEn: l.nameEn,
        labelAr: l.nameAr,
      }));
      if (!expectedPackages.length) {
        const n = Math.max(
          1,
          Math.floor(Number(snap?.expectedPieceCount ?? packExp?.expectedPieceCount ?? 1)),
        );
        expectedPackages = Array.from({ length: n }, (_, i) => ({
          code: `P${i + 1}`,
          labelEn: `Package ${i + 1}`,
        }));
      }
    }

    const setup = po.salesOrderLine?.productionSetup;
    const complexity = String(
      setup?.manufacturingComplexity ?? po.salesOrderLine?.manufacturingComplexity ?? '',
    ).toUpperCase();
    const isCustom = complexity === 'CUSTOM' || complexity === 'MODIFIED';
    const orderDims = (setup?.orderDimensions ?? null) as Record<string, unknown> | null;
    const measurements = setup?.measurements ?? null;

    const lightAnalytics = {
      inspectionAttempts: inspections.filter((i) => i.result).length,
      reworkCount: await this.prisma.reworkRequest.count({ where: { productionOrderId } }),
      failureCategories: inspections
        .flatMap((i) => i.defects.map((d) => d.stageCode || d.description))
        .filter(Boolean)
        .slice(0, 8),
      latestResult: latest?.result ?? null,
      openReworkStatus: openRework?.status ?? null,
    };

    const completedWorker = priorProduction?.tasks.find((t) => t.status === 'COMPLETED');

    return {
      productionOrderId: po.id,
      productionOrderNumber: po.number,
      salesOrderNumber: po.salesOrder?.number ?? null,
      dealerName: po.salesOrder?.customer?.nameEn ?? po.salesOrder?.customer?.nameAr ?? null,
      productName: po.product?.nameEn ?? po.productDescription,
      productImageUrl: po.product?.imageUrl ?? null,
      quantity: Number(po.quantity) || 1,
      orderStatus: po.status,
      currentStageCode: po.currentStageCode,
      itemUnderInspection: priorProduction
        ? {
            stageCode: priorProduction.stageDefinition.code,
            stageNameEn: priorProduction.stageDefinition.nameEn,
            completedAt: priorProduction.actualEnd,
            workerName: personName(completedWorker?.assignedEmployee),
          }
        : null,
      manufacturingSpec: isCustom
        ? {
            complexity,
            orderDimensions: orderDims,
            measurements,
            factoryNotes: setup?.factoryNotes ?? null,
            requestedFabricLabel: setup?.requestedFabricLabel ?? null,
            manufacturingName: setup?.manufacturingName ?? null,
          }
        : null,
      latestInspection: latest,
      inspections,
      openRework,
      expectedPackages,
      packagingUnlocked: Boolean(
        latest?.result && isQcPassResult(String(latest.result)) && !openRework,
      ),
      lightAnalytics,
      timeline: await this.buildTimeline(productionOrderId),
      partialFailurePolicy: 'PO_LEVEL_ALL_OR_NOTHING' as const,
    };
  }

  async qualityAttentionCards(limit = 20) {
    const open = await this.prisma.reworkRequest.findMany({
      where: { status: { in: ['AWAITING_STAGE', 'IN_PROGRESS'] } },
      include: {
        productionOrder: {
          include: {
            product: true,
            salesOrder: true,
          },
        },
        inspection: { include: { defects: true } },
        reentryStageInstance: { include: { stageDefinition: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return open.map((rw) => {
      const defect = rw.inspection?.defects?.[0];
      const so = rw.productionOrder.salesOrder?.number ?? null;
      const product =
        rw.productionOrder.product?.nameEn ?? rw.productionOrder.productDescription ?? 'Order';
      const stage =
        rw.reentryStageInstance?.stageDefinition?.nameEn ??
        defect?.stageCode ??
        'Production';
      const reason = defect?.description ?? rw.description;
      return {
        kind: 'QUALITY_ATTENTION' as const,
        titleEn: 'Quality attention',
        subtitleEn: [so, product].filter(Boolean).join(' · '),
        reasonEn: `Inspection failed · ${stage} · ${reason}`,
        actionEn: rw.status === 'IN_PROGRESS' ? 'Rework in progress' : 'Rework waiting',
        productionOrderId: rw.productionOrderId,
        productionOrderNumber: rw.productionOrder.number,
        reworkId: rw.id,
        inspectionId: rw.inspectionId,
        href: `/production/${rw.productionOrderId}`,
      };
    });
  }
}
