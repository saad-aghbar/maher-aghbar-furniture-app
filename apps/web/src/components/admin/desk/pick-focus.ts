import type { ManagementSummary, MgmtAttentionCard } from '@/lib/management-summary';
import { tileLink } from '@/lib/management-summary';
import type { BoardTone } from '@maher/ui';

export type DeskFocus =
  | { kind: 'attention'; card: MgmtAttentionCard; tone: BoardTone; href: string }
  | { kind: 'late'; count: number; tone: BoardTone; href: string }
  | { kind: 'blocked'; count: number; tone: BoardTone; href: string }
  | { kind: 'clear'; tone: BoardTone };

/**
 * One thing to do next. Order: critical ticket > late orders > blocked jobs > high ticket > clear.
 * Mirrors the mobile `pickHomeFocus` priority (blocker > watch > flow).
 */
export function pickFocus(data: ManagementSummary): DeskFocus {
  const critical = data.attention.find((c) => c.priority === 'critical');
  if (critical) {
    return { kind: 'attention', card: critical, tone: 'error', href: tileLink(critical.href, critical.filter) };
  }
  const late = data.late?.overdue?.count ?? 0;
  if (late > 0) {
    return {
      kind: 'late',
      count: late,
      tone: 'error',
      href: tileLink(data.late.overdue.href, data.late.overdue.filter),
    };
  }
  const blocked = data.production.blocked?.count ?? 0;
  if (blocked > 0) {
    return {
      kind: 'blocked',
      count: blocked,
      tone: 'warning',
      href: tileLink(data.production.blocked.href, data.production.blocked.filter),
    };
  }
  const high = data.attention.find((c) => c.priority === 'high') ?? data.attention[0];
  if (high) {
    return {
      kind: 'attention',
      card: high,
      tone: high.priority === 'high' ? 'warning' : 'info',
      href: tileLink(high.href, high.filter),
    };
  }
  return { kind: 'clear', tone: 'success' };
}

export function priorityTone(priority: MgmtAttentionCard['priority']): BoardTone {
  return priority === 'critical' ? 'error' : priority === 'high' ? 'warning' : 'info';
}
