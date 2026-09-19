/**
 * Dealer PDP hero size. Window width is the wrong input on iPad — the catalog
 * lives in a split pane, and a 1:1 crop of the window is a giant square.
 */

/** Portrait phone stays a full-bleed square. */
export const PRODUCT_DETAIL_HERO_PHONE_MAX = 420;

/** Split / landscape / iPad — keep the photo as a board, not a mural. */
export const PRODUCT_DETAIL_HERO_DESK_MAX = 300;

const DESK_PANE = 500;

export function productDetailHeroHeight(paneWidth: number, aspectRatio = 1): number {
  const max =
    paneWidth >= DESK_PANE
      ? PRODUCT_DETAIL_HERO_DESK_MAX
      : PRODUCT_DETAIL_HERO_PHONE_MAX;
  if (!(paneWidth > 0) || !(aspectRatio > 0)) return PRODUCT_DETAIL_HERO_DESK_MAX;
  return Math.round(Math.min(paneWidth / aspectRatio, max));
}
