const FACTORY_STARTED_STATUSES = [
  'IN_PROGRESS',
  'ON_HOLD',
  'QUALITY_CHECK',
  'READY_FOR_PACKAGING',
  'READY_FOR_DELIVERY',
  'COMPLETED',
] as const;

export function isFactoryWorkStarted(po: {
  releasedToFactoryAt?: Date | string | null;
  actualStartDate?: Date | string | null;
  status?: string | null;
}): boolean {
  const status = String(po.status ?? '').toUpperCase();
  return (
    Boolean(po.releasedToFactoryAt) ||
    Boolean(po.actualStartDate) ||
    (FACTORY_STARTED_STATUSES as readonly string[]).includes(status)
  );
}
