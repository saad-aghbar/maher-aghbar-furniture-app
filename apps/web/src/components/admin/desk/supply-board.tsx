'use client';

import { Link } from '@/i18n/navigation';
import type { ManagementSummary, MgmtTile } from '@/lib/management-summary';
import { tileLink } from '@/lib/management-summary';
import { Board, Ledger, LedgerRow, Stamp, toneFromKey } from '@maher/ui';
import { PackageCheck } from 'lucide-react';
import { useDeskCopy } from './desk-shared';

/** Materials and stock in one ledger: what's short, what's late, what's arriving. Zero rows hidden. */
export function SupplyBoard({ data }: { data: ManagementSummary }) {
  const { t, tileLabel } = useDeskCopy();
  const m = data.materials;
  const inv = data.inventory ?? null;

  const rows: MgmtTile[] = [
    m.blockingProduction,
    m.lateSupplierPos,
    m.needsPurchasing,
    m.arrivingToday,
    ...(inv ? [inv.rawShortages, inv.semiHandoff, inv.correctionsAttention] : []),
  ].filter((tile) => tile.count > 0);

  const hot = rows.filter((r) => toneFromKey(r.key, r.count) === 'error').length;
  const tone = hot > 0 ? 'error' : rows.length ? 'warning' : 'success';

  return (
    <Board tone={tone}>
      <Board.Header
        title={t('deskSupplyTitle')}
        description={t('deskSupplyHint')}
        meta={
          rows.length ? (
            <Stamp tone={tone} size="sm">
              {rows.reduce((s, r) => s + r.count, 0)}
            </Stamp>
          ) : null
        }
      />
      {rows.length ? (
        <Board.Body padding="tight">
          <Ledger className="px-2">
            {rows.map((tile) => (
              <LedgerRow
                key={tile.key}
                label={tileLabel(tile.key)}
                value={tile.count.toLocaleString('en-JO')}
                tone={toneFromKey(tile.key, tile.count)}
                stamp
                href={tileLink(tile.href, tile.filter)}
                LinkComponent={Link}
              />
            ))}
          </Ledger>
        </Board.Body>
      ) : (
        <Board.Empty
          icon={<PackageCheck className="h-4 w-4" />}
          title={t('deskSupplyEmptyTitle')}
          description={t('deskSupplyEmptyBody')}
        />
      )}
    </Board>
  );
}
