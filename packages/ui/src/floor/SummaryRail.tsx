import { cn } from '../cn';

export function SummaryRail({
  cells,
}: {
  cells: Array<{ id: string; label: string; value: string; active?: boolean }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {cells.map((cell) => (
        <div
          key={cell.id}
          className={cn(
            'rounded-[14px] border px-3 py-2',
            cell.active
              ? 'border-[var(--maher-brand)] bg-[var(--maher-brand-soft)]'
              : 'border-[var(--maher-border)] bg-[var(--maher-surface-muted)]',
          )}
        >
          <p className="text-[11px] text-[var(--maher-text-muted)]">{cell.label}</p>
          <p className="text-sm font-medium" dir="ltr">
            {cell.value}
          </p>
        </div>
      ))}
    </div>
  );
}
