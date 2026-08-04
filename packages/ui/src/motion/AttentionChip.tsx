import type { ElementType, ReactNode } from 'react';
import { cn } from '../cn';
import { Ltr } from '../Ltr';

export interface AttentionChipProps {
  href: string;
  label: string;
  value: number;
  tone: 'error' | 'warning' | 'info';
  icon?: ReactNode;
  /** Pass next-intl / next Link to keep client navigation */
  LinkComponent?: ElementType;
}

export function AttentionChip({
  href,
  label,
  value,
  tone,
  icon,
  LinkComponent,
}: AttentionChipProps) {
  const hot = value > 0;
  const styles = {
    error: 'border-[var(--maher-error)]/30 bg-[var(--maher-error-soft)] text-[var(--maher-error)]',
    warning:
      'border-[var(--maher-warning)]/30 bg-[var(--maher-warning-soft)] text-[var(--maher-warning)]',
    info: 'border-[var(--maher-info)]/30 bg-[var(--maher-info-soft)] text-[var(--maher-info)]',
  }[tone];

  const className = cn(
    'maher-press inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium shadow-sm backdrop-blur-sm transition-transform hover:-translate-y-0.5',
    styles,
    hot && 'maher-animate-attention',
  );

  const content = (
    <>
      {icon}
      <span>{label}</span>
      <Ltr className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold tabular-nums">
        {value}
      </Ltr>
    </>
  );

  if (LinkComponent) {
    return (
      <LinkComponent href={href} className={className}>
        {content}
      </LinkComponent>
    );
  }

  return (
    <a href={href} className={className}>
      {content}
    </a>
  );
}
