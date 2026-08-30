/**
 * Quiet catalog reference next to a Line setup / SPEC dimension field.
 * Always returns a hint so an empty seat-height slot looks intentional.
 * Never invents a number when the catalog has no value.
 */
export function formatCatalogDimensionHint(
  catalogWord: string,
  value: number | string | null | undefined,
  emptyMark: string,
): string {
  const n =
    value == null || value === ''
      ? null
      : Number(value);
  const shown = n != null && Number.isFinite(n) ? String(n) : emptyMark;
  return `${catalogWord}: ${shown}`;
}
