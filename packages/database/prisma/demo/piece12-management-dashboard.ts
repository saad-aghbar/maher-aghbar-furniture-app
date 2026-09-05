/**
 * Piece 12 — Management dashboard demo mapping.
 *
 * No new operational rows are required. Dashboard tiles are read-only
 * aggregations over existing Piece 7–11 (and earlier) factory-world records.
 * See docs/piece12-management-tile-map.md for the full tile → demo map.
 *
 * This module only logs the mapping at seed time so demo:reset output
 * documents which SO-P* / RET-P* rows drive management-summary tiles.
 */
import type { PrismaClient } from '@prisma/client';

/** Seed hook: documentation + log only (no mutations). */
export async function seedPiece12ManagementDashboardExamples(
  _prisma: PrismaClient,
  _ctx?: unknown,
): Promise<void> {
  console.log('  piece12: management dashboard uses existing P7–P11 rows (no new seed data)');
  console.log('  piece12 tile map (see docs/piece12-management-tile-map.md):');
  console.log('    Attention / returns …… SO/RET-P11-F…J, cancel SO-P11-C/L');
  console.log('    Quality ………………… SO/PO-P9-A…D (waiting / FAIL / rework)');
  console.log('    Outbound / finished … SO/DLV-P10-A…G (waiting / leaving / shipped)');
  console.log('    SEMI / floor ………… SO/PO-P8-A…G handoff + attention');
  console.log('    Finance due vs credit SO/INV/PAY-P7-L (advance credit) + overdue invoices');
  console.log('    Materials / PO late … Piece 6 purchasing / receiving examples');
}
