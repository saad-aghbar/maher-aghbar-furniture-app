#!/usr/bin/env node
/**
 * Explode existing ReturnRequest rows into physical ReturnPiece records.
 * Maps leftover REWORK → REPAIR and SCRAP → SCRAP_RECOVERY.
 * RETURN_TO_STOCK rows become already-resolved pieces with no new decision.
 *
 * Usage: node scripts/backfill-return-pieces.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function pieceCount(row) {
  const qty = Number(row.receivedQuantity ?? row.quantity ?? 1);
  return Math.max(1, Math.round(Number.isFinite(qty) ? qty : 1));
}

function decisionFromLegacy(row) {
  const fate = String(row.inventoryFate ?? '').toUpperCase();
  const resolution = String(row.resolution ?? '').toUpperCase();
  if (fate === 'RETURN_TO_STOCK') return { decision: null, state: 'RECOVERED', outbound: false };
  if (fate === 'SCRAP' || fate === 'DAMAGED') {
    return { decision: 'SCRAP_RECOVERY', state: 'RECOVERED', outbound: false };
  }
  if (resolution === 'REPLACEMENT' || fate === 'REWORK' && resolution === 'REPLACEMENT') {
    return { decision: 'REPLACEMENT', state: row.lifecycleState === 'COMPLETED' ? 'RETURNED' : 'IN_PROGRESS', outbound: true };
  }
  if (resolution === 'REPAIR' || fate === 'REWORK') {
    return { decision: 'REPAIR', state: row.lifecycleState === 'COMPLETED' ? 'RETURNED' : 'IN_PROGRESS', outbound: true };
  }
  if (['RECEIVED', 'INSPECTING', 'REWORKING', 'REPLACING', 'READY_TO_RETURN', 'RETURNING', 'COMPLETED'].includes(row.lifecycleState)) {
    return { decision: null, state: 'RECEIVED', outbound: true };
  }
  return { decision: null, state: 'AWAITING_RECEIPT', outbound: true };
}

async function main() {
  const returns = await prisma.returnRequest.findMany({
    include: { pieces: { select: { id: true } } },
    orderBy: { createdAt: 'asc' },
  });
  let created = 0;
  let skipped = 0;
  for (const row of returns) {
    if (row.pieces.length) {
      skipped += 1;
      continue;
    }
    const count = pieceCount(row);
    const mapped = decisionFromLegacy(row);
    for (let pieceNo = 1; pieceNo <= count; pieceNo += 1) {
      await prisma.returnPiece.create({
        data: {
          returnRequestId: row.id,
          pieceNo,
          code: `${row.number}-P${pieceNo}`,
          salesOrderId: row.salesOrderId,
          salesOrderLineId: row.salesOrderLineId,
          productId: row.productId,
          productDesc: row.productDesc,
          state: mapped.state,
          decision: mapped.decision,
          outboundEligible: mapped.outbound,
          receivedAt: row.receivedAt,
          receivedById: row.receivedById,
          conditionNotes: row.receivedCondition,
        },
      });
      created += 1;
    }
    if (Number(row.quantity) !== count) {
      await prisma.returnRequest.update({
        where: { id: row.id },
        data: { quantity: count },
      });
    }
  }
  console.log(JSON.stringify({ scanned: returns.length, skipped, created }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
