/** Read-only helpers for displaying task scheduling info on the floor. */

export function toDateOnly(value?: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

/** True when the given ISO date/datetime falls on today's calendar date (local time). */
export function isScheduledForToday(value?: string | null): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
