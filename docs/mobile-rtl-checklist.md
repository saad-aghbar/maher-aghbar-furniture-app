# Mobile RTL checklist

**Date:** 2026-08-05  
**Locales:** `ar` (RTL), `he` (RTL), `en` (LTR)  
**Helpers:** `mirrorStyle`, `flexDirectionFor`, `AppText`, `BackButton`, `DirectionalIcon`

Use this before shipping any mobile screen that users will see in Arabic or Hebrew.

---

## Layout direction

| Check | Pass criteria |
|-------|----------------|
| Root direction | `getDirection(locale)` matches expected (`rtl` for ar/he) |
| Row layouts | Leading/trailing use `flexDirection: isRTL ? 'row-reverse' : 'row'` or start/end APIs — not hardcoded left/right only |
| Padding | Prefer logical spacing; avoid “paddingLeft for back button” without RTL twin |
| Absolute position | `left`/`right` swapped or use `start`/`end` where supported |
| Native flip | After first RTL↔LTR switch, confirm or document app reload if chrome is wrong |

## Text

| Check | Pass criteria |
|-------|----------------|
| Alignment | Body copy aligns start (right in RTL) via `AppText` |
| Writing direction | `writingDirection` matches locale on primary text |
| Truncation | Ellipsis still readable in RTL |
| Mixed content | Order IDs + Arabic/Hebrew labels render without broken glyph order (`mobile.mixedSample` pattern) |
| Typography | Use design-system variants; no sub-13px captions for primary UI |

## Icons and navigation

| Check | Pass criteria |
|-------|----------------|
| Back chevron | Mirrored in RTL (`DirectionalIcon` / `BackButton`) |
| Forward / external-link arrows | Mirrored when directional |
| Non-directional icons | **Not** mirrored (search, settings, checkmarks) |
| Tab bar order | Follows leading→trailing in locale direction |
| Stack header back | Matches mirrored affordance |

## Lists, forms, media

| Check | Pass criteria |
|-------|----------------|
| List item chevrons | Mirror when meaning “go forward” |
| Form labels | Above or start-aligned fields; errors under fields |
| Swipe actions | Leading/trailing actions swapped appropriately or disabled if unsafe |
| Progress / steppers | Fill direction matches locale or stay LTR if industry-standard for numbers |

## Formatters

| Check | Pass criteria |
|-------|----------------|
| Dates | `formatDate` / `formatDateTime` for `ar` / `en` / `he` |
| Numbers | Locale grouping/digits acceptable |
| Currency | JOD via `formatCurrency` |
| Relative strings | Interpolation keys from i18n (`relativeDueIn`, etc.) |

## QA matrix

For each new screen, exercise:

1. **ar** — RTL, Arabic copy, mirrored back  
2. **en** — LTR, English copy  
3. **he** — RTL, Hebrew copy, mirrored back  
4. Switch **ar → en → he** at runtime without crash; confirm persistence after cold start  

Boot demo (`app/index.tsx`) is the reference for language chips + formatters + back mirror.

## Anti-patterns

- Hardcoded `textAlign: 'left'` on body text  
- `marginLeft` for “indent after icon” without RTL variant  
- Flipping every icon including logos and status symbols  
- Embedding English-only sentences in Arabic screens without translation keys  
