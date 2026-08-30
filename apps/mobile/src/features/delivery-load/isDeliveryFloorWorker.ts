import { can } from '@maher/permissions';
import type { AuthUser } from '@maher/types';

/**
 * Delivery-only floor workers see assigned deliveries + load sheet,
 * not production Task Details.
 */
export function isDeliveryFloorWorker(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (!can(user, 'delivery.update') && !can(user, 'delivery.read')) return false;
  const skills = (user.stageSkillCodes ?? []).map((c) => c.toUpperCase());
  if (skills.length === 0) return false;
  return skills.every((c) => c === 'DELIVERY');
}
