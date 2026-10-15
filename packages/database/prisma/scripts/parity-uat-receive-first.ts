/**
 * Additive local fixture only. Does not reset data, renumber orders, or send messages.
 * Marker: PARITY-UAT-20261012-receive-first
 */
import { prisma } from '../../src/index';

const MARKER = 'PARITY-UAT-20261012-receive-first';

async function producingPredecessorIds(consumerId: string, snapshotId: string): Promise<string[]> {
  const [edges, nodes] = await Promise.all([
    prisma.productionOrderWorkflowSnapshotEdge.findMany({
      where: { snapshotId },
      select: { fromSnapshotNodeId: true, toSnapshotNodeId: true },
    }),
    prisma.productionOrderWorkflowSnapshotNode.findMany({
      where: { snapshotId },
      select: { id: true, stageCode: true, executionKind: true, inventoryTracking: true, isSkipped: true },
    }),
  ]);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    const list = incoming.get(edge.toSnapshotNodeId) ?? [];
    list.push(edge.fromSnapshotNodeId);
    incoming.set(edge.toSnapshotNodeId, list);
  }
  const passthrough = (id: string) => {
    const node = byId.get(id);
    if (!node) return false;
    const code = node.stageCode.toUpperCase();
    const kind = String(node.executionKind ?? '').toUpperCase();
    return kind === 'QUALITY' || code === 'INSPECTION' || code === 'QC' || code === 'QUALITY';
  };
  const out: string[] = [];
  const seen = new Set<string>();
  const queue = [...(incoming.get(consumerId) ?? [])];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    if (passthrough(id)) {
      queue.push(...(incoming.get(id) ?? []));
      continue;
    }
    const node = byId.get(id);
    if (node && !node.isSkipped && node.inventoryTracking === 'PRODUCES_SEMI_FINISHED') out.push(id);
  }
  return out;
}

async function createIsolatedFixture(worker: { id: string; username: string }) {
  const customer = await prisma.customer.findFirst({
    where: { code: 'CUS-0101' },
    select: { id: true, code: true },
  });
  if (!customer) throw new Error('Customer CUS-0101 missing');
  const stages = await prisma.productionStageDefinition.findMany({
    where: { code: { in: ['CARPENTRY', 'UPHOLSTERY', 'FOAM', 'PAINTING'] } },
    select: { id: true, code: true, nameEn: true, nameAr: true, nameHe: true },
  });
  const producerStage = stages.find((stage) => stage.code === 'CARPENTRY') ?? stages[0];
  const consumerStage = stages.find((stage) => stage.code === 'UPHOLSTERY' || stage.code === 'FOAM') ?? stages[1];
  if (!producerStage || !consumerStage || producerStage.id === consumerStage.id) {
    throw new Error('Need two stage definitions to build the receive-first fixture.');
  }

  const salesOrder = await prisma.salesOrder.create({
    data: {
      number: 'SO-PARITY-UAT-20261012',
      customerId: customer.id,
      status: 'IN_PRODUCTION',
      externalOrderNumber: MARKER,
      notes: MARKER,
      projectName: 'Parity receive-first fixture',
      lines: {
        create: {
          description: 'Parity receive-first chair',
          quantity: 1,
          unitPrice: 0,
          lineTotal: 0,
          itemLetter: 'A',
          productionRequired: true,
        },
      },
    },
    select: { id: true, number: true, externalOrderNumber: true, lines: { select: { id: true } } },
  });
  const line = salesOrder.lines[0]!;
  const productionOrder = await prisma.productionOrder.create({
    data: {
      number: 'SO-PARITY-UAT-20261012.A',
      salesOrderId: salesOrder.id,
      salesOrderLineId: line.id,
      customerId: customer.id,
      productDescription: 'Parity receive-first chair',
      quantity: 1,
      status: 'IN_PROGRESS',
      releasedToFactoryAt: new Date('2026-10-12T09:00:00.000Z'),
      notes: MARKER,
    },
    select: { id: true, number: true },
  });
  const producerInstance = await prisma.productionStageInstance.create({
    data: {
      productionOrderId: productionOrder.id,
      stageDefinitionId: producerStage.id,
      status: 'COMPLETED',
    },
    select: { id: true },
  });
  const consumerInstance = await prisma.productionStageInstance.create({
    data: {
      productionOrderId: productionOrder.id,
      stageDefinitionId: consumerStage.id,
      status: 'READY',
    },
    select: { id: true },
  });
  const snapshot = await prisma.productionOrderWorkflowSnapshot.create({
    data: { productionOrderId: productionOrder.id },
    select: { id: true },
  });
  const producerNode = await prisma.productionOrderWorkflowSnapshotNode.create({
    data: {
      snapshotId: snapshot.id,
      stageDefinitionId: producerStage.id,
      stageInstanceId: producerInstance.id,
      nodeKey: 'carpentry',
      stageCode: producerStage.code,
      nameEnSnapshot: producerStage.nameEn,
      nameArSnapshot: producerStage.nameAr || producerStage.nameEn,
      nameHeSnapshot: producerStage.nameHe,
      inventoryTracking: 'PRODUCES_SEMI_FINISHED',
      expectedPieceCount: 1,
      sortOrder: 1,
    },
    select: { id: true },
  });
  const consumerNode = await prisma.productionOrderWorkflowSnapshotNode.create({
    data: {
      snapshotId: snapshot.id,
      stageDefinitionId: consumerStage.id,
      stageInstanceId: consumerInstance.id,
      nodeKey: 'upholstery',
      stageCode: consumerStage.code,
      nameEnSnapshot: consumerStage.nameEn,
      nameArSnapshot: consumerStage.nameAr || consumerStage.nameEn,
      nameHeSnapshot: consumerStage.nameHe,
      consumesSemiFinished: true,
      sortOrder: 2,
    },
    select: { id: true },
  });
  await prisma.productionOrderWorkflowSnapshotEdge.create({
    data: {
      snapshotId: snapshot.id,
      fromSnapshotNodeId: producerNode.id,
      toSnapshotNodeId: consumerNode.id,
    },
  });
  const kit = await prisma.wipKit.create({
    data: {
      productionOrderId: productionOrder.id,
      stageInstanceId: producerInstance.id,
      snapshotNodeId: producerNode.id,
      status: 'READY',
      expectedPieceCount: 1,
      qrCode: 'WIP-PARITY-UAT-20261012',
      nextSnapshotNodeIds: [consumerNode.id],
    },
    select: { id: true, qrCode: true },
  });
  const task = await prisma.productionTask.create({
    data: {
      number: 'PT-PARITY-UAT-20261012',
      productionOrderId: productionOrder.id,
      stageDefinitionId: consumerStage.id,
      stageInstanceId: consumerInstance.id,
      name: consumerStage.nameEn,
      status: 'READY',
      assignedEmployeeId: worker.id,
      notes: MARKER,
      description: MARKER,
    },
    select: { id: true, number: true, status: true },
  });
  console.log(
    JSON.stringify(
      {
        already: false,
        isolated: true,
        marker: MARKER,
        worker,
        salesOrder,
        productionOrder,
        task,
        kit,
        consumerStage: consumerStage.code,
        producerStage: producerStage.code,
      },
      null,
      2,
    ),
  );
}

async function main() {
  const existing = await prisma.productionTask.findFirst({
    where: { notes: { contains: MARKER } },
    select: {
      id: true,
      number: true,
      status: true,
      assignedEmployeeId: true,
      productionOrderId: true,
      stageInstanceId: true,
      notes: true,
      productionOrder: {
        select: {
          id: true,
          number: true,
          salesOrderId: true,
          salesOrder: { select: { id: true, number: true, notes: true, externalOrderNumber: true } },
        },
      },
      assignedEmployee: { select: { id: true, username: true } },
    },
  });
  if (existing) {
    console.log(JSON.stringify({ already: true, task: existing }, null, 2));
    return;
  }

  const worker = await prisma.user.findUnique({
    where: { username: 'carpenter' },
    select: { id: true, username: true },
  });
  if (!worker) throw new Error('carpenter user missing');

  const consumers = await prisma.productionOrderWorkflowSnapshotNode.findMany({
    where: {
      consumesSemiFinished: true,
      isSkipped: false,
      stageInstanceId: { not: null },
    },
    select: {
      id: true,
      snapshotId: true,
      stageCode: true,
      nameEnSnapshot: true,
      stageInstanceId: true,
      incomingEdges: { select: { fromSnapshotNodeId: true } },
    },
  });

  const reasons = { consumers: consumers.length, noStage: 0, hasTasks: 0, cancelled: 0, noEdges: 0, noProducer: 0, noReadyKit: 0 };
  let chosen: (typeof consumers)[number] | null = null;
  let stage: {
    id: string;
    status: string;
    stageDefinitionId: string;
    productionOrder: {
      id: string;
      number: string;
      archivedAt: Date | null;
      status: string;
      salesOrder: { id: string; number: string; notes: string | null; externalOrderNumber: string | null } | null;
    };
  } | null = null;
  let producerKit: { id: string; qrCode: string; status: string } | null = null;

  for (const consumer of consumers) {
    if (!consumer.stageInstanceId) { reasons.noStage += 1; continue; }
    const stageRow = await prisma.productionStageInstance.findUnique({
      where: { id: consumer.stageInstanceId },
      select: {
        id: true,
        status: true,
        stageDefinitionId: true,
        tasks: { select: { id: true, status: true } },
        productionOrder: {
          select: {
            id: true,
            number: true,
            archivedAt: true,
            status: true,
            salesOrder: { select: { id: true, number: true, notes: true, externalOrderNumber: true } },
          },
        },
      },
    });
    if (!stageRow) { reasons.noStage += 1; continue; }
    const po = stageRow.productionOrder;
    if (po.archivedAt || po.status === 'CANCELLED') { reasons.cancelled += 1; continue; }
    const fromIds = await producingPredecessorIds(consumer.id, consumer.snapshotId);
    if (!fromIds.length) { reasons.noEdges += 1; continue; }
    const producers = await prisma.productionOrderWorkflowSnapshotNode.findMany({
      where: {
        id: { in: fromIds },
        isSkipped: false,
        inventoryTracking: 'PRODUCES_SEMI_FINISHED',
        stageInstanceId: { not: null },
      },
      select: { id: true, stageInstanceId: true },
    });
    if (!producers.length) { reasons.noProducer += 1; continue; }
    let foundKit = false;
    for (const producer of producers) {
      const kit = await prisma.wipKit.findUnique({
        where: { stageInstanceId: producer.stageInstanceId! },
        select: { id: true, qrCode: true, status: true, productionOrderId: true },
      });
      if (!kit || kit.status !== 'READY' || kit.productionOrderId !== po.id) continue;
      foundKit = true;
      chosen = consumer;
      stage = stageRow;
      producerKit = kit;
      break;
    }
    if (chosen) break;
    if (!foundKit) reasons.noReadyKit += 1;
  }

  if (!chosen || !stage || !producerKit) {
    await createIsolatedFixture(worker);
    return;
  }

  const po = stage.productionOrder;
  const task = await prisma.productionTask.create({
    data: {
      number: 'PT-PARITY-UAT-20261012',
      productionOrderId: po.id,
      stageDefinitionId: stage.stageDefinitionId,
      stageInstanceId: stage.id,
      name: chosen.nameEnSnapshot || chosen.stageCode,
      status: 'READY',
      assignedEmployeeId: worker.id,
      notes: MARKER,
      description: MARKER,
    },
    select: { id: true, number: true, status: true },
  });

  const noteLine = MARKER;
  const prior = po.salesOrder?.notes?.trim();
  if (po.salesOrder && !prior?.includes(MARKER)) {
    await prisma.salesOrder.update({
      where: { id: po.salesOrder.id },
      data: {
        notes: prior ? `${prior}\n${noteLine}` : noteLine,
        ...(po.salesOrder.externalOrderNumber
          ? {}
          : { externalOrderNumber: MARKER }),
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        already: false,
        marker: MARKER,
        worker,
        task,
        stageInstanceId: stage.id,
        stageCode: chosen.stageCode,
        snapshotNodeId: chosen.id,
        productionOrder: { id: po.id, number: po.number },
        salesOrder: po.salesOrder,
        readyKit: producerKit,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
