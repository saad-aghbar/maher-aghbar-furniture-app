# Production Scheduling — UI Map

## Admin Web

| Route / area | Purpose |
|---|---|
| `/production/scheduling` | Day / Week (default) / Month / Capacity |
| Production order detail → Scheduling tab | Approve, recalc, pin, timeline |
| Product edit → Production Time | Basic total + advanced stage table |
| Settings → Production Calendar / Scheduling | Timezone, days, shifts, buffers, auto-assign/replan |
| Production stages | Expose `dependsOnCodes` editor |
| Dashboard cards | Today, Week, Approvals, Alerts |

Aesthetic: existing Admin tokens, light/dark, ar/en/he RTL. No stock FullCalendar theme.

## Customer portal

- Create order / quotation request: availability card + preferred date
- Order detail: promise state + committed date; change CTA per policy
- Never show capacity/workers

## Employee portal

- Planned start / due / “scheduled today” on task list/detail only
- No schedule calendar or mutate controls

## Mobile Admin

- Today / week strip, approvals inbox, at-risk, approve/change/recalc sheets
- Reuse existing bottom-sheet patterns; no desktop Gantt

## Mobile Dealer

- New Order: availability + date selector
- Post-submit order detail: schedule summary + conditional change/change-request
- Home near-delivery uses committed date
- Preserve dealer-ui glass aesthetic

## Mobile Worker

- Planned start/due/scheduled-today labels on existing industrial cards
- Timer/blocker unchanged functionally; feed server replan
- No factory calendar

## Shared mobile

- `api/modules/scheduling.ts`, query keys, i18n, motion for cards/sheets
- Hand-test checklist required at end (`docs/scheduling-mobile-changes.md`)
