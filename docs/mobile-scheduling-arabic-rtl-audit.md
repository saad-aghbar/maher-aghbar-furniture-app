# Mobile Scheduling Arabic / RTL audit

Date: 2026-08-15  
Scope: Mobile Scheduling presentation + localization only. No planner, capacity math, conflict detect/resolve, bottlenecks, API, Admin Web, or English visual redesign.

## Conventions (locked)

| Rule | Choice | Evidence |
|------|--------|----------|
| Calendar | Gregorian only | Factory dates are Gregorian; do not switch calendar systems |
| Date language | Locale month/weekday names | EN `15 Aug 2026`; AR `15 أغسطس 2026`; HE Hebrew months |
| Numerals | Latin `0123456789` | `apps/mobile/src/i18n/format.ts`, CountUp, format tests. Do not introduce `٠١٢٣` |
| Number separators | Western `1,112.93` | Same formatter; Arabic/Hebrew ICU grouping renders as gaps |
| Identifiers | Exact Latin, LTR island | `PO-2026-00032` is a code, not prose |
| Time ranges | Chronological `start–end` as one Latin run | `10:38–13:11` must not reverse in RTL |
| Durations | i18n plurals for overlap; abbreviated `h`/`س` for compact capacity | Capacity tiles match worker-home `س`/`د`; conflict cards need full phrases |
| BiDi | `isolateLtr` only inside formatters; `AppText dir` in components | Do not scatter LRM/RLM in JSX |
| Localized dates | Do **not** wrap Arabic/Hebrew month strings in `isolateLtr` | LRI is for Latin-only runs |

## Surface checklist

| Surface | File | Arabic issue |
|---------|------|----------------|
| Scheduling home stats | `AdminSchedulingScreen.tsx` `StatChip` | Compact chip inverts value `textAlign` in RTL so the number sits opposite the label |
| Month board header | `calendarMath.ts` `monthLabel` | Always `August 2026` |
| Month weekday row | `MonthCalendar.tsx` | Already i18n `mobile.calendar.weekdays.*` |
| Day numbers | `MonthCalendar.tsx` | Latin digits via `String(day)` — correct |
| Month prev/next | `MonthCalendar.tsx` | `row-reverse` + swapped chevrons — verify not double-mirrored |
| Calendar legend | `CalendarLegend.tsx` | Labels i18n; no numbers |
| Day orders title | `AdminSchedulingScreen.tsx` | `formatDate` → English `Aug` |
| Order cards | `ScheduleOrderRow` | PO uses `dir="ltr"`; dates via `ScheduleExplanation` |
| Schedule dates | `ScheduleExplanation.tsx` | `formatDate` English months; values forced `dir="ltr"` (wrong once month is Arabic) |
| Factory Capacity header | `FactoryCapacitySection.tsx` | Weekday i18n + English `formatDate` |
| Factory load / metrics | `Metric` | `%` / counts `dir="ltr"` — keep for Latin runs; attach value to label |
| Stage capacity cards | `FactoryCapacityCard.tsx` | Hours/`%` via i18n (`{hours} س`) — OK if numbers stay Latin |
| Week heatmap | `FactoryCapacityWeekRow.tsx` | Weekday i18n; percent `dir="ltr"` |
| Bottlenecks | `FactoryCapacitySection.tsx` | Count badge Latin; state labels i18n |
| Capacity detail / workers | `FactoryCapacityDetailSheet.tsx` | Hours `dir="ltr"`; worker names mixed Latin |
| Conflicts list | `ConflictFocusRow` | Mixed Arabic + Latin + PO + range in one chip; duration `{hours}h {minutes}m` |
| Conflict review / resolve | `AdminScheduleSheets.tsx` | Same clock/duration/PO issues |
| Day capacity / overtime | `AdminDayExceptionSheet` | Title via `formatDate`; times `dir="ltr"` (correct) |
| Empty / error / offline | various | Keys exist; no English fallback expected |
| Production schedule strip | `AdminScheduleStrip.tsx` | Presentation-only via `ScheduleExplanation` |

## Root causes

1. **`formatDate` / `formatDateTime` hardcode `en-GB` months** for every locale, then wrap the English string in LRI for ar/he. Tests in `format.test.ts` currently *require* `Aug` and forbid `أغسطس`.
2. **`monthLabel()` has no locale** — month navigator cannot show Arabic/Hebrew month names.
3. **No canonical time-range or identifier helper** — cards concatenate `{start}–{end}` and PO numbers into Arabic sentences.
4. **`selectConflictClock` ignores `locale`** and never isolates the clock.
5. **StatChip RTL `textAlign` inversion** — compact value uses `isRTL ? 'left' : 'right'`, so Arabic numbers float to the opposite edge from the caption.
6. **ScheduleExplanation `dir="ltr"` on all values** — correct for Latin dates, incorrect for `15 أغسطس 2026`.
7. **Overlap duration key** `"{hours} س {minutes} د"` is abbreviated; English-style `2h 33m` still appears when the English key is interpolated from JS parts without the Arabic template, and AR still reads as units rather than phrases.
8. **Overlap MetaChip** builds `` `${t('overlap')} ${overlap}` `` — one string mixing Arabic label + Latin range.
9. **Arabic order terminology** mixes طلب / طلبات / طلبية / طلبيات on the same scheduling surfaces.
10. **Bare `YYYY-MM-DD` passed to `new Date()`** is UTC midnight and can shift the calendar day in some timezones.

## Out of scope (unchanged)

Planner, `listCapacity` working minutes, conflict detect/resolve, bottleneck ranking, production/inventory/DB, Admin Web, bottom nav, permissions, English card layout, Arabic-Indic digits, non-Gregorian calendars.
