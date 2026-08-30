/**
 * Demo seed: multi-stage SEMI WIP kits for floor testing.
 * Run: pnpm --filter @maher/database exec tsx prisma/seed-wip-demo.ts
 *
 * Creates READY / CLAIMED kits across Carpentry, Foam, Assembly, Upholstery,
 * Painting, Packaging — with lots, bins, multi-piece kits, and real piece photos
 * from uploads/seed/task-photos.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient, WipKitStatus } from '@maher/database';

const prisma = new PrismaClient();

const TARGET_STAGES = [
  'CARPENTRY',
  'FOAM',
  'ASSEMBLY',
  'UPHOLSTERY',
  'PAINTING',
  'PACKAGING',
] as const;

type StageCode = (typeof TARGET_STAGES)[number];

const PLAN: Array<{
  stage: StageCode;
  status: WipKitStatus;
  pieces: number;
  count: number;
  /** When set, create a partial WipHandoff (waiting pickup with partial receive). */
  partialReceive?: number;
}> = [
  { stage: 'CARPENTRY', status: WipKitStatus.READY, pieces: 1, count: 2 },
  { stage: 'CARPENTRY', status: WipKitStatus.CLAIMED, pieces: 3, count: 1 },
  { stage: 'CARPENTRY', status: WipKitStatus.READY, pieces: 4, count: 1, partialReceive: 2 },
  { stage: 'FOAM', status: WipKitStatus.READY, pieces: 2, count: 3 },
  { stage: 'FOAM', status: WipKitStatus.CLAIMED, pieces: 1, count: 1 },
  { stage: 'ASSEMBLY', status: WipKitStatus.READY, pieces: 1, count: 3 },
  { stage: 'ASSEMBLY', status: WipKitStatus.CLAIMED, pieces: 2, count: 1 },
  { stage: 'UPHOLSTERY', status: WipKitStatus.READY, pieces: 1, count: 3 },
  { stage: 'PAINTING', status: WipKitStatus.READY, pieces: 1, count: 2 },
  { stage: 'PAINTING', status: WipKitStatus.CLAIMED, pieces: 1, count: 1 },
  { stage: 'PACKAGING', status: WipKitStatus.READY, pieces: 1, count: 2 },
];

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.resolve(__dirname, '../../../.env');
  const t = fs.readFileSync(envPath, 'utf8');
  for (const line of t.split('\n')) {
    const m = line.match(/^DATABASE_URL=(.*)$/);
    if (!m) continue;
    let v = m[1].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env.DATABASE_URL = v;
    break;
  }
}

function seedPhotoDir() {
  return path.resolve(__dirname, '../../../uploads/seed/task-photos');
}

async function loadSeedPhotoDocuments(): Promise<string[]> {
  const dir = seedPhotoDir();
  if (!fs.existsSync(dir)) {
    throw new Error(`Seed photo folder missing: ${dir}`);
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();
  if (!files.length) {
    throw new Error(`No image files in ${dir}`);
  }

  const ids: string[] = [];
  for (const file of files) {
    const storageKey = `seed/task-photos/${file}`;
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    const mimeType = /\.png$/i.test(file)
      ? 'image/png'
      : /\.webp$/i.test(file)
        ? 'image/webp'
        : 'image/jpeg';

    const existing = await prisma.document.findFirst({
      where: { storageKey },
      select: { id: true },
    });
    if (existing) {
      ids.push(existing.id);
      continue;
    }

    const created = await prisma.document.create({
      data: {
        fileName: file,
        mimeType,
        sizeBytes: stat.size,
        storageKey,
        category: 'WIP_PIECE_PHOTO',
        visibility: 'INTERNAL',
        description: 'Demo WIP piece photo',
      },
    });
    ids.push(created.id);
  }
  return ids;
}

async function ensureBin(warehouseId: string, code: string, name: string) {
  const existing = await prisma.warehouseLocation.findUnique({
    where: { warehouseId_code: { warehouseId, code } },
  });
  if (existing) return existing;
  return prisma.warehouseLocation.create({
    data: { warehouseId, code, name },
  });
}

async function allocateQr(base: string) {
  let candidate = base.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
  let n = 0;
  while (await prisma.wipKit.findUnique({ where: { qrCode: candidate } })) {
    n += 1;
    candidate = `${base}-${n}`.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
  }
  return candidate;
}

/** Attach real photos to every WIP piece that still has none. */
async function backfillPiecePhotos(photoDocIds: string[]) {
  const pieces = await prisma.wipPiece.findMany({
    where: { photoDocumentId: null },
    select: { id: true },
    orderBy: [{ kitId: 'asc' }, { sortOrder: 'asc' }],
  });
  let filled = 0;
  for (let i = 0; i < pieces.length; i++) {
    const docId = photoDocIds[i % photoDocIds.length]!;
    await prisma.wipPiece.update({
      where: { id: pieces[i]!.id },
      data: { photoDocumentId: docId },
    });
    filled += 1;
  }
  return filled;
}

async function main() {
  loadDatabaseUrl();

  const photoDocIds = await loadSeedPhotoDocuments();

  const semiWh = await prisma.warehouse.findFirst({
    where: { type: 'SEMI_FINISHED', isActive: true },
    orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
  });
  if (!semiWh) throw new Error('SEMI warehouse missing');

  const stageDefs = await prisma.productionStageDefinition.findMany({
    where: { code: { in: [...TARGET_STAGES] } },
  });
  const stageByCode = new Map(stageDefs.map((s) => [s.code, s]));

  for (const code of TARGET_STAGES) {
    const def = stageByCode.get(code);
    if (!def) throw new Error(`Stage ${code} missing`);
    await ensureBin(semiWh.id, code, `${def.nameEn} bin`);
  }

  const items = await prisma.inventoryItem.findMany({
    where: { itemClass: 'SEMI_FINISHED_GOOD', archivedAt: null },
    take: 40,
  });
  if (!items.length) throw new Error('No SEMI_FINISHED_GOOD items');

  const orders = await prisma.productionOrder.findMany({
    where: {
      status: {
        in: [
          'IN_PROGRESS',
          'READY',
          'QUALITY_CHECK',
          'WAITING_FOR_MATERIALS',
          'ON_HOLD',
        ],
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });
  if (orders.length < 8) {
    throw new Error('Need more open production orders for demo kits');
  }

  const receiver =
    (await prisma.user.findFirst({ where: { username: 'assembler' } })) ??
    (await prisma.user.findFirst({ where: { username: 'admin' } }));
  if (!receiver) throw new Error('Need assembler or admin user for handoff seed');

  let orderCursor = 0;
  let itemCursor = 0;
  let photoCursor = 0;
  let created = 0;
  const summary: Record<string, number> = {};

  for (const plan of PLAN) {
    const def = stageByCode.get(plan.stage)!;
    const bin = await ensureBin(semiWh.id, plan.stage, `${def.nameEn} bin`);

    for (let i = 0; i < plan.count; i++) {
      const order = orders[orderCursor % orders.length]!;
      orderCursor += 1;
      const item = items[itemCursor % items.length]!;
      itemCursor += 1;

      // Prefer an unused stage instance; otherwise create a demo instance.
      let stageInstance = await prisma.productionStageInstance.findFirst({
        where: {
          productionOrderId: order.id,
          stageDefinitionId: def.id,
          wipKit: null,
        },
      });
      if (!stageInstance) {
        stageInstance = await prisma.productionStageInstance.create({
          data: {
            productionOrderId: order.id,
            stageDefinitionId: def.id,
            status: 'COMPLETED',
            progressPercent: 100,
            notes: 'Demo WIP seed instance',
            actualEnd: new Date(),
          },
        });
      }

      const existingKit = await prisma.wipKit.findUnique({
        where: { stageInstanceId: stageInstance.id },
      });
      if (existingKit) continue;

      const qrCode = await allocateQr(
        `WIP-${order.number}-${plan.stage}-DEMO`,
      );

      const lot = await prisma.inventoryLot.create({
        data: {
          inventoryItemId: item.id,
          warehouseId: semiWh.id,
          locationId: bin.id,
          quantity: plan.pieces,
          status: 'AVAILABLE',
          productionOrderId: order.id,
          stageInstanceId: stageInstance.id,
          qrCode,
          producedAt: new Date(),
        },
      });

      const kit = await prisma.wipKit.create({
        data: {
          productionOrderId: order.id,
          stageInstanceId: stageInstance.id,
          status: plan.status,
          expectedPieceCount: plan.pieces,
          qrCode,
          warehouseId: semiWh.id,
          locationId: bin.id,
          nextSnapshotNodeIds: [],
          claimedAt: plan.status === WipKitStatus.CLAIMED ? new Date() : null,
          materialOverageNotes:
            plan.stage === 'FOAM' && i === 0
              ? 'Demo: foam +0.2m used vs expected'
              : null,
        },
      });

      for (let p = 0; p < plan.pieces; p++) {
        const photoDocumentId = photoDocIds[photoCursor % photoDocIds.length]!;
        photoCursor += 1;
        await prisma.wipPiece.create({
          data: {
            kitId: kit.id,
            sortOrder: p,
            label: `Piece ${p + 1}`,
            inventoryLotId: p === 0 ? lot.id : null,
            photoDocumentId,
            qrCode:
              plan.pieces > 1
                ? `${qrCode}-P${String(p + 1).padStart(2, '0')}`
                : null,
          },
        });
      }

      const handoffQty =
        plan.partialReceive != null
          ? plan.partialReceive
          : plan.status === WipKitStatus.CLAIMED
            ? plan.pieces
            : 0;
      if (handoffQty > 0) {
        const destStage =
          (await prisma.productionStageInstance.findFirst({
            where: {
              productionOrderId: order.id,
              stageDefinition: { code: 'ASSEMBLY' },
            },
          })) ?? stageInstance;
        await prisma.wipHandoff.create({
          data: {
            kitId: kit.id,
            lotId: lot.id,
            productionOrderId: order.id,
            sourceStageInstanceId: stageInstance.id,
            destinationStageInstanceId: destStage.id,
            quantity: handoffQty,
            receivedById: receiver.id,
            receivedAt: new Date(),
            idempotencyKey: `seed-wip-demo:${kit.id}`,
          },
        });
        if (plan.partialReceive != null) {
          summary[`${plan.stage}:PARTIAL_HANDOFF`] =
            (summary[`${plan.stage}:PARTIAL_HANDOFF`] ?? 0) + 1;
        }
      }

      created += 1;
      summary[`${plan.stage}:${plan.status}`] =
        (summary[`${plan.stage}:${plan.status}`] ?? 0) + 1;
    }
  }

  const photosBackfilled = await backfillPiecePhotos(photoDocIds);

  const byStage = await prisma.wipKit.findMany({
    include: {
      stageInstance: { include: { stageDefinition: { select: { code: true } } } },
    },
  });
  const totals: Record<string, number> = {};
  for (const k of byStage) {
    const c = k.stageInstance.stageDefinition.code;
    totals[c] = (totals[c] ?? 0) + 1;
  }

  const piecesWithPhoto = await prisma.wipPiece.count({
    where: { photoDocumentId: { not: null } },
  });
  const piecesTotal = await prisma.wipPiece.count();

  console.log(
    JSON.stringify(
      {
        created,
        summary,
        kitsByStage: totals,
        totalKits: byStage.length,
        photoDocuments: photoDocIds.length,
        photosBackfilled,
        piecesWithPhoto,
        piecesTotal,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
