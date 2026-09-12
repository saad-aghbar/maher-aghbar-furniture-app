/**
 * Seed ProductProductionProfile + ProductStageEstimate for catalog products
 * so scheduling uses real per-stage times (not stage-def fallbacks).
 */
import type { PrismaClient, QuantityScalingMode } from '@prisma/client';

export type EstimateTarget = {
  id: string;
  categoryCode: string;
  variantId?: string | null;
};

const CATEGORY_FACTOR: Record<string, number> = {
  SOFA: 1.35,
  CHAIR: 0.7,
  BED: 1.2,
  TABLE: 1.0,
  CUSTOM: 1.55,
};

/** Baseline minutes for qty=1 before category factor. */
const STAGE_BASE: Record<
  string,
  {
    mode: QuantityScalingMode;
    setupMinutes: number;
    minutesPerUnit: number;
    fixedMinutes: number;
  }
> = {
  MATERIAL_PREP: { mode: 'SETUP_PLUS_LINEAR', setupMinutes: 15, minutesPerUnit: 25, fixedMinutes: 0 },
  CARPENTRY: { mode: 'SETUP_PLUS_LINEAR', setupMinutes: 30, minutesPerUnit: 90, fixedMinutes: 0 },
  PAINTING: { mode: 'SETUP_PLUS_LINEAR', setupMinutes: 20, minutesPerUnit: 55, fixedMinutes: 0 },
  FOAM: { mode: 'SETUP_PLUS_LINEAR', setupMinutes: 15, minutesPerUnit: 40, fixedMinutes: 0 },
  UPHOLSTERY: { mode: 'SETUP_PLUS_LINEAR', setupMinutes: 25, minutesPerUnit: 85, fixedMinutes: 0 },
  ASSEMBLY: { mode: 'SETUP_PLUS_LINEAR', setupMinutes: 15, minutesPerUnit: 45, fixedMinutes: 0 },
  INSPECTION: { mode: 'FIXED', setupMinutes: 0, minutesPerUnit: 0, fixedMinutes: 0 },
  PACKAGING: { mode: 'SETUP_PLUS_LINEAR', setupMinutes: 10, minutesPerUnit: 20, fixedMinutes: 0 },
  DELIVERY: { mode: 'FIXED', setupMinutes: 0, minutesPerUnit: 0, fixedMinutes: 60 },
};

function scale(n: number, factor: number): number {
  return Math.max(5, Math.round(n * factor));
}

function qty1Minutes(row: {
  mode: QuantityScalingMode;
  setupMinutes: number;
  minutesPerUnit: number;
  fixedMinutes: number;
}): number {
  if (row.mode === 'FIXED') return row.fixedMinutes;
  if (row.mode === 'LINEAR') return row.minutesPerUnit;
  return row.setupMinutes + row.minutesPerUnit;
}

export async function seedProductEstimates(
  prisma: PrismaClient,
  products: EstimateTarget[],
): Promise<{ profiles: number; estimates: number }> {
  const stages = await prisma.productionStageDefinition.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  if (!stages.length || !products.length) return { profiles: 0, estimates: 0 };

  let profiles = 0;
  let estimates = 0;

  for (const product of products) {
    const factor = CATEGORY_FACTOR[product.categoryCode] ?? 1;
    let total = 0;

    for (const stage of stages) {
      const base = STAGE_BASE[stage.code] ?? {
        mode: 'SETUP_PLUS_LINEAR' as const,
        setupMinutes: 15,
        minutesPerUnit: 30,
        fixedMinutes: 0,
      };
      const setupMinutes = scale(base.setupMinutes, factor);
      const minutesPerUnit = scale(base.minutesPerUnit, factor);
      const fixedMinutes = scale(base.fixedMinutes, factor);
      total += qty1Minutes({
        mode: base.mode,
        setupMinutes,
        minutesPerUnit,
        fixedMinutes,
      });

      const existingEstimate = await prisma.productStageEstimate.findFirst({
        where: {
          productId: product.id,
          stageDefinitionId: stage.id,
          variantId: product.variantId ?? null,
        },
      });
      if (existingEstimate) {
        await prisma.productStageEstimate.update({
          where: { id: existingEstimate.id },
          data: {
            quantityScalingMode: base.mode,
            setupMinutes,
            minutesPerUnit,
            fixedMinutes,
            isRequired: true,
          },
        });
      } else {
        await prisma.productStageEstimate.create({
          data: {
            productId: product.id,
            variantId: product.variantId ?? null,
            stageDefinitionId: stage.id,
            quantityScalingMode: base.mode,
            setupMinutes,
            minutesPerUnit,
            fixedMinutes,
            workerCountRequired: 1,
            isRequired: true,
          },
        });
      }
      estimates += 1;
    }

    const existingProfile = await prisma.productProductionProfile.findFirst({
      where: { productId: product.id, variantId: product.variantId ?? null },
    });
    if (existingProfile) {
      await prisma.productProductionProfile.update({
        where: { id: existingProfile.id },
        data: {
          totalStandardMinutes: total,
          complexityFactor: factor,
          bufferPercent: 10,
          isSchedulingEnabled: true,
        },
      });
    } else {
      await prisma.productProductionProfile.create({
        data: {
          productId: product.id,
          variantId: product.variantId ?? null,
          totalStandardMinutes: total,
          setupMinutes: 0,
          complexityFactor: factor,
          defaultBatchSize: 1,
          bufferPercent: 10,
          isSchedulingEnabled: true,
          minimumLeadTimeDays: product.categoryCode === 'CUSTOM' ? 21 : 14,
        },
      });
    }
    profiles += 1;
  }

  return { profiles, estimates };
}
