/**
 * Product grid columns / tile width from the pane the list actually sits in.
 * Window width is the wrong input on iPad — admin products live in a split
 * primary column, so full-window math makes one landscape tile eat the row
 * and a portrait tile collapse beside it.
 */

/** Smallest tile we’ll still pack. Phone 390dp stays 2-up (≈173). */
export const CATALOG_MIN_TILE = 172;

export function catalogGridColumns(
  paneWidth: number,
  pad: number,
  gap: number,
): number {
  if (!(paneWidth > 0)) return 2;
  const inner = Math.max(0, paneWidth - pad * 2);
  const fit = Math.floor((inner + gap) / (CATALOG_MIN_TILE + gap));
  return Math.max(1, Math.min(4, fit || 1));
}

export function catalogCardWidth(
  paneWidth: number,
  columns: number,
  pad: number,
  gap: number,
): number {
  const cols = Math.max(1, columns);
  return (paneWidth - pad * 2 - gap * (cols - 1)) / cols;
}
