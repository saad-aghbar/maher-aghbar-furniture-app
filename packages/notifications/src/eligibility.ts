import { hasPermission } from '@maher/permissions';
import type { Permission } from '@maher/permissions';
import type { RecipientUser, TopicDefinition } from './types';

export function isSystemAdministrator(user: RecipientUser): boolean {
  return user.roles.includes('SYSTEM_ADMINISTRATOR');
}

export function isDealerIdentity(user: RecipientUser): boolean {
  if (user.customerId) return true;
  return user.roles.includes('CUSTOMER');
}

function requiredPermissions(topic: TopicDefinition): Permission[] {
  const permission = topic.permission;
  if (!permission) return [];
  if (typeof permission === 'string') return [permission];
  return [...permission];
}

export function topicMatchesPermission(user: RecipientUser, topic: TopicDefinition): boolean {
  const required = requiredPermissions(topic);
  if (required.length === 0) return true;
  return required.some((code) => hasPermission(user.permissions, code));
}

/**
 * Who may even see the checkbox / be a candidate recipient.
 * SYSTEM_ADMINISTRATOR is eligible for every catalog topic.
 */
export function isEligibleForTopic(user: RecipientUser, topic: TopicDefinition): boolean {
  if (isSystemAdministrator(user)) return true;
  if (isDealerIdentity(user)) return topic.audiences.includes('dealer');
  if (topic.audiences.includes('staff') && topicMatchesPermission(user, topic)) return true;
  if (topic.audiences.includes('worker') && topicMatchesPermission(user, topic)) return true;
  return false;
}

export function preferenceEnabled(
  topic: TopicDefinition,
  stored: boolean | undefined | null,
): boolean {
  if (stored == null) return topic.defaultOn;
  return stored;
}

export function shouldNotifyUser(input: {
  user: RecipientUser;
  topic: TopicDefinition;
  actorUserId?: string | null;
  excludeActor?: boolean;
  storedPreference?: boolean | null;
}): boolean {
  if (!isEligibleForTopic(input.user, input.topic)) return false;
  if ((input.excludeActor ?? true) && input.actorUserId && input.actorUserId === input.user.id) {
    return false;
  }
  return preferenceEnabled(input.topic, input.storedPreference);
}

export function eligibleTopicsForUser(user: RecipientUser, topics: readonly TopicDefinition[]) {
  return topics.filter((topic) => isEligibleForTopic(user, topic));
}
