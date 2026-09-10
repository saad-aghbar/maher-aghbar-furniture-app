import { PrismaService } from '../../common/prisma.service';
import {
  piecesFromWipKits,
  selectKitsForInspection,
  type IncomingPieceForInspection,
} from './inspection-pieces';

export type ExpectedPackageRow = {
  code: string;
  labelEn: string;
  labelAr?: string;
};

export function expectedPackagesFromIncomingPieces(
  pieces: IncomingPieceForInspection[],
): ExpectedPackageRow[] {
  return pieces.map((piece, index) => ({
    code: `P${index + 1}`,
    labelEn: piece.label?.trim() || `Package ${index + 1}`,
    labelAr: piece.kitLabelAr ?? undefined,
  }));
}

export function fallbackExpectedPackages(
  labels: Array<{ nameEn: string; nameAr?: string | null }>,
  count: number,
): ExpectedPackageRow[] {
  if (labels.length) {
    return labels.map((label, index) => ({
      code: `P${index + 1}`,
      labelEn: label.nameEn,
      labelAr: label.nameAr ?? undefined,
    }));
  }
  const n = Math.max(1, Math.floor(Number(count) || 1));
  return Array.from({ length: n }, (_, index) => ({
    code: `P${index + 1}`,
    labelEn: `Package ${index + 1}`,
  }));
}

/** Previous producing stage first; packaging snapshot only if that list is empty. */
export function resolveExpectedPackages(opts: {
  incoming: IncomingPieceForInspection[];
  snapshotLabels: Array<{ nameEn: string; nameAr?: string | null }>;
  snapshotCount: number;
}): ExpectedPackageRow[] {
  const fromPrior = expectedPackagesFromIncomingPieces(opts.incoming);
  if (fromPrior.length) return fromPrior;
  return fallbackExpectedPackages(opts.snapshotLabels, opts.snapshotCount);
}

export function compositionFromIncomingPieces(
  pieces: IncomingPieceForInspection[],
): string | null {
  const labels = pieces.map((piece) => piece.label?.trim()).filter(Boolean);
  if (!labels.length) return null;
  return labels.join(' + ');
}

export function expectedPackageLabelList(packages: ExpectedPackageRow[]): string[] {
  return packages.map((row) => row.labelEn);
}

export async function loadIncomingPiecesForInspection(
  prisma: PrismaService,
  productionOrderId: string,
  stageCode = 'INSPECTION',
): Promise<IncomingPieceForInspection[]> {
  const code = stageCode || 'INSPECTION';
  const stage = await prisma.productionStageInstance.findFirst({
    where: {
      productionOrderId,
      stageDefinition: { code },
    },
    select: { id: true },
  });
  const snap = await prisma.productionOrderWorkflowSnapshotNode.findFirst({
    where: stage
      ? { stageInstanceId: stage.id }
      : { snapshot: { productionOrderId }, stageCode: code },
    select: { id: true, snapshotId: true },
  });
  if (!snap) return [];

  const edges = await prisma.productionOrderWorkflowSnapshotEdge.findMany({
    where: { snapshotId: snap.snapshotId },
    select: { fromSnapshotNodeId: true, toSnapshotNodeId: true },
  });
  const predecessorIds = edges
    .filter((edge) => edge.toSnapshotNodeId === snap.id)
    .map((edge) => edge.fromSnapshotNodeId);

  const kits = await prisma.wipKit.findMany({
    where: { productionOrderId },
    include: { pieces: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  });
  const relevant = selectKitsForInspection(kits, snap.id, edges, predecessorIds);
  if (!relevant.length) return [];

  const snapIds = [
    ...new Set(
      relevant.map((kit) => kit.snapshotNodeId).filter((id): id is string => Boolean(id)),
    ),
  ];
  const snaps = snapIds.length
    ? await prisma.productionOrderWorkflowSnapshotNode.findMany({
        where: { id: { in: snapIds } },
        select: {
          id: true,
          metadata: true,
          outputNameEn: true,
          outputNameAr: true,
          outputNameHe: true,
          nameEnSnapshot: true,
          nameArSnapshot: true,
          nameHeSnapshot: true,
          expectedPieceCount: true,
        },
      })
    : [];
  const snapById = new Map(snaps.map((node) => [node.id, node]));
  return piecesFromWipKits(
    relevant.map((kit) => {
      const node = kit.snapshotNodeId ? snapById.get(kit.snapshotNodeId) : undefined;
      return {
        id: kit.id,
        pieces: kit.pieces,
        expectedPieceCount: kit.expectedPieceCount ?? node?.expectedPieceCount,
        snapshotMetadata: node?.metadata,
        outputNameEn: node?.outputNameEn ?? node?.nameEnSnapshot,
        outputNameAr: node?.outputNameAr ?? node?.nameArSnapshot,
        outputNameHe: node?.outputNameHe ?? node?.nameHeSnapshot,
      };
    }),
  );
}
