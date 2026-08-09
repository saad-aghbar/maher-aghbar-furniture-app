/**
 * Netflix-style intro: big sofa-M slam → dock into lockup beside “aher” → login reveal.
 * Timings tuned for a smooth, cinematic feel (not snappy UI motion).
 */
export const brandIntroTimeline = {
  /** Quiet black beat before M */
  veilHold: 220,
  /** Big M slam-in */
  slamMs: 780,
  /** Breathe on the centered mark */
  holdMs: 520,
  /** Soft flight into lockup seat */
  dockMs: 980,
  /** Veil / background dissolve */
  settleMs: 640,
  revealStaggerMs: 90,
  revealGroupMs: 340,
  shortRevealMs: 400,
  reducedFadeMs: 220,
  skipUnlockAt: 560,
  /** Oversized entrance relative to seated M */
  slamScaleFrom: 2.4,
  /** No bounce overshoot — ease straight into hold size */
  slamScalePeak: 1.0,
  /** Scale while centered, before dock flight */
  slamScaleHold: 1.18,
  /**
   * Lockup layout fractions (M seat inside lockup box).
   * Seat sits snug left of “aher” (not flush to frame).
   */
  mSlotX: 0.14,
  mSlotY: -0.06,
  mSlotW: 0.235,
} as const;

export type BrandIntroPhase =
  | 'idle'
  | 'slamming'
  | 'holding'
  | 'docking'
  | 'settled'
  | 'loginRevealing'
  | 'complete'
  | 'skipped';

export type BrandIntroMode = 'full' | 'short' | 'reduced';

let nextIntroMode: BrandIntroMode | 'full' = 'full';
let completedOnceThisSession = false;

export function consumeBrandIntroMode(
  reduceMotion: boolean,
  opts?: { allowDevFull?: boolean },
): BrandIntroMode {
  const allowDevFull = opts?.allowDevFull !== false;
  if (allowDevFull && typeof __DEV__ !== 'undefined' && __DEV__) {
    return 'full';
  }
  if (reduceMotion) return 'reduced';
  return nextIntroMode === 'full' && !completedOnceThisSession ? 'full' : 'short';
}

export function markBrandIntroCompleted(): void {
  completedOnceThisSession = true;
  nextIntroMode = 'short';
}

export function requestShortBrandIntro(): void {
  nextIntroMode = 'short';
  completedOnceThisSession = true;
}

export function resetBrandIntroSessionFlags(): void {
  nextIntroMode = 'full';
  completedOnceThisSession = false;
}

export function brandIntroTotalMs(mode: BrandIntroMode): number {
  if (mode === 'reduced') return brandIntroTimeline.reducedFadeMs;
  if (mode === 'short') return brandIntroTimeline.shortRevealMs;
  const t = brandIntroTimeline;
  // Veil / form reveal overlap the dock; total is slam+hold+max(dock, reveal lag + settle)
  const revealLag = Math.round(t.dockMs * 0.12);
  const afterDockStart = Math.max(t.dockMs, revealLag + t.settleMs) + 420;
  return t.veilHold + t.slamMs + t.holdMs + afterDockStart;
}
