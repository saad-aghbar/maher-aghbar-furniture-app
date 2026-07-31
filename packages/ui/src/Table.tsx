import type { HTMLAttributes, TableHTMLAttributes } from 'react';
import { cn } from './cn';

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-[var(--maher-radius-lg)] border border-[var(--maher-border)]">
      <table
        className={cn('w-full min-w-[640px] border-collapse text-sm', className)}
        {...props}
      />
    </div>
  );
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('bg-[var(--maher-background)] text-[var(--maher-text-secondary)]', className)}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-[var(--maher-border)]', className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('hover:bg-[var(--maher-background)]/60 transition-colors', className)}
      {...props}
    />
  );
}

export function TableHeaderCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-4 py-3 text-[var(--maher-text-primary)]', className)} {...props} />
  );
}
