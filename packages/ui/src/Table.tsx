import type { HTMLAttributes, TableHTMLAttributes } from 'react';
import { cn } from './cn';

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  wrapperClassName?: string;
}

/**
 * @deprecated Prefer `DataBoard` from `@maher/ui`. `Table` now renders on the Board
 * recipe (18px shell, hairline rows, muted header band) so legacy tables match the kit.
 */
export function Table({ className, wrapperClassName, ...props }: TableProps) {
  return (
    <div
      className={cn(
        'maher-board maher-data-board maher-animate-rise w-full overflow-x-auto rounded-[18px] border border-[var(--maher-border)] bg-[var(--maher-surface)]',
        wrapperClassName,
      )}
    >
      <table className={cn('w-full min-w-[640px] rtl:min-w-[560px]', className)} {...props} />
    </div>
  );
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('sticky top-0 z-10', className)}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn('maher-stagger-rows', className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('transition-colors duration-200 ease-out hover:bg-[var(--maher-surface-muted)]', className)}
      {...props}
    />
  );
}

export function TableHeaderCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'text-start rtl:whitespace-normal',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('text-start rtl:leading-relaxed', className)}
      {...props}
    />
  );
}

/** Table cell for codes, money, qty, %, dates — LTR digits, parent-aligned in RTL. */
export function TableNumericCell({
  className,
  ...props
}: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <TableCell
      dir="ltr"
      className={cn(
        'whitespace-nowrap tabular-nums [unicode-bidi:isolate] [text-align:match-parent]',
        className,
      )}
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
      className={cn(
        'whitespace-nowrap tabular-nums [unicode-bidi:isolate] [text-align:match-parent]',
        className,
      )}
      {...props}
    />
  );
}
