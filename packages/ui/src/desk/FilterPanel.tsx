'use client';

import type { ReactNode } from 'react';
import { FilterGroup } from '../list/FilterDrawer';

export function FilterSection({ title, icon, children }: { title: string; icon?: ReactNode; active?: boolean; children: ReactNode }) {
  return (
    <FilterGroup
      title={
        <span className="inline-flex items-center gap-2">
          {icon ? <span className="text-[var(--maher-brand)]">{icon}</span> : null}
          {title}
        </span>
      }
    >
      {children}
    </FilterGroup>
  );
}
