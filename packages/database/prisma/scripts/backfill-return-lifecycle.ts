import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function derive(row: {
  approvalStatus: string | null;
  physicalStatus: string | null;
  inventoryFate: string | null;
}) {
  const approval = String(row.approvalStatus ?? 'PENDING').trim().toUpperCase();
  const physical = String(row.physicalStatus ?? 'NONE').trim().toUpperCase();
  const fate = String(row.inventoryFate ?? 'PENDING').trim().toUpperCase();
  if (approval === 'REJECTED') return 'REJECTED';
  if (physical === 'RESOLVED') return 'COMPLETED';
  if (fate === 'RETURN_TO_STOCK') return 'RETURNED_TO_STOCK';
  if (fate === 'DAMAGED' || fate === 'SCRAP') return 'SCRAPPED';
  if (fate === 'REWORK') return 'REWORKING';
  if (physical === 'INSPECTING') return 'INSPECTING';
  if (physical === 'RETURNED') return 'RECEIVED';
  if (physical === 'WAITING_RETURN' || approval === 'APPROVED') return 'APPROVED';
  if (approval === 'NEED_INFO') return 'NEED_INFO';
  return 'REQUESTED';
}

async function main() {
  const rows = await prisma.returnRequest.findMany({
    select: {
      id: true,
      lifecycleState: true,
      approvalStatus: true,
      physicalStatus: true,
      inventoryFate: true,
    },
  });
  let updated = 0;
  for (const row of rows) {
    const next = derive(row);
    if (row.lifecycleState === next) continue;
    await prisma.returnRequest.update({
      where: { id: row.id },
      data: { lifecycleState: next },
    });
    updated += 1;
  }
  const orphans = await prisma.productionOrder.findMany({
    where: {
      returnRequestId: null,
      notes: { contains: 'returnId=' },
    },
    select: { id: true, notes: true, originType: true },
  });
  let linked = 0;
  for (const po of orphans) {
    const match = String(po.notes ?? '').match(/returnId=([0-9a-fA-F-]{36})/);
    if (!match?.[1]) continue;
    const ret = await prisma.returnRequest.findUnique({
      where: { id: match[1] },
      select: { id: true },
    });
    if (!ret) continue;
    await prisma.productionOrder.update({
      where: { id: po.id },
      data: {
        returnRequestId: ret.id,
        originType: po.originType === 'SALES_ORDER' ? 'RETURN_WORK' : po.originType,
      },
    });
    linked += 1;
  }
  console.log(JSON.stringify({ scanned: rows.length, updated, linked }));
  await prisma.$disconnect();
}

void main();
