# Mobile Scheduling Arabic / RTL — final report

Date: 2026-08-15  
Scope: Presentation + localization only. Planner, capacity math, conflict detect/resolve, bottlenecks, API, Admin Web, and English layout were not changed.

## Issues found → fixed

| Issue | Root cause | Fix |
|-------|------------|-----|
| `15 Aug 2026` in Arabic cards | `formatDate` hardcoded `en-GB` months | Locale `Intl` months; Latin digits; no LRI on native-script dates |
| Month board `August 2026` | `monthLabel()` English-only | `monthLabel(y, m, locale)` / `formatMonthYear` |
| `2h 33m` in Arabic | English duration template / JS parts | `formatDuration` + AR plural phrases |
| Time range can reverse | `{start}–{end}` without isolation | `formatTimeRange` isolates the whole Latin run |
| PO numbers in mixed strings | Concatenated into Arabic chips | PO chips `dir="ltr"`; overlap label + range as two nodes |
| Stat number detached from label | Compact `textAlign: isRTL ? 'left' : 'right'` | Compact value always `textAlign: 'right'` + `dir="ltr"` so EN stays end-aligned and AR sits with the caption |
| Date rows forced LTR | `ScheduleExplanation` `dir="ltr"` on all values | Dates `dir="auto"`; Latin measures stay `dir="ltr"` |
| UTC YMD shift | `new Date('2026-08-16')` is UTC midnight | `parseDisplayDate` treats bare YMD as local |
| Mixed طلب / طلبية | Inconsistent AR copy | Visible scheduling strings standardized toward **طلبية / طلبيات** |

## Helpers

| Helper | File | Behavior |
|--------|------|----------|
| `formatDate` / `formatDateTime` | `apps/mobile/src/i18n/format.ts` | Gregorian; EN `15 Aug 2026`; AR `15 أغسطس 2026`; HE Hebrew months; Latin digits; **no** full-string LRI |
| `formatDateLatn` | same | English months (search / machine) |
| `formatMonthYear` / `monthLabel` | format.ts / `calendarMath.ts` | Locale long month + year |
| `toClockHm` / `formatTime` / `formatTimeRange` | format.ts | 24h `HH:mm`; range is one isolated Latin run |
| `formatIdentifier` | format.ts | Exact `PO-2026-00032` + LRI in ar/he |
| `formatPercent` / `formatCompactHours` / `formatCompactHoursOf` | format.ts | Number+unit stay together (`29%` / `29٪`, `14h` / `14 س`) |
| `formatDuration` | format.ts | EN `2h 33m`; AR `ساعتان و33 دقيقة`; HE Hebrew forms |
| `isolateLtr` | format.ts | **Only inside formatters**, Latin-only runs |
| `AppText dir` | components | `ltr` for identifiers/times/metrics; `auto` for Arabic/Hebrew prose and dates |

`selectConflictClock` now delegates to `formatTime`.

## Conventions

- **Numerals:** Latin `0123456789` everywhere (established Mobile rule). Not Arabic-Indic.
- **Dates:** Gregorian, locale month/weekday names. English screens still show `Aug` / `August 2026`.
- **Time ranges:** Chronological `10:38–13:11` as one LTR island (U+2013 dash).
- **Identifiers:** Never translated; `dir="ltr"` and/or `isolateLtr`.
- **BiDi:** No extra LRM/RLM in JSX.

## Components changed

- `apps/mobile/src/i18n/format.ts`, `index.ts`
- `apps/mobile/src/components/calendar/calendarMath.ts`, `MonthCalendar.tsx`
- `apps/mobile/src/features/scheduling/AdminSchedulingScreen.tsx` (StatChip, order qty, conflict cards)
- `ScheduleExplanation.tsx`, `AdminScheduleSheets.tsx`
- `FactoryCapacitySection.tsx`, `FactoryCapacityCard.tsx`, `FactoryCapacityWeekRow.tsx`, `FactoryCapacityDetailSheet.tsx`
- `selectScheduleDates.ts`
- i18n `en` / `ar` / `he` `mobile.json`
- Tests under `apps/mobile/src/i18n/__tests__`, calendar, scheduling selectors

English card structure, colors, and capacity/conflict math are unchanged.

## Translation keys

Added under `mobile.adminScheduling.duration.*` (Zero/One/Two/Few/Many + `hoursAndMinutes`) and `qtyZero|One|Two|Few|Many`.

Updated: `normalShift`, `movedTo`, `resolveSuccessMoved` to interpolate a pre-isolated `{range}`.

Arabic copy on the scheduling home (day title, empties, view-all, focus chips) uses **طلبيات**.

## Calendar navigation

`MonthCalendar` uses `row-reverse` **and** swapped chevron names in RTL. That is **not** a double-mirror: previous sits on the start (right) and points right; next sits on the end (left) and points left. Chronological handlers (`shift(-1)` / `shift(+1)`) are unchanged. Monday-first grid still mirrors with the weekday row.

## Tests

- Arabic date contains `أغسطس`, not `Aug`; Latin digits; no LRI on the date string
- Hebrew date uses Hebrew months, not Arabic, not `Aug`
- English date still `Aug`
- Bare `2026-08-16` formats as the 16th locally
- `formatTimeRange` keeps `10:38` before `13:11` after stripping isolates
- `PO-2026-00032` survives isolation
- Duration plurals en/ar/he
- `monthLabel` locale
- Conflict type + capacity state keys never equal raw enums
- i18n key parity (en/ar/he) including new duration keys
- Existing scheduling selector tests still pass

`pnpm --filter @maher/mobile typecheck` passed. `@maher/i18n` rebuilt so Jest `dist` messages include the new keys.

## Visual matrix

| Surface | AR light/dark | EN | HE |
|---------|---------------|----|----|
| Home stats + month board | Code: locale month, StatChip alignment, weekday i18n | Unchanged EN months | Hebrew months |
| Factory Capacity / bottlenecks / detail | `%`/`س` isolated; closed/full labels not forced LTR | `14h` / `29%` | Hebrew units |
| Orders + `ScheduleExplanation` | Arabic dates, auto direction | English dates | Hebrew dates |
| Conflicts list/review/resolve | Split overlap chip; duration phrases; PO LTR | `2h 33m`, `10:38–13:11` | Hebrew duration |
| Day capacity / overtime | Isolated shift range; Arabic extra-hours sentence | Same stepper | Same |
| Empty/error/offline | Existing AR keys | Existing EN | Existing HE |

No new hardcoded colors. Cards wrap (`flexWrap`, `numberOfLines` removed only where Arabic must grow). Live device screenshots were not captured in this session; reload the running Metro app and switch AR/EN/HE + light/dark to confirm on a narrow iPhone.

## EN / HE regression

- EN formatters and compact StatChip (`textAlign: 'right'`) match the approved English board.
- HE uses Hebrew month/duration rules, not Arabic dual forms, and the same RTL direction helpers.
