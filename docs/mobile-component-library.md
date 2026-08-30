# Mobile component library

**Date:** 2026-08-05  
**Code:** [`apps/mobile/src/components/`](../apps/mobile/src/components)  
**Design tokens:** [mobile-design-system.md](./mobile-design-system.md)  
**Motion:** [mobile-motion-system.md](./mobile-motion-system.md)

Foundational React Native UI for Maher mobile. Presentational only — no production feature screens here.

---

## Principles

1. Semantic colors via `useTheme()` — never hex in components.
2. Touch targets ≥ `theme.sizes.touch.min` (44).
3. RTL via `useLocale` / `AppText` / `DirectionalIcon` — no hardcoded left/right for layout.
4. Motion via `@/motion` (`AnimatedPressable`, `SkeletonShimmer`, `BottomSheetTransition`, haptics).
5. Shared style helpers (`buttonStyles`, `badgeStyles`) — no duplicated chrome.
6. Interactive controls need `accessibilityRole` + `accessibilityLabel`.

---

## Inventory

| Group | Exports |
|-------|---------|
| Text / nav | `AppText`, `BackButton`, `DirectionalIcon` |
| Screens | `AppScreen`, `ScrollableScreen`, `KeyboardAwareScreen` |
| Headers | `AppHeader`, `LargeTitleHeader`, `SectionHeader`, `Divider` |
| Buttons | `PrimaryButton`, `SecondaryButton`, `TertiaryButton`, `DestructiveButton`, `IconButton` |
| Badges | `StatusBadge`, `PriorityBadge` |
| Surfaces | `SurfaceCard` |
| Feedback | `EmptyState`, `ErrorState`, `SkeletonLoader`, `ToastProvider` / `useToast`, `OfflineBanner`, `NetworkStatus`, `LoadingOverlay` |
| Sheets | `BottomSheet`, `ConfirmationSheet`, `ActionSheet` |
| Network | `NetworkProvider`, `useNetwork` |

Import from `@/components`.

---

## Providers

`AppProviders` order: SafeArea → Locale → Theme → **Network** → **Toast** → Query.

---

## Dev preview

- Route: `/dev/tests` (hub) and `/dev/tests/[id]` (inspector)
- Entry: More / Account / Profile → **Dev tests** above Sign out (`__DEV__` only)
- Gated by `app/dev/_layout.tsx` (`!__DEV__` → redirect `/`)
- Docs: [DEV-FRONTEND-COMPONENT-LAB.md](./DEV-FRONTEND-COMPONENT-LAB.md)
- Boot screen links to the gallery in development only

### Visual checklist (manual)

1. Open Expo → boot → **Component preview**.
2. Toggle theme light/dark; locale AR / EN / HE — buttons, badges, headers mirror correctly.
3. Confirm press scale on buttons/cards; toast slide; sheet open/dismiss via backdrop.
4. Force airplane mode — OfflineBanner + NetworkStatus update.
5. VoiceOver/TalkBack: buttons and IconButton announce labels; toast is polite live region.

---

## Anti-patterns

- Importing `@maher/ui` DOM components into RN
- Hardcoded durations outside motion presets
- `sm` primary buttons under 44pt
- Animating entire feature screens for polish
- Duplicating button/badge color maps outside helpers

---

## Tests

```bash
pnpm mobile:typecheck
pnpm mobile:lint
pnpm mobile:test
```

Unit coverage focuses on style helpers, status maps, toast queue, and network visibility helpers.
