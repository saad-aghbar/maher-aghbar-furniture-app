import type { HTMLAttributes, TableHTMLAttributes } from 'react';
import { cn } from './cn';

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  wrapperClassName?: string;
}

export function Table({ className, wrapperClassName, ...props }: TableProps) {
  return (
    <div
      className={cn(
        'maher-animate-rise maher-table-shell w-full overflow-x-auto rounded-[var(--maher-radius-lg)] border border-[var(--maher-border)] bg-[var(--maher-surface)] shadow-[var(--maher-shadow-sm)]',
        wrapperClassName,
      )}
    >
      <table
        className={cn(
          'w-full min-w-[640px] border-collapse text-sm rtl:min-w-[560px]',
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        'sticky top-0 z-10 bg-[var(--maher-surface-muted)] text-[var(--maher-text-secondary)]',
        '[&_tr]:border-b [&_tr]:border-[var(--maher-border)]',
        className,
      )}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn('maher-stagger-rows divide-y divide-[var(--maher-border)]', className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'transition-colors duration-200 ease-out hover:bg-[var(--maher-surface-muted)]',
        'hover:[&>td:first-child]:shadow-[inset_3px_0_0_0_var(--maher-brand)]',
        'rtl:hover:[&>td:first-child]:shadow-[inset_-3px_0_0_0_var(--maher-brand)]',
        '[&>td:first-child]:transition-shadow [&>td:first-child]:duration-200',
        className,
      )}
      {...props}
    />
  );
}

export function TableHeaderCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        // LTR: compact uppercase headers. RTL (Arabic/Hebrew): normal case + wrap so labels stay readable.
        'px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-[0.06em] whitespace-nowrap',
        'rtl:normal-case rtl:text-xs rtl:font-semibold rtl:tracking-normal rtl:leading-snug rtl:whitespace-normal',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'px-4 py-3 align-middle text-start text-[var(--maher-text-primary)]',
        'rtl:leading-relaxed',
        className,
      )}
      {...props}
    />
  );
}

/** Table cell for codes, money, qty, %, dates — always LTR so RTL pages stay aligned. */
export function TableNumericCell({
  className,
  ...props
}: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <TableCell
      dir="ltr"
      className={cn('whitespace-nowrap tabular-nums', className)}
      {...props}
    />
  );
}

export function TableNumericHeader({
  className,
  ...props
}: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <TableHeaderCell
      dir="ltr"
      className={cn('whitespace-nowrap tabular-nums', className)}
      {...props}
    />
  );
}
