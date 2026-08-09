# Mobile design system

**Date:** 2026-08-05  
**Code:** [`apps/mobile/src/theme/`](../apps/mobile/src/theme)  
**Brand source:** [brand.md](./brand.md), [`packages/ui/src/tokens.css`](../packages/ui/src/tokens.css)  
**Architecture:** [mobile-architecture.md](./mobile-architecture.md)

Restrained premium mobile UI: Shopify commerce clarity, Linear hierarchy, Apple spacing. Army Camo brand on Apple White / Liquorice — **not** generic ERP chrome.

---

## Principles

1. **Semantic access only** — screens use `useTheme().colors.*`, never raw `#hex` / `rgb()`.
2. **Three font weights max** — `regular` (400), `medium` (500), `semibold` (600). No 700+.
3. **Borders over shadows** — elevation is rare (sheets / FABs). Prefer `colors.border` hairlines.
4. **No** decorative gradients, glassmorphism, neumorphism, glow stacks, or dense dashboard chrome.
5. **Touch targets** ≥ `theme.sizes.touch.min` (44).

---

## Setup

`ThemeProvider` wraps the app inside `AppProviders`. Mode: `light` | `dark` | `system` (default), persisted in SecureStore key `maher.theme`.

```tsx
import { useTheme } from '@/theme';

function Example() {
  const { colors, theme, mode, setMode } = useTheme();
  return (
    <View style={{ backgroundColor: colors.background, padding: theme.spacing.lg }}>
      <Text style={[theme.typography.variants.headline, { color: colors.textPrimary }]}>
        Title
      </Text>
    </View>
  );
}
```

---

## Colors

| Token | Role |
|-------|------|
| `background` | App canvas |
| `surface` | Elevated card / sheet |
| `surfaceSecondary` | Nested / muted panel |
| `textPrimary` / `textSecondary` / `textMuted` | Hierarchy |
| `border` / `borderStrong` | Hairlines |
| `brand` / `brandHover` / `brandActive` / `brandSoft` | Army Camo accent |
| `onBrand` | Text/icons on brand fills |
| `success` / `warning` / `error` / `info` (+ `*Soft`) | Status |
| `disabled` / `disabledFill` | Disabled controls |
| `overlay` | Modal scrim |

Light canvas `#E1DFD3`, dark Liquorice `#1E1A1B`. Dark brand lifts to `#A8906C`.

---

## Typography

Readable hierarchy for older / non-technical users. **Three weights only:** regular 400, medium 500, semibold 600.

| Variant | Size / line | Default weight | Use |
|---------|-------------|----------------|-----|
| `display` | 34 / 40 | semibold | Rare hero |
| `largeTitle` | 28 / 34 | semibold | Screen titles |
| `title` | 22 / 28 | semibold | Section titles |
| `heading` | 18 / 24 | semibold | Card / list headers |
| `body` | 17 / 24 | regular | Primary reading |
| `bodySecondary` | 15 / 22 | regular | Supporting |
| `caption` | 13 / 18 | medium | Meta |
| `label` | 15 / 20 | medium | Form labels / buttons |

Use `AppText` with `variant` + locale-aware alignment. Override weight only with `theme.typography.weights.*`.

System UI fonts for Latin / Hebrew; **KO Sans** for Arabic (`apps/mobile/assets/fonts/`, loaded in `FontProvider`). See [brand.md](./brand.md) and [mobile-localization.md](./mobile-localization.md).

---

## Spacing / radius / sizes

**Spacing:** `none` 0 → `2xs` 2 → `xs` 4 → `sm` 8 → `md` 12 → `lg` 16 → `xl` 20 → `2xl` 24 → `3xl` 32 → `4xl` 40 → `5xl` 48 → `6xl` 64.

**Radius:** `none`, `sm` 6, `md` 10, `lg` 14, `xl` 20, `full`.

**Icons:** `sm` 16, `md` 20, `lg` 24, `xl` 28.

**Touch:** `min` 44.

---

## Elevation

| Level | Use |
|-------|-----|
| `none` | Default lists / screens |
| `rest` | Subtle resting card (prefer border) |
| `raised` | Floating action / modal |

Spread into style: `{ ...theme.elevation.rest }`.

---

## Motion

Theme tokens (`duration.fast|normal|slow`, easing, springs) live in `src/theme/motion.ts`.

**UI motion primitives** (press, list enter, sheet drivers, shimmer, shake, tab indicator, haptics, reduced motion) live in [`apps/mobile/src/motion`](../apps/mobile/src/motion) — see **[mobile-motion-system.md](./mobile-motion-system.md)**.

Keep motion purposeful (2–3 intentional motions per flow). No perpetual shimmer chrome. Always respect Reduce Motion.

---

## Hard rules (code review)

```tsx
// BAD
<View style={{ backgroundColor: '#fff', padding: 17, fontWeight: '700' }} />

// GOOD
const { colors, theme } = useTheme();
<View
  style={{
    backgroundColor: colors.surface,
    padding: theme.spacing.lg,
  }}
>
  <Text
    style={[
      theme.typography.variants.body,
      { color: colors.textPrimary, fontWeight: theme.typography.weights.semibold },
    ]}
  >
    Label
  </Text>
</View>
```

| Forbidden in feature UI | Required instead |
|-------------------------|------------------|
| `#RRGGBB`, `rgb()`, `rgba()` literals | `colors.*` |
| Magic `padding: 13` | `theme.spacing.*` |
| `fontSize: 15` one-offs | `theme.typography.variants.*` |
| `fontWeight: '700'` / `'bold'` | `weights.regular\|medium\|semibold` |
| Multi-layer colored shadows / blur glass | `border` + optional `elevation.rest\|raised` |
| Linear gradients as brand fill | Solid `colors.brand` / surfaces |

Token **definition** files under `src/theme/` may contain hex — that is the only place.

---

## Files

| File | Contents |
|------|----------|
| `types.ts` | Theme types |
| `colors.ts` | Light / dark maps |
| `typography.ts` | Weights + variants |
| `spacing.ts` / `radius.ts` / `sizes.ts` | Scales |
| `elevation.ts` / `motion.ts` | Shadows + timing |
| `themes.ts` | `createTheme` |
| `ThemeProvider.tsx` / `useTheme.ts` | Runtime |
| `index.ts` | Public API |

Boot screen (`app/index.tsx`) cycles theme mode to verify light/dark — not a product feature.

---

## Component library

Foundational RN primitives live in [`apps/mobile/src/components/`](../apps/mobile/src/components). See **[mobile-component-library.md](./mobile-component-library.md)**.

Dev gallery: `/dev/components` (`__DEV__` only).

---

## Out of scope (later)

Custom font loading, Storybook / Chromatic, production feature screens.
