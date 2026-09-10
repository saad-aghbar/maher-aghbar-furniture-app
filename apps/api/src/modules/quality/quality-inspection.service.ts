import { Injectable } from '@nestjs/common';
import { QualityResult } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { StagePipelineService } from '../production/stage-pipeline.service';
import { ProductionInventoryService } from '../production/production-inventory.service';
import { ProductionReworkService } from '../production/production-rework.service';
import { checklistProgressPercent, inspectionItemsNeedResync } from './inspection-pieces';
import { loadIncomingPiecesForInspection } from './prior-stage-packages';
import {
  classifyInspectionItems,
  mergeChecklistPatches,
  pieceReworkPlans,
  inspectionSubmitGate,
  type InspectionChecklistPatch,
} from './quality-inspection-submit';

function isQcPass(result: QualityResult | string | null | undefined) {
  return result === QualityResult.PASSED || result === QualityResult.PASSED_WITH_NOTES;
}

function isQcFail(result: QualityResult | string | null | undefined) {
  return result === QualityResult.FAILED_REWORK_REQUIRED || result === QualityResult.BLOCKED;
}

@Injectable()
export class QualityInspectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly pipeline: StagePipelineService,
    private readonly productionInventory: ProductionInventoryService,
    private readonly rework: ProductionReworkService,
  ) {}

  async piecesForOrder(productionOrderId: string, stageCode?: string) {
    return loadIncomingPiecesForInspection(this.prisma, productionOrderId, stageCode);
  }

  async ensurePieceItems(
    inspectionId: string,
    productionOrderId: string,
    stageCode?: string | null,
  ) {
    const existing = await this.prisma.qualityInspectionItem.findMany({
      where: { inspectionId },
    });
    const pieces = await this.piecesForOrder(productionOrderId, stageCode ?? 'INSPECTION');
    if (!inspectionItemsNeedResync(existing, pieces)) {
      return existing;
    }
    const preserved = new Map(
      existing.map((item) => [item.wipPieceId || item.checklistCode, item]),
    );
    if (existing.length) {
      await this.prisma.qualityInspectionItem.deleteMany({ where: { inspectionId } });
    }
    if (!pieces.length) return [];
    await this.prisma.qualityInspectionItem.createMany({
      data: pieces.map((p) => {
        const prev = preserved.get(p.wipPieceId || p.checklistCode);
        return {
          inspectionId,
          checklistCode: p.checklistCode,
          label: p.label,
          wipPieceId: p.wipPieceId,
          photoDocumentIds: p.photoDocumentId
            ? [p.photoDocumentId]
            : (prev?.photoDocumentIds ?? []),
          result: prev?.result ?? null,
          note: prev?.note ?? null,
          reentryStageInstanceIds: prev?.reentryStageInstanceIds ?? [],
          voiceDocumentId: prev?.voiceDocumentId ?? null,
        };
      }),
    });
    return this.prisma.qualityInspectionItem.findMany({ where: { inspectionId } });
  }

  async create(dto: {
    productionOrderId: string;
    stageCode?: string;
    notes?: string;
    inspectorId: string;
  }) {
    const existingOpen = await this.prisma.qualityInspection.findFirst({
      where: {
        productionOrderId: dto.productionOrderId,
        result: null,
      },
      include: { items: true, productionOrder: true },
      orderBy: { createdAt: 'desc' },
    });
    if (existingOpen) {
      return existingOpen;
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      const number = await this.sequences.next('QC', 'QC');
      try {
        return await this.prisma.qualityInspection.create({
          data: {
            number,
            productionOrderId: dto.productionOrderId,
            stageCode: dto.stageCode ?? 'INSPECTION',
            inspectorId: dto.inspectorId,
            notes: dto.notes,
          },
          include: { items: true, productionOrder: true },
        });
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === 'P2002' && attempt < 2) continue;
        throw err;
      }
    }
    throw new Error('Could not allocate quality inspection number');
  }

  async submit(params: {
    id: string;
    userId: string;
    result?: QualityResult | string | null;
    notes?: string;
    defectDescription?: string;
    defectCategory?: string;
    affectedQty?: number;
    severity?: string;
    reentryStageInstanceId?: string;
    checklistResults?: InspectionChecklistPatch[];
    photoDocumentIds?: string[];
    voiceDocumentId?: string;
  }) {
    const inspection = await this.prisma.qualityInspection.findUniqueOrThrow({
      where: { id: params.id },
      include: { items: true },
    });
    if (inspection.result && isQcPass(inspection.result)) {
      return this.load(params.id);
    }

    const merged = mergeChecklistPatches(inspection.items, params.checklistResults);
    const classified = classifyInspectionItems(merged);
    const { wantsFail, allPass, skipPiecePlans } = inspectionSubmitGate(
      params.result == null ? null : String(params.result),
    );
    const piecePlans = skipPiecePlans ? [] : pieceReworkPlans(merged, params.reentryStageInstanceId);
    const isPartial = !allPass && !wantsFail && (classified.hasFail || piecePlans.length > 0);

    const pendingStarts: Array<{
      reworkId: string;
      stageInstanceId: string;
      notes?: string;
      wipPieceId?: string | null;
      inspectionItemId?: string;
    }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const item of merged) {
        await tx.qualityInspectionItem.update({
          where: { id: item.id },
          data: {
            result: item.result ? (item.result as never) : null,
            note: item.note,
            wipPieceId: item.wipPieceId,
            reentryStageInstanceIds: item.reentryStageInstanceIds ?? [],
            voiceDocumentId: item.voiceDocumentId ?? null,
            photoDocumentIds: item.photoDocumentIds ?? [],
          },
        });
      }

      const photoIds = [
        ...new Set([
          ...(params.photoDocumentIds ?? []),
          ...merged.flatMap((i) => i.photoDocumentIds ?? []),
        ]),
      ];
      if (photoIds.length) {
        await tx.document.updateMany({
          where: { id: { in: photoIds } },
          data: {
            productionOrderId: inspection.productionOrderId,
            category: `QC_PHOTO:${params.id}`,
            visibility: 'INTERNAL',
          },
        });
      }
      const voiceIds = [
        params.voiceDocumentId,
        ...merged.map((i) => i.voiceDocumentId),
      ].filter((id): id is string => Boolean(id));
      if (voiceIds.length) {
        await tx.document.updateMany({
          where: { id: { in: voiceIds } },
          data: {
            productionOrderId: inspection.productionOrderId,
            category: `QC_VOICE:${params.id}`,
            visibility: 'INTERNAL',
          },
        });
      }

      const progress = checklistProgressPercent(merged);
      const stage = await tx.productionStageInstance.findFirst({
        where: {
          productionOrderId: inspection.productionOrderId,
          stageDefinition: { code: inspection.stageCode ?? 'INSPECTION' },
        },
        include: { tasks: true, stageDefinition: true },
      });

      if (allPass) {
        await tx.qualityInspection.update({
          where: { id: params.id },
          data: {
            result: QualityResult.PASSED,
            notes: params.notes ?? inspection.notes,
            inspectorId: params.userId,
            inspectedAt: new Date(),
          },
        });
        if (stage) {
          for (const task of stage.tasks) {
            if (task.status !== 'COMPLETED' && !task.isRework) {
              await tx.productionTask.update({
                where: { id: task.id },
                data: {
                  status: 'COMPLETED',
                  progressPercent: 100,
                  actualCompletion: new Date(),
                },
              });
            }
          }
          await tx.productionStageInstance.update({
            where: { id: stage.id },
            data: {
              status: 'COMPLETED',
              progressPercent: 100,
              actualEnd: new Date(),
              inspectionStatus: 'PASSED',
            },
          });
          await this.productionInventory.onInspectionPassed({
            productionOrderId: inspection.productionOrderId,
            userId: params.userId,
            tx,
          });
          await this.pipeline.onTaskComplete(inspection.productionOrderId, stage.id, tx);
        } else {
          await this.productionInventory.onInspectionPassed({
            productionOrderId: inspection.productionOrderId,
            userId: params.userId,
            tx,
          });
          await this.pipeline.unlockReadyStages(inspection.productionOrderId, tx);
        }
        await tx.productionOrder.update({
          where: { id: inspection.productionOrderId },
          data: { status: 'IN_PROGRESS' },
        });
        await this.pipeline.rollupProgress(inspection.productionOrderId, tx);
      } else if (isPartial || wantsFail) {
        const failNote =
          params.defectDescription ??
          merged.find((i) => String(i.result).toUpperCase() === 'FAIL')?.note ??
          'Rework required';
        if (wantsFail && !piecePlans.length) {
          await tx.qualityDefect.create({
            data: {
              inspectionId: params.id,
              description: failNote,
              severity: params.severity ?? 'HIGH',
              stageCode: params.defectCategory ?? 'OTHER',
              correctiveAction: params.reentryStageInstanceId
                ? `Rework stage ${params.reentryStageInstanceId}`
                : null,
            },
          });
        }
        for (const plan of piecePlans) {
          await tx.qualityDefect.create({
            data: {
              inspectionId: params.id,
              description: `${plan.description} (${plan.checklistCode})`,
              severity: params.severity ?? 'HIGH',
              stageCode: params.defectCategory ?? 'OTHER',
              correctiveAction: plan.stageInstanceIds.join(','),
            },
          });
          for (const stageInstanceId of plan.stageInstanceIds) {
            const existingOpen = await tx.reworkRequest.findFirst({
              where: {
                inspectionItemId: plan.inspectionItemId,
                reentryStageInstanceId: stageInstanceId,
                status: { in: ['AWAITING_STAGE', 'IN_PROGRESS'] },
              },
            });
            if (existingOpen) {
              pendingStarts.push({
                reworkId: existingOpen.id,
                stageInstanceId,
                notes: params.notes,
                wipPieceId: plan.wipPieceId,
                inspectionItemId: plan.inspectionItemId,
              });
              continue;
            }
            const reworkNumber = await this.sequences.next('RW', 'RW');
            const created = await tx.reworkRequest.create({
              data: {
                number: reworkNumber,
                productionOrderId: inspection.productionOrderId,
                inspectionId: params.id,
                inspectionItemId: plan.inspectionItemId,
                wipPieceId: plan.wipPieceId,
                description: plan.description,
                status: 'AWAITING_STAGE',
                reentryStageInstanceId: stageInstanceId,
              },
            });
            pendingStarts.push({
              reworkId: created.id,
              stageInstanceId,
              notes: params.notes,
              wipPieceId: plan.wipPieceId,
              inspectionItemId: plan.inspectionItemId,
            });
          }
        }

        if (wantsFail && !piecePlans.length) {
          const existingOpen = await tx.reworkRequest.findFirst({
            where: {
              inspectionId: params.id,
              status: { in: ['AWAITING_STAGE', 'IN_PROGRESS'] },
              inspectionItemId: null,
            },
          });
          if (!existingOpen) {
            const reworkNumber = await this.sequences.next('RW', 'RW');
            const created = await tx.reworkRequest.create({
              data: {
                number: reworkNumber,
                productionOrderId: inspection.productionOrderId,
                inspectionId: params.id,
                description: failNote,
                status: 'AWAITING_STAGE',
                reentryStageInstanceId: params.reentryStageInstanceId ?? null,
              },
            });
            if (params.reentryStageInstanceId) {
              pendingStarts.push({
                reworkId: created.id,
                stageInstanceId: params.reentryStageInstanceId,
                notes: params.notes,
              });
            }
          }
          await tx.qualityInspection.update({
            where: { id: params.id },
            data: {
              result: QualityResult.FAILED_REWORK_REQUIRED,
              notes: params.notes ?? inspection.notes,
              inspectorId: params.userId,
              inspectedAt: new Date(),
            },
          });
          await tx.productionOrder.update({
            where: { id: inspection.productionOrderId },
            data: { status: 'ON_HOLD' },
          });
          await this.productionInventory.reverseFinishedGoods({
            productionOrderId: inspection.productionOrderId,
            userId: params.userId,
            tx,
          });
        } else {
          await tx.qualityInspection.update({
            where: { id: params.id },
            data: {
              result: null,
              notes: params.notes ?? inspection.notes,
              inspectorId: params.userId,
            },
          });
          if (stage) {
            await tx.productionStageInstance.update({
              where: { id: stage.id },
              data: {
                status: 'IN_PROGRESS',
                progressPercent: progress,
                inspectionStatus: 'PARTIAL',
                actualEnd: null,
              },
            });
            for (const task of stage.tasks) {
              if (task.isRework) continue;
              await tx.productionTask.update({
                where: { id: task.id },
                data: {
                  status: 'IN_PROGRESS',
                  progressPercent: progress,
                  actualCompletion: null,
                },
              });
            }
          }
          await tx.productionOrder.update({
            where: { id: inspection.productionOrderId },
            data: { status: 'QUALITY_CHECK', currentStageCode: 'INSPECTION' },
          });
        }
      }

      await tx.auditEvent.create({
        data: {
          userId: params.userId,
          action: 'quality.submit',
          entityType: 'QualityInspection',
          entityId: params.id,
          newValues: {
            result: allPass ? QualityResult.PASSED : isPartial ? 'PARTIAL' : params.result,
            defectCategory: params.defectCategory ?? null,
            affectedQty: params.affectedQty ?? null,
            passed: classified.passed,
            failed: classified.failed,
          },
        },
      });
    });

    for (const start of pendingStarts) {
      await this.rework
        .startRework({
          reworkId: start.reworkId,
          stageInstanceId: start.stageInstanceId,
          notes: start.notes,
          userId: params.userId,
          wipPieceId: start.wipPieceId,
          inspectionItemId: start.inspectionItemId,
        })
        .catch(() => undefined);
    }

    return this.load(params.id);
  }

  load(id: string) {
    return this.prisma.qualityInspection.findUniqueOrThrow({
      where: { id },
      include: { items: true, defects: true, rework: true },
    });
  }
}

export { isQcPass, isQcFail };
