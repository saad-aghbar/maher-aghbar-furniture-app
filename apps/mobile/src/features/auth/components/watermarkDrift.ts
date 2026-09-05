/**
 * Seamless horizontal watermark offset.
 * `progress` may be any real (withRepeat can sit on 1.0); wrap into [0, 1)
 * so translateX(-stripW) and 0 are the same tile phase.
 */
export function watermarkDriftX(progress: number, stripW: number): number {
  'worklet';
  if (!(stripW > 0) || !Number.isFinite(progress)) return 0;
  const unit = progress - Math.floor(progress);
  if (unit === 0) return 0;
  return unit * -stripW;
}
