'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { AppLinkComponent } from '../AppLinkComponent';

export interface QuickActionTileProps {
  href: string;
  label: string;
  icon: ReactNode;
  delayMs?: number;
  LinkComponent?: AppLinkComponent;
  trailingIcon?: ReactNode;
}

export function QuickActionTile({
  href,
  label,
  icon,
  delayMs = 0,
  LinkComponent,
  trailingIcon,
}: QuickActionTileProps) {
  const className =
    'maher-floor-board maher-press group relative flex min-w-[132px] flex-col items-start gap-3 overflow-hidden rounded-[20px] border border-[var(--maher-border-strong)] bg-[var(--maher-surface)] px-4 py-4 ps-5 shadow-[var(--maher-shadow-sm)]';
  const style = { animationDelay: `${delayMs}ms` };

  const body = (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 start-0 w-[3px] opacity-55"
        style={{ background: 'var(--maher-brand)' } satisfies CSSProperties}
      />
      <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--maher-surface-muted)] text-[var(--maher-brand)]">
        {icon}
      </span>
      <span className="text-sm font-semibold text-[var(--maher-text-primary)]">{label}</span>
      {trailingIcon ? (
        <span className="absolute end-3 top-3 text-[var(--maher-text-tertiary)]">{trailingIcon}</span>
      ) : null}
    </>
  );

  if (LinkComponent) {
    const Comp = LinkComponent;
    return (
      <Comp href={href} className={className} style={style}>
        {body}
      </Comp>
    );
  }

  return (
    <a href={href} className={className} style={style}>
      {body}
    </a>
  );
}
