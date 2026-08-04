/** Coarse progress buckets shown to dealers (20 / 40 / 80 / Completed). */
export function coarseDealerProgress(percent: number | null | undefined): {
  percent: number;
  label: 'Started' | 'In progress' | 'Near completion' | 'Completed';
} {
  const p = Number(percent ?? 0);
  if (p >= 100) return { percent: 100, label: 'Completed' };
  if (p >= 60) return { percent: 80, label: 'Near completion' };
  if (p >= 25) return { percent: 40, label: 'In progress' };
  return { percent: 20, label: 'Started' };
}

export function mapProgressForDealer<T extends { progressPercent?: number | null }>(
  row: T,
): T & { progressPercent: number; progressLabel: string } {
  const coarse = coarseDealerProgress(row.progressPercent);
  return { ...row, progressPercent: coarse.percent, progressLabel: coarse.label };
}
