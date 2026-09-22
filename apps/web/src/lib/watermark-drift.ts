/**
 * Seamless horizontal watermark offset.
 * `progress` may be any real; wrap into [0, 1) so -stripW and 0 are the same tile phase.
 */
export function watermarkDriftX(progress: number, stripW: number): number {
  if (!(stripW > 0) || !Number.isFinite(progress)) return 0;
  const unit = progress - Math.floor(progress);
  if (unit === 0) return 0;
  return unit * -stripW;
}
