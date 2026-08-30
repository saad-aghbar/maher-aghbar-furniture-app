export type ReportPreset = 'today' | 'week' | 'month';

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Inclusive date range for report period presets (local calendar). */
export function rangeForPreset(preset: ReportPreset): { from: string; to: string } {
  const to = new Date();
  to.setHours(0, 0, 0, 0);
  const from = new Date(to);

  if (preset === 'today') {
    return { from: ymd(from), to: ymd(to) };
  }
  if (preset === 'week') {
    const day = from.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    from.setDate(from.getDate() + mondayOffset);
    return { from: ymd(from), to: ymd(to) };
  }
  from.setDate(1);
  return { from: ymd(from), to: ymd(to) };
}
