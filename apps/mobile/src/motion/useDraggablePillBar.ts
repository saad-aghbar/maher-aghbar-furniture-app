import { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  Easing,
  runOnJS,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { selection as hapticSelection } from '@/motion/haptics';
import { springs } from '@/motion/presets';

export type PillLayout = { x: number; width: number };

const DRAG_SPRING = { damping: 20, stiffness: 110, mass: 1.15 } as const;
const LONG_PRESS_MS = 160;

function nearestIndex(fingerX: number, xs: number[], ws: number[]): number {
  'worklet';
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < xs.length; i++) {
    const w = ws[i];
    const x = xs[i];
    if (w == null || x == null || w <= 0) continue;
    const center = x + w / 2;
    const d = Math.abs(center - fingerX);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** Lerp pill x/width so the bubble tracks the finger between chip centers. */
function scrubPill(
  fingerX: number,
  xs: number[],
  ws: number[],
): { x: number; width: number; index: number } {
  'worklet';
  const n = xs.length;
  if (n === 0) return { x: 0, width: 0, index: 0 };

  const centers: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = xs[i] ?? 0;
    const w = ws[i] ?? 0;
    centers.push(x + w / 2);
  }

  const first = centers[0]!;
  const last = centers[n - 1]!;
  const lo = Math.min(first, last);
  const hi = Math.max(first, last);
  const clamped = Math.min(hi, Math.max(lo, fingerX));

  // Walk segments in visual order (centers may be LTR or RTL)
  let i0 = 0;
  let i1 = 0;
  for (let i = 0; i < n - 1; i++) {
    const a = centers[i]!;
    const b = centers[i + 1]!;
    const minC = Math.min(a, b);
    const maxC = Math.max(a, b);
    if (clamped >= minC && clamped <= maxC) {
      i0 = i;
      i1 = i + 1;
      break;
    }
    i0 = i;
    i1 = i + 1;
  }

  const c0 = centers[i0]!;
  const c1 = centers[i1]!;
  const span = c1 - c0;
  const t = Math.abs(span) < 0.5 ? 0 : (clamped - c0) / span;
  const width = ws[i0]! + (ws[i1]! - ws[i0]!) * t;
  const x = clamped - width / 2;
  const index = nearestIndex(clamped, xs, ws);
  return { x, width, index };
}

type Options = {
  /** Ordered layouts matching option order (visual / data order). */
  layouts: Array<PillLayout | undefined>;
  activeIndex: number;
  onSelectIndex: (index: number) => void;
  /** Fires while scrubbing (index) and `null` when the drag ends. */
  onScrubIndexChange?: (index: number | null) => void;
  reduceMotion: boolean;
  enabled?: boolean;
  spring?: { damping: number; stiffness: number; mass: number };
  /** When set, snap/layout uses ease-out timing instead of spring. */
  timing?: { duration: number };
};

export type DraggablePillBar = {
  pillX: SharedValue<number>;
  pillW: SharedValue<number>;
  dragging: SharedValue<number>;
  /** Nearest option index while scrubbing (and after snap). */
  hoverIndex: SharedValue<number>;
  gesture: ReturnType<typeof Gesture.Pan>;
};

/**
 * Press-and-hold, then drag to scrub a sliding pill across fixed chip layouts.
 * Releases snap to the nearest option with a soft spring.
 */
export function useDraggablePillBar({
  layouts,
  activeIndex,
  onSelectIndex,
  onScrubIndexChange,
  reduceMotion,
  enabled = true,
  spring = DRAG_SPRING,
  timing,
}: Options): DraggablePillBar {
  const pillX = useSharedValue(0);
  const pillW = useSharedValue(0);
  const dragging = useSharedValue(0);
  const hoverIndex = useSharedValue(Math.max(0, activeIndex));
  const activeIndexSV = useSharedValue(Math.max(0, activeIndex));
  const timingMs = useSharedValue(timing?.duration ?? 0);
  /** Native RTL mirrors translateX; onLayout.x stays physical-from-left. */
  const txMirror = useSharedValue(I18nManager.isRTL ? -1 : 1);

  const layoutXs = useSharedValue<number[]>([]);
  const layoutWs = useSharedValue<number[]>([]);

  useEffect(() => {
    timingMs.value = timing?.duration ?? 0;
  }, [timing, timingMs]);

  useEffect(() => {
    txMirror.value = I18nManager.isRTL ? -1 : 1;
  }, [txMirror]);

  useEffect(() => {
    activeIndexSV.value = Math.max(0, activeIndex);
  }, [activeIndex, activeIndexSV]);

  useEffect(() => {
    layoutXs.value = layouts.map((l) => l?.x ?? 0);
    layoutWs.value = layouts.map((l) => l?.width ?? 0);
  }, [layoutWs, layoutXs, layouts]);

  useEffect(() => {
    if (dragging.value) return;
    hoverIndex.value = Math.max(0, activeIndex);
    const target = layouts[activeIndex];
    if (!target || target.width <= 0) return;
    const x = target.x * txMirror.value;
    if (reduceMotion) {
      pillX.value = x;
      pillW.value = target.width;
      return;
    }
    if (timing) {
      const cfg = {
        duration: timing.duration,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      };
      pillX.value = withTiming(x, cfg);
      pillW.value = withTiming(target.width, cfg);
      return;
    }
    pillX.value = withSpring(x, spring);
    pillW.value = withSpring(target.width, spring);
  }, [
    activeIndex,
    dragging,
    hoverIndex,
    layouts,
    pillW,
    pillX,
    reduceMotion,
    spring,
    timing,
    txMirror,
  ]);

  const select = (index: number) => {
    onSelectIndex(index);
  };

  const scrubNotify = (index: number | null) => {
    onScrubIndexChange?.(index);
  };

  const buzz = () => {
    void hapticSelection();
  };

  const gesture = Gesture.Pan()
    .enabled(enabled && !reduceMotion)
    .activateAfterLongPress(LONG_PRESS_MS)
    .failOffsetY([-24, 24])
    .onStart(() => {
      dragging.value = 1;
      hoverIndex.value = activeIndexSV.value;
      runOnJS(buzz)();
      runOnJS(scrubNotify)(activeIndexSV.value);
    })
    .onUpdate((e) => {
      const xs = layoutXs.value;
      const ws = layoutWs.value;
      if (xs.length === 0) return;
      const next = scrubPill(e.x, xs, ws);
      // Follow the finger immediately — lag feels wrong on fast scrubs
      pillX.value = next.x * txMirror.value;
      pillW.value = next.width;
      if (next.index !== hoverIndex.value) {
        hoverIndex.value = next.index;
        runOnJS(buzz)();
        runOnJS(scrubNotify)(next.index);
      }
    })
    .onEnd(() => {
      const xs = layoutXs.value;
      const ws = layoutWs.value;
      const physicalX = pillX.value * txMirror.value;
      const idx = nearestIndex(physicalX + pillW.value / 2, xs, ws);
      const tx = (xs[idx] ?? 0) * txMirror.value;
      const tw = ws[idx] ?? 0;
      const ms = timingMs.value;
      if (ms > 0) {
        const cfg = { duration: ms, easing: Easing.bezier(0.4, 0, 0.2, 1) };
        pillX.value = withTiming(tx, cfg);
        pillW.value = withTiming(tw, cfg);
      } else {
        pillX.value = withSpring(tx, spring);
        pillW.value = withSpring(tw, spring);
      }
      dragging.value = 0;
      hoverIndex.value = idx;
      // Keep scrub highlight on the snapped tab until the route catches up
      runOnJS(scrubNotify)(idx);
      runOnJS(select)(idx);
    })
    .onFinalize(() => {
      dragging.value = 0;
    });

  return { pillX, pillW, dragging, hoverIndex, gesture };
}

/** Soft settle used when not dragging (tap select). */
export const pillBarSpring = springs.gentle;
