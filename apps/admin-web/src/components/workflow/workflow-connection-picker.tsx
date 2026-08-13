'use client';

import { cn } from '@maher/ui';

type Option = { id: string; label: string };

type Props = {
  label: string;
  hint?: string;
  options: Option[];
  selectedIds: string[];
  enabledIds: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
};

export function WorkflowConnectionPicker({
  label,
  hint,
  options,
  selectedIds,
  enabledIds,
  onToggle,
  disabled,
}: Props) {
  const enabled = new Set(enabledIds);
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-text-secondary">{label}</p>
      {hint ? <p className="mb-2 text-[11px] text-text-tertiary">{hint}</p> : null}
      <div className="flex flex-wrap gap-2">
        {options.length === 0 ? <span className="text-xs text-text-tertiary">—</span> : null}
        {options.map((opt) => {
          const checked = selectedIds.includes(opt.id);
          const allowed = checked || enabled.has(opt.id);
          return (
            <label
              key={opt.id}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs',
                checked
                  ? 'border-brand bg-[var(--maher-brand-soft)]'
                  : 'border-[var(--maher-border)] bg-[var(--maher-surface)]',
                (!allowed || disabled) && 'cursor-not-allowed opacity-40',
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled || !allowed}
                onChange={() => onToggle(opt.id)}
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
