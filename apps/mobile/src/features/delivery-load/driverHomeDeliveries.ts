const DRIVER_READY = new Set(['READY', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY']);
const DRIVER_DONE = new Set(['DELIVERED', 'CANCELLED', 'CANCELED']);

/** Ready deliveries can be loaded. Planned ones stay waiting and are not a load. */
export function splitDriverHomeDeliveries<T extends { status?: string | null }>(rows: T[]) {
  const ready: T[] = [];
  const waiting: T[] = [];
  for (const row of rows) {
    const status = String(row.status ?? '').trim().toUpperCase();
    if (DRIVER_DONE.has(status)) continue;
    if (DRIVER_READY.has(status)) ready.push(row);
    else waiting.push(row);
  }
  return { ready, waiting };
}
