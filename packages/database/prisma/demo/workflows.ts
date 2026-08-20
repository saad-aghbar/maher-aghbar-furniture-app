import type { PrismaClient } from '@prisma/client';
import {
  STANDARD_FURNITURE_STAGE_CODES,
  STANDARD_FURNITURE_WORKFLOW_CODE,
} from '../seed/workflow';

export const WF_PAINTED_WOOD = 'PAINTED_WOOD';
export const WF_ARMCHAIR = 'ARMCHAIR_PATH';
export const WF_SECTIONAL = 'CUSTOM_SECTIONAL';
export const WF_OTTOMAN = 'SIMPLE_OTTOMAN';

type Graph = {
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe: string;
  descriptionEn: string;
  stages: string[];
  edges: Array<[string, string]>;
};

const GRAPHS: Graph[] = [
  {
    code: STANDARD_FURNITURE_WORKFLOW_CODE,
    nameEn: 'Standard furniture workflow',
    nameAr: 'سير إنتاج الأثاث القياسي',
    nameHe: 'תהליך ריהוט סטנדרטי',
    descriptionEn: 'Upholstered default: prep, carpentry, paint, foam, upholstery, assemble, inspect, pack, deliver.',
    stages: [...STANDARD_FURNITURE_STAGE_CODES],
    edges: [
      ['MATERIAL_PREP', 'CARPENTRY'],
      ['MATERIAL_PREP', 'PAINTING'],
      ['CARPENTRY', 'FOAM'],
      ['CARPENTRY', 'ASSEMBLY'],
      ['PAINTING', 'ASSEMBLY'],
      ['FOAM', 'UPHOLSTERY'],
      ['PAINTING', 'UPHOLSTERY'],
      ['UPHOLSTERY', 'ASSEMBLY'],
      ['ASSEMBLY', 'INSPECTION'],
      ['INSPECTION', 'PACKAGING'],
      ['PACKAGING', 'DELIVERY'],
    ],
  },
  {
    code: WF_PAINTED_WOOD,
    nameEn: 'Painted wood furniture',
    nameAr: 'أثاث خشب مطلي',
    nameHe: 'ריהוט עץ צבוע',
    descriptionEn: 'Tables and wood frames: prep, carpentry, paint, inspect, pack, deliver.',
    stages: ['MATERIAL_PREP', 'CARPENTRY', 'PAINTING', 'INSPECTION', 'PACKAGING', 'DELIVERY'],
    edges: [
      ['MATERIAL_PREP', 'CARPENTRY'],
      ['CARPENTRY', 'PAINTING'],
      ['PAINTING', 'INSPECTION'],
      ['INSPECTION', 'PACKAGING'],
      ['PACKAGING', 'DELIVERY'],
    ],
  },
  {
    code: WF_ARMCHAIR,
    nameEn: 'Armchair upholstery',
    nameAr: 'تنجيد كرسي بذراعين',
    nameHe: 'ריפוד כורסה',
    descriptionEn: 'Prep, frame, foam, upholstery, inspect, pack, deliver.',
    stages: ['MATERIAL_PREP', 'CARPENTRY', 'FOAM', 'UPHOLSTERY', 'INSPECTION', 'PACKAGING', 'DELIVERY'],
    edges: [
      ['MATERIAL_PREP', 'CARPENTRY'],
      ['CARPENTRY', 'FOAM'],
      ['FOAM', 'UPHOLSTERY'],
      ['UPHOLSTERY', 'INSPECTION'],
      ['INSPECTION', 'PACKAGING'],
      ['PACKAGING', 'DELIVERY'],
    ],
  },
  {
    code: WF_SECTIONAL,
    nameEn: 'Custom sectional (parallel foam)',
    nameAr: 'كنبة زاوية تفصيل (إسفنج موازٍ)',
    nameHe: 'ספת פינה בהתאמה (ספוג מקביל)',
    descriptionEn: 'Carpentry and foam run in parallel after material prep; upholstery waits on the frame.',
    stages: ['MATERIAL_PREP', 'CARPENTRY', 'FOAM', 'UPHOLSTERY', 'INSPECTION', 'PACKAGING', 'DELIVERY'],
    edges: [
      ['MATERIAL_PREP', 'CARPENTRY'],
      ['MATERIAL_PREP', 'FOAM'],
      ['CARPENTRY', 'UPHOLSTERY'],
      ['UPHOLSTERY', 'INSPECTION'],
      ['INSPECTION', 'PACKAGING'],
      ['FOAM', 'PACKAGING'],
      ['PACKAGING', 'DELIVERY'],
    ],
  },
  {
    code: WF_OTTOMAN,
    nameEn: 'Simple ottoman',
    nameAr: 'عثماني بسيط',
    nameHe: 'הדום פשוט',
    descriptionEn: 'Short path: prep, foam, upholstery, inspect, pack, deliver.',
    stages: ['MATERIAL_PREP', 'FOAM', 'UPHOLSTERY', 'INSPECTION', 'PACKAGING', 'DELIVERY'],
    edges: [
      ['MATERIAL_PREP', 'FOAM'],
      ['FOAM', 'UPHOLSTERY'],
      ['UPHOLSTERY', 'INSPECTION'],
      ['INSPECTION', 'PACKAGING'],
      ['PACKAGING', 'DELIVERY'],
    ],
  },
];

async function publishGraph(prisma: PrismaClient, graph: Graph) {
  const stages = await prisma.productionStageDefinition.findMany({
    where: { code: { in: graph.stages } },
  });
  const byCode = new Map(stages.map((s) => [s.code, s]));
  for (const code of graph.stages) {
    if (!byCode.has(code)) throw new Error(`Workflow ${graph.code} needs stage ${code}`);
  }

  const workflow = await prisma.productionWorkflow.upsert({
    where: { code: graph.code },
    update: {
      nameEn: graph.nameEn,
      nameAr: graph.nameAr,
      nameHe: graph.nameHe,
      descriptionEn: graph.descriptionEn,
      status: 'ACTIVE',
      archivedAt: null,
    },
    create: {
      code: graph.code,
      nameEn: graph.nameEn,
      nameAr: graph.nameAr,
      nameHe: graph.nameHe,
      descriptionEn: graph.descriptionEn,
      status: 'ACTIVE',
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
        name: `${graph.nameEn} v1`,
        changelog: 'Demo factory template.',
        publishedAt: new Date(),
      },
    });
  }

  await prisma.productionWorkflowEdge.deleteMany({ where: { workflowVersionId: version.id } });
  await prisma.productionWorkflowNode.deleteMany({ where: { workflowVersionId: version.id } });

  let sortOrder = 1;
  for (const code of graph.stages) {
    const stage = byCode.get(code)!;
    await prisma.productionWorkflowNode.create({
      data: {
        workflowVersionId: version.id,
        stageDefinitionId: stage.id,
        nodeKey: code,
        sortOrder,
        isRequiredByDefault: true,
        canBeSkipped: false,
        requiresInspectionOverride: stage.requiresInspection ? true : null,
        requiresPhotosOverride: false,
      },
    });
    sortOrder += 1;
  }
  const nodes = await prisma.productionWorkflowNode.findMany({
    where: { workflowVersionId: version.id },
    include: { stageDefinition: true },
  });
  const nodeIds = new Map(nodes.map((n) => [n.stageDefinition.code, n.id]));
  for (const [from, to] of graph.edges) {
    const fromNodeId = nodeIds.get(from);
    const toNodeId = nodeIds.get(to);
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

  await prisma.productionWorkflow.update({
    where: { id: workflow.id },
    data: { activeVersionId: version.id, status: 'ACTIVE' },
  });
}

/**
 * Demo exception: template nodes set requiresPhotosOverride=false so historical
 * task complete does not require binary TASK_PHOTO uploads.
 */
export async function disableDemoPhotoGates(prisma: PrismaClient) {
  await prisma.productionWorkflowNode.updateMany({
    data: { requiresPhotosOverride: false },
  });
}

export async function seedDemoWorkflows(prisma: PrismaClient) {
  await prisma.productionStageDefinition.updateMany({
    where: { code: { notIn: [...STANDARD_FURNITURE_STAGE_CODES] } },
    data: { isActive: false },
  });
  await prisma.workerSkill.deleteMany({
    where: { stageDefinition: { isActive: false } },
  });
  for (const graph of GRAPHS) {
    await publishGraph(prisma, graph);
  }
  await disableDemoPhotoGates(prisma);
  const count = await prisma.productionWorkflow.count({ where: { status: 'ACTIVE' } });
  console.log(`  workflows: ${count} active (incl. ${STANDARD_FURNITURE_WORKFLOW_CODE})`);
}
