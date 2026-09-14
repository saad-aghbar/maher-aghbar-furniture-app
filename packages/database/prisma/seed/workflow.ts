import type { PrismaClient } from '@prisma/client';

export const STANDARD_FURNITURE_WORKFLOW_CODE = 'STANDARD_FURNITURE';

/** Canonical factory stage library — leftover codes (e.g. CNC) must not join this graph. */
export const STANDARD_FURNITURE_STAGE_CODES = [
  'MATERIAL_PREP',
  'CARPENTRY',
  'PAINTING',
  'FOAM',
  'UPHOLSTERY',
  'ASSEMBLY',
  'INSPECTION',
  'PACKAGING',
  'DELIVERY',
] as const;

/** Hebrew labels for the stage library. Codes stay Latin. */
export const STAGE_LIBRARY_NAME_HE: Record<string, string> = {
  MATERIAL_PREP: 'הכנת חומרים',
  CARPENTRY: 'נגרות',
  PAINTING: 'צביעה',
  FOAM: 'הכנת ספוג',
  UPHOLSTERY: 'ריפוד',
  ASSEMBLY: 'הרכבה',
  INSPECTION: 'בדיקת איכות',
  PACKAGING: 'אריזה',
  DELIVERY: 'אספקה',
  DISMANTLE_RECOVER: 'פירוק ושחזור',
  PAINTING_2: 'צביעה',
  PAINTING_3: 'צביעה',
};

export const RETURN_RECOVERY_WORKFLOW_CODE = 'RETURN_RECOVERY';
export const RETURN_REPAIR_WORKFLOW_CODE = 'RETURN_REPAIR';

const RETURN_REPAIR_STAGE_CODES = ['CARPENTRY', 'INSPECTION', 'PACKAGING', 'DELIVERY'] as const;

const FOAM_STAGE = {
  code: 'FOAM',
  nameAr: 'تجهيز الإسفنج',
  nameEn: 'Foam preparation',
  nameHe: 'הכנת ספוג',
  sortOrder: 4,
  dependsOnCodes: ['CARPENTRY'],
  responsibleDepartment: 'UPHOL',
};

/**
 * Ensures the FOAM stage exists in the stage library (parallel to painting after carpentry).
 */
export async function ensureFoamStageDefinition(prisma: PrismaClient): Promise<void> {
  await prisma.productionStageDefinition.upsert({
    where: { code: FOAM_STAGE.code },
    update: {
      nameAr: FOAM_STAGE.nameAr,
      nameEn: FOAM_STAGE.nameEn,
      nameHe: FOAM_STAGE.nameHe,
      sortOrder: FOAM_STAGE.sortOrder,
      dependsOnCodes: FOAM_STAGE.dependsOnCodes,
      responsibleDepartment: FOAM_STAGE.responsibleDepartment,
      isActive: true,
    },
    create: {
      ...FOAM_STAGE,
      requiresPhotos: true,
    },
  });

  // Keep upholstery merge deps aligned with foam + painting when FOAM is present.
  const upholstery = await prisma.productionStageDefinition.findUnique({
    where: { code: 'UPHOLSTERY' },
  });
  if (upholstery) {
    const deps = new Set([...(upholstery.dependsOnCodes ?? []), 'FOAM', 'PAINTING']);
    deps.delete('CARPENTRY');
    await prisma.productionStageDefinition.update({
      where: { code: 'UPHOLSTERY' },
      data: {
        sortOrder: Math.max(upholstery.sortOrder, 5),
        dependsOnCodes: [...deps],
      },
    });
  }
}

/**
 * Creates or refreshes the STANDARD_FURNITURE workflow (v1 PUBLISHED, ACTIVE).
 * Nodes mirror all active stage definitions; edges come from dependsOnCodes.
 */
export async function seedStandardFurnitureWorkflow(prisma: PrismaClient): Promise<void> {
  const workflow = await prisma.productionWorkflow.upsert({
    where: { code: STANDARD_FURNITURE_WORKFLOW_CODE },
    update: {
      nameAr: 'سير إنتاج الأثاث القياسي',
      nameEn: 'Standard furniture workflow',
      nameHe: 'תהליך ריהוט סטנדרטי',
      descriptionAr: 'مسار الإنتاج الافتراضي — من تجهيز المواد إلى التسليم.',
      descriptionEn: 'Default production path for catalog products — material prep through delivery.',
      descriptionHe: 'מסלול ייצור ברירת מחדל למוצרי קטלוג — מהכנת חומרים ועד אספקה.',
      status: 'ACTIVE',
      archivedAt: null,
    },
    create: {
      code: STANDARD_FURNITURE_WORKFLOW_CODE,
      nameAr: 'سير إنتاج الأثاث القياسي',
      nameEn: 'Standard furniture workflow',
      nameHe: 'תהליך ריהוט סטנדרטי',
      descriptionAr: 'مسار الإنتاج الافتراضي — من تجهيز المواد إلى التسليم.',
      descriptionEn: 'Default production path for catalog products — material prep through delivery.',
      descriptionHe: 'מסלול ייצור ברירת מחדל למוצרי קטלוג — מהכנת חומרים ועד אספקה.',
      status: 'ACTIVE',
    },
  });

  let version = await prisma.productionWorkflowVersion.findUnique({
    where: {
      workflowId_versionNumber: { workflowId: workflow.id, versionNumber: 1 },
    },
  });

  if (!version) {
    version = await prisma.productionWorkflowVersion.create({
      data: {
        workflowId: workflow.id,
        versionNumber: 1,
        status: 'PUBLISHED',
        name: 'Standard furniture v1',
        description: 'Initial published graph from active stage library.',
        changelog: 'Seed: all active stages with dependsOnCodes edges.',
        publishedAt: new Date(),
      },
    });
  } else if (version.status !== 'PUBLISHED') {
    version = await prisma.productionWorkflowVersion.update({
      where: { id: version.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: version.publishedAt ?? new Date(),
      },
    });
  }

  const existingNodeCount = await prisma.productionWorkflowNode.count({
    where: { workflowVersionId: version.id },
  });

  if (existingNodeCount === 0) {
    const stageDefs = await prisma.productionStageDefinition.findMany({
      where: {
        isActive: true,
        code: { in: [...STANDARD_FURNITURE_STAGE_CODES] },
      },
      orderBy: { sortOrder: 'asc' },
    });

    const codeToNodeId = new Map<string, string>();

    for (const stage of stageDefs) {
      const node = await prisma.productionWorkflowNode.create({
        data: {
          workflowVersionId: version.id,
          stageDefinitionId: stage.id,
          nodeKey: stage.code,
          sortOrder: stage.sortOrder,
          isRequiredByDefault: true,
          canBeSkipped: false,
          defaultEstimatedMinutes: stage.estimatedHours
            ? Math.round(Number(stage.estimatedHours) * 60)
            : null,
          requiresInspectionOverride: stage.requiresInspection ? true : null,
          requiresPhotosOverride: stage.requiresPhotos ? true : null,
        },
      });
      codeToNodeId.set(stage.code, node.id);
    }

    const stageByCode = new Map(stageDefs.map((s) => [s.code, s]));
    const edgeKeys = new Set<string>();

    for (const stage of stageDefs) {
      const toNodeId = codeToNodeId.get(stage.code);
      if (!toNodeId) continue;

      for (const depCode of stage.dependsOnCodes ?? []) {
        if (!stageByCode.has(depCode)) continue;
        const fromNodeId = codeToNodeId.get(depCode);
        if (!fromNodeId || fromNodeId === toNodeId) continue;

        const key = `${fromNodeId}->${toNodeId}`;
        if (edgeKeys.has(key)) continue;
        edgeKeys.add(key);

        await prisma.productionWorkflowEdge.create({
          data: {
            workflowVersionId: version.id,
            fromNodeId,
            toNodeId,
            dependencyType: 'HARD',
          },
        });
      }
    }
  }

  await prisma.productionWorkflow.update({
    where: { id: workflow.id },
    data: { activeVersionId: version.id, status: 'ACTIVE' },
  });
}

/**
 * Single-stage return workflow for dismantle & recover. Shape (DISMANTLE_RECOVER
 * on the graph) drops the finishing trio — scope stays RETURN.
 */
export async function seedReturnRecoveryWorkflow(prisma: PrismaClient): Promise<void> {
  const stage = await prisma.productionStageDefinition.upsert({
    where: { code: 'DISMANTLE_RECOVER' },
    update: {
      nameAr: 'تفكيك واسترداد',
      nameEn: 'Dismantle & recover',
      nameHe: STAGE_LIBRARY_NAME_HE.DISMANTLE_RECOVER,
      isActive: true,
      executionKind: 'PRODUCTION',
      responsibleDepartment: 'WH',
    },
    create: {
      code: 'DISMANTLE_RECOVER',
      nameAr: 'تفكيك واسترداد',
      nameEn: 'Dismantle & recover',
      nameHe: STAGE_LIBRARY_NAME_HE.DISMANTLE_RECOVER,
      sortOrder: 90,
      dependsOnCodes: [],
      responsibleDepartment: 'WH',
      executionKind: 'PRODUCTION',
      requiresPhotos: true,
    },
  });

  const workflow = await prisma.productionWorkflow.upsert({
    where: { code: RETURN_RECOVERY_WORKFLOW_CODE },
    update: {
      nameAr: 'تفكيك واسترداد المرتجع',
      nameEn: 'Return dismantle & recover',
      nameHe: 'פירוק ושחזור החזרה',
      status: 'ACTIVE',
      scope: 'RETURN',
      archivedAt: null,
    },
    create: {
      code: RETURN_RECOVERY_WORKFLOW_CODE,
      nameAr: 'تفكيك واسترداد المرتجع',
      nameEn: 'Return dismantle & recover',
      nameHe: 'פירוק ושחזור החזרה',
      status: 'ACTIVE',
      scope: 'RETURN',
    },
  });

  let version = await prisma.productionWorkflowVersion.findUnique({
    where: { workflowId_versionNumber: { workflowId: workflow.id, versionNumber: 1 } },
  });
  if (!version) {
    version = await prisma.productionWorkflowVersion.create({
      data: {
        workflowId: workflow.id,
        versionNumber: 1,
        status: 'PUBLISHED',
        name: 'Return recovery v1',
        description: 'Single dismantle & recover stage.',
        publishedAt: new Date(),
      },
    });
  } else if (version.status !== 'PUBLISHED') {
    version = await prisma.productionWorkflowVersion.update({
      where: { id: version.id },
      data: { status: 'PUBLISHED', publishedAt: version.publishedAt ?? new Date() },
    });
  }

  const existingNodeCount = await prisma.productionWorkflowNode.count({
    where: { workflowVersionId: version.id },
  });
  if (existingNodeCount === 0) {
    await prisma.productionWorkflowNode.create({
      data: {
        workflowVersionId: version.id,
        stageDefinitionId: stage.id,
        nodeKey: 'DISMANTLE_RECOVER',
        sortOrder: 1,
        isRequiredByDefault: true,
        canBeSkipped: false,
        defaultEstimatedMinutes: 60,
      },
    });
  }

  await prisma.productionWorkflow.update({
    where: { id: workflow.id },
    data: { activeVersionId: version.id, status: 'ACTIVE', scope: 'RETURN' },
  });
}

/**
 * Repair-shaped return workflow: no forced opening stage, finishing trio last.
 */
export async function seedReturnRepairWorkflow(prisma: PrismaClient): Promise<void> {
  const stages = await prisma.productionStageDefinition.findMany({
    where: { code: { in: [...RETURN_REPAIR_STAGE_CODES] } },
  });
  const stageByCode = new Map(stages.map((s) => [s.code, s]));
  for (const code of RETURN_REPAIR_STAGE_CODES) {
    if (!stageByCode.has(code)) {
      throw new Error(`RETURN_REPAIR seed missing stage ${code}`);
    }
  }

  const workflow = await prisma.productionWorkflow.upsert({
    where: { code: RETURN_REPAIR_WORKFLOW_CODE },
    update: {
      nameAr: 'إصلاح المرتجع',
      nameEn: 'Return repair',
      nameHe: 'תיקון החזרה',
      descriptionAr: 'مسار إصلاح المرتجع — نجارة ثم فحص وتعبئة وتسليم.',
      descriptionEn: 'Return repair path — carpentry through inspection, packaging, and delivery.',
      descriptionHe: 'מסלול תיקון החזרה — נגרות ואחריו בדיקה, אריזה ואספקה.',
      status: 'ACTIVE',
      scope: 'RETURN',
      archivedAt: null,
    },
    create: {
      code: RETURN_REPAIR_WORKFLOW_CODE,
      nameAr: 'إصلاح المرتجع',
      nameEn: 'Return repair',
      nameHe: 'תיקון החזרה',
      descriptionAr: 'مسار إصلاح المرتجع — نجارة ثم فحص وتعبئة وتسليم.',
      descriptionEn: 'Return repair path — carpentry through inspection, packaging, and delivery.',
      descriptionHe: 'מסלול תיקון החזרה — נגרות ואחריו בדיקה, אריזה ואספקה.',
      status: 'ACTIVE',
      scope: 'RETURN',
    },
  });

  let version = await prisma.productionWorkflowVersion.findUnique({
    where: { workflowId_versionNumber: { workflowId: workflow.id, versionNumber: 1 } },
  });
  if (!version) {
    version = await prisma.productionWorkflowVersion.create({
      data: {
        workflowId: workflow.id,
        versionNumber: 1,
        status: 'PUBLISHED',
        name: 'Return repair v1',
        description: 'Carpentry plus the finishing trio.',
        publishedAt: new Date(),
      },
    });
  } else if (version.status !== 'PUBLISHED') {
    version = await prisma.productionWorkflowVersion.update({
      where: { id: version.id },
      data: { status: 'PUBLISHED', publishedAt: version.publishedAt ?? new Date() },
    });
  }

  const existingNodeCount = await prisma.productionWorkflowNode.count({
    where: { workflowVersionId: version.id },
  });
  if (existingNodeCount === 0) {
    const codeToNodeId = new Map<string, string>();
    for (const [index, code] of RETURN_REPAIR_STAGE_CODES.entries()) {
      const stage = stageByCode.get(code)!;
      const node = await prisma.productionWorkflowNode.create({
        data: {
          workflowVersionId: version.id,
          stageDefinitionId: stage.id,
          nodeKey: code,
          sortOrder: index + 1,
          isRequiredByDefault: true,
          canBeSkipped: false,
          defaultEstimatedMinutes: stage.estimatedHours
            ? Math.round(Number(stage.estimatedHours) * 60)
            : code === 'CARPENTRY'
              ? 120
              : 45,
        },
      });
      codeToNodeId.set(code, node.id);
    }
    for (let i = 0; i < RETURN_REPAIR_STAGE_CODES.length - 1; i += 1) {
      const fromNodeId = codeToNodeId.get(RETURN_REPAIR_STAGE_CODES[i]!);
      const toNodeId = codeToNodeId.get(RETURN_REPAIR_STAGE_CODES[i + 1]!);
      if (!fromNodeId || !toNodeId) continue;
      await prisma.productionWorkflowEdge.create({
        data: {
          workflowVersionId: version.id,
          fromNodeId,
          toNodeId,
          dependencyType: 'HARD',
        },
      });
    }
  }

  await prisma.productionWorkflow.update({
    where: { id: workflow.id },
    data: { activeVersionId: version.id, status: 'ACTIVE', scope: 'RETURN' },
  });
}

/**
 * Attach STANDARD_FURNITURE to active catalog products missing a workflow configuration.
 */
export async function attachProductWorkflowConfigurations(prisma: PrismaClient): Promise<number> {
  const workflow = await prisma.productionWorkflow.findUnique({
    where: { code: STANDARD_FURNITURE_WORKFLOW_CODE },
  });
  if (!workflow) return 0;

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      archivedAt: null,
      workflowConfiguration: null,
    },
    select: { id: true },
  });

  if (!products.length) return 0;

  await prisma.productWorkflowConfiguration.createMany({
    data: products.map((p) => ({
      productId: p.id,
      workflowId: workflow.id,
    })),
    skipDuplicates: true,
  });

  return products.length;
}
