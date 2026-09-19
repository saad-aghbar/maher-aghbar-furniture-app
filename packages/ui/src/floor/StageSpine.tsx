import { cn } from '../cn';

export function StageSpine({
  stages,
  active,
}: {
  stages: Array<{ id: string; label: string }>;
  active?: string;
}) {
  return (
    <ol className="flex flex-wrap gap-2">
      {stages.map((stage) => (
        <li
          key={stage.id}
          className={cn(
            'rounded-full border px-3 py-1.5 text-xs',
            active === stage.id
              ? 'border-[var(--maher-brand)] bg-[var(--maher-brand-soft)]'
              : 'border-[var(--maher-border)] bg-[var(--maher-surface-muted)]',
          )}
        >
          {stage.label}
        </li>
      ))}
    </ol>
  );
}
