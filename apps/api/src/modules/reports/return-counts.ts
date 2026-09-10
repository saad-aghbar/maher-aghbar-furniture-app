/**
 * Dashboard vs management-summary return tiles.
 * pendingReturns is a single OR (each return counted at most once).
 * The three management tiles are intentionally non-exclusive.
 */

import type { Prisma } from '@maher/database';

export const pendingReturnsWhere: Prisma.ReturnRequestWhereInput = {
  OR: [
    { approvalStatus: { in: ['PENDING', 'NEED_INFO'] } },
    { physicalStatus: 'WAITING_RETURN' },
    {
      physicalStatus: { in: ['RETURNED', 'INSPECTING'] },
      inventoryFate: 'PENDING',
    },
  ],
};

export const managementReturnTileWheres: {
  approvalOpen: Prisma.ReturnRequestWhereInput;
  waitingReturn: Prisma.ReturnRequestWhereInput;
  waitingInspection: Prisma.ReturnRequestWhereInput;
} = {
  approvalOpen: { approvalStatus: { in: ['PENDING', 'NEED_INFO'] } },
  waitingReturn: { physicalStatus: 'WAITING_RETURN' },
  waitingInspection: {
    physicalStatus: { in: ['RETURNED', 'INSPECTING'] },
    inventoryFate: 'PENDING',
  },
};

export function matchesPendingReturns(row: {
  approvalStatus?: string | null;
  physicalStatus?: string | null;
  inventoryFate?: string | null;
}): boolean {
  const approval = String(row.approvalStatus ?? '');
  const physical = String(row.physicalStatus ?? '');
  const fate = String(row.inventoryFate ?? '');
  if (approval === 'PENDING' || approval === 'NEED_INFO') return true;
  if (physical === 'WAITING_RETURN') return true;
  if ((physical === 'RETURNED' || physical === 'INSPECTING') && fate === 'PENDING') return true;
  return false;
}

export function matchingManagementTiles(row: {
  approvalStatus?: string | null;
  physicalStatus?: string | null;
  inventoryFate?: string | null;
}): Array<'approvalOpen' | 'waitingReturn' | 'waitingInspection'> {
  const hits: Array<'approvalOpen' | 'waitingReturn' | 'waitingInspection'> = [];
  const approval = String(row.approvalStatus ?? '');
  const physical = String(row.physicalStatus ?? '');
  const fate = String(row.inventoryFate ?? '');
  if (approval === 'PENDING' || approval === 'NEED_INFO') hits.push('approvalOpen');
  if (physical === 'WAITING_RETURN') hits.push('waitingReturn');
  if ((physical === 'RETURNED' || physical === 'INSPECTING') && fate === 'PENDING') {
    hits.push('waitingInspection');
  }
  return hits;
}
