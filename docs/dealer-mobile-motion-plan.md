# Dealer Mobile Motion Plan

## Principles

- Premium, restrained, 60 FPS.
- Reuse `@/motion`: `ListItemEnter`, `softFadeDown` / `softFadeSide`, `AnimatedPressable`, `CountUp`, `haptics`, `useReducedMotion`.
- No bounce-everywhere, no constant rotation, no spring overshoot on lists.

## Primitives (dealer)

| Primitive | Use |
|-----------|-----|
| `dealerFabPress` | Center + scale + haptic |
| `dealerHeroParallax` | 2.5D depth layers (disabled if reduce-motion) |
| `dealerCarouselSnap` | Horizontal section carousels |
| Soft page enters | Screen mounts |
| Pill scrub | Filter chips (existing `useDraggablePillBar`) |
| Upload fade/scale | Attachment thumbnails |
| Progress fill | Order % / stage connectors |
| Skeleton shimmer | Loading boards |
| Theme crossfade | Light ↔ dark |

## Per-flow motion budget (2–3 intentional)

- **Home:** hero parallax OR soft fade; card enters; FAB press.
- **Catalog:** card press scale; image fade-in; filter sheet.
- **PDP:** hero parallax light; sticky CTA; gallery swipe.
- **New Order:** step fade; upload success check; sticky Continue press.
- **Orders:** list enter; progress ring; status change.
- **Finance:** board enter; amount CountUp once.

## Reduced motion

When `useReducedMotion()`: skip parallax, use opacity-only fades, snap FAB without spring, no shimmer loops.
