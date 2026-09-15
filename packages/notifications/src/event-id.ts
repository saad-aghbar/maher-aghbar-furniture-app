/**
 * Stable domain event id. Callers pass a `transition` that identifies THIS
 * business occurrence (status change id, audit id, occurredAt ms, etc.).
 * Duplicate delivery of the same transition is suppressed.
 * A later legitimate repeat MUST use a different transition.
 */
export function notificationEventId(input: {
  topic: string;
  entityType: string;
  entityId: string;
  transition: string;
}): string {
  const topic = input.topic.trim();
  const entityType = input.entityType.trim();
  const entityId = input.entityId.trim();
  const transition = input.transition.trim();
  if (!topic || !entityType || !entityId || !transition) {
    throw new Error('notificationEventId requires topic, entityType, entityId, and transition');
  }
  return `${topic}:${entityType}:${entityId}:${transition}`;
}

/** One-shot ids for legacy callers that have no domain transition yet. */
export function uniqueNotificationEventId(topic: string, entityType: string, entityId: string): string {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return notificationEventId({ topic, entityType, entityId, transition: nonce });
}
