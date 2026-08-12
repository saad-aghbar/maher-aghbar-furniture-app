/**
 * True when an ISO timestamp falls on the same calendar day as `now`
 * (device-local day). Used to show a "Scheduled for today" label on
 * worker task cards/detail without exposing any factory-calendar UI.
 */
export function isScheduledToday(
  iso: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
