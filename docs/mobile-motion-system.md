# Mobile motion system

**Date:** 2026-08-05  
**Code:** [`apps/mobile/src/motion/`](../apps/mobile/src/motion)  
**Design tokens:** [mobile-design-system.md](./mobile-design-system.md)

Reusable motion on **React Native Reanimated** + **Gesture Handler** pressables. Purpose: press feedback, list entrance, sheets, status, progress, skeleton, success, shake, tab indicator — **not** random full-screen animation.

---

## Principles

1. Prefer **2–3 intentional motions** per flow.
2. **Low overshoot** springs only (`press` / `snappy` / `gentle` / `success`).
3. Respect **Reduce Motion** — instant layout, no shimmer loops, no press scale.
4. Haptics reinforce confirmation; they do not replace visual feedback.
5. No gradients-as-motion, perpetual content shimmer, or high-bounce chrome.

---

## Durations

| Token | ms | Use |
|-------|-----|-----|
| `press` | 120 | Button/card release |
| `micro` | 150 | Expand, progress, status |
| `chip` | 180 | Tab indicator / chips |
| `cardEnter` | 220 | Fade/slide/list enter |
| `screen` | 280 | Screen-level (when used) |
| `sheet` | 300 | Bottom sheet drivers |
| `success` | 550 | Success burst |

Helper: `withMotionDuration(ms, reduceMotion)` → `0` when reduced.

---

## Springs

| Token | damping / stiffness | Use |
|-------|---------------------|-----|
| `press` | 28 / 400 | Press scale |
| `snappy` | 26 / 280 | Quick UI |
| `gentle` | 22 / 180 | Settle |
| `success` | 20 / 220 | Success burst |

---

## Reduced motion

```tsx
import { useReducedMotion, withMotionDuration, durations } from '@/motion';

const reduce = useReducedMotion();
const d = withMotionDuration(durations.cardEnter, reduce);
```

When `reduce` is true: skip springs/shimmer; opacity/translate jump to final; press scale stays `1`.

---

## Haptics

```ts
import { haptics } from '@/motion';

await haptics.selection();       // chips / tabs
await haptics.confirmLight();    // minor confirm
await haptics.confirmMedium();   // primary save
await haptics.completeStrong();  // task done
await haptics.error();           // validation fail
```

Safe no-op on unsupported platforms.

---

## Primitives

| Export | Role |
|--------|------|
| `AnimatedPressable` | Scale press (`button` 0.97 / `card` 0.985) |
| `FadeIn` / `SlideIn` | Enter transitions |
| `ListItemEnter` | Staggered list entrance |
| `ExpandCollapse` | Height expand/collapse |
| `BottomSheetTransition` | `translateY` + backdrop drivers (not full sheet UI) |
| `StatusTransition` | Crossfade on `statusKey` |
| `ProgressBar` | Animated 0–1 width |
| `SkeletonShimmer` | Loading shimmer (static if reduced) |
| `SuccessBurst` | Scale success + optional haptic |
| `FormShake` | Invalid field shake + error haptic |
| `TabIndicator` | Animated underline position/width |

### Example

```tsx
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';

<AnimatedPressable
  variant="button"
  onPress={() => {
    void haptics.confirmMedium();
  }}
>
  <Text>Save</Text>
</AnimatedPressable>

<ListItemEnter index={i}>
  <Row />
</ListItemEnter>
```

---

## Anti-patterns

- Animating entire screens “for polish”
- Looping shimmer on real content
- High-bounce springs on navigation chrome
- Ignoring Reduce Motion
- Hardcoded durations outside `presets.ts`

---

## Tests

```bash
pnpm mobile:test
```

Covers presets ranges, reduced-motion helpers, and haptics mapping (mocked).
