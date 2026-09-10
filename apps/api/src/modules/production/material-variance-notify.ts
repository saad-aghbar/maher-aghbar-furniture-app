export type MaterialVarianceTemplate =
  | 'MATERIAL_OVER_ISSUE'
  | 'MATERIAL_UNDER_ISSUE'
  | 'MATERIAL_EXTRA_ISSUE';

/** Maps a recorded line status to an admin inbox template. UNUSED is silent. */
export function materialVarianceNotifyCode(
  status: 'ON_TARGET' | 'OVER' | 'UNDER' | 'EXTRA' | 'UNUSED',
): MaterialVarianceTemplate | null {
  if (status === 'OVER') return 'MATERIAL_OVER_ISSUE';
  if (status === 'UNDER') return 'MATERIAL_UNDER_ISSUE';
  if (status === 'EXTRA') return 'MATERIAL_EXTRA_ISSUE';
  return null;
}
