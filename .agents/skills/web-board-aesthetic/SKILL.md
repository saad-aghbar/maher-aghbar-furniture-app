---
name: web-board-aesthetic
description: >-
  Apply the Maher web board aesthetic (paper boards, header band, ink stamp,
  gradient wash, authored data primitives) to admin, dealer and worker web pages. Use
  when the user mentions the board template, restyling a web section or page,
  dashboard cards, factory desk, boards, tickets, ledgers, meters, or asks to
  make a web page match the dashboard.
---

# Web board aesthetic

Warm factory desk on the web. Every content surface is a **Board**: paper, hairline, soft layered shadow, header band with an 8px ink stamp. Tone shows through the stamp, the number's ink, or a gradient wash — never a coloured side rail.

Canonical: `apps/web/src/components/admin/desk/*.tsx` (management dashboard), `legacy-admin-dashboard.tsx`, `warehouse-staff-dashboard.tsx`, `dealer/dashboard/page.tsx`. Copy those. Full spec in `docs/web-board-template.md`.

## Paste this to invoke

```
Use the web board aesthetic. Boards from @maher/ui (Board, Board.Header/Body/Footer/Empty),
stamp not rail, wash for the hero, Figure/Meter/Ribbon/Sparkline/DayStrip/Ticket/Ledger/Stamp
for data. 12-col grid 7/5, elastic last board, no gaps. Read
.cursor/skills/web-board-aesthetic/SKILL.md and match apps/web/src/components/admin/desk.
```

## Feel

- Canvas is the shell atmosphere (veiled shader + faint watermark). Boards sit on it as opaque paper (`--maher-surface`).
- Brand is coffee wood; semantics stay in that family (olive success, amber warning, sienna error, slate info). Never UI blue or traffic red blocks.
- Quiet. One stagger per load. Hover lifts 1px. Press `scale(0.985)`. No loops, no bounce.

## Board (default surface)

```tsx
import { Board, Stamp } from '@maher/ui';

<Board tone="warning" wash="top" /* interactive | href + LinkComponent */>
  <Board.Header title="…" description="…" meta={<Stamp tone="warning" size="sm">3</Stamp>} actions={…} />
  <Board.Body /* padding="tight" | "none", grow */>…</Board.Body>
  <Board.Footer>…</Board.Footer>
</Board>
```

| Layer | Spec |
|-------|------|
| Shell | `rounded-[18px]`, 1px `--maher-border`, `--maher-surface`, `.maher-board` (`--maher-shadow-board`), `overflow-hidden` |
| Header band | `--maher-surface-muted`, hairline bottom, stamp + `text-[15px] font-semibold`, optional description, meta/actions at end |
| Tone | `tone` prop sets `--board-ink` / `--board-soft`; board tone = worst item inside; zero = `neutral` |
| Wash | `top` = gradient over the header edge (hero, critical); `full` = whole board tinted (critical ticket) |
| Interactive | `-1px` lift + shadow step under `(hover:hover)`, `scale(0.985)` press, `160ms cubic-bezier(0.23,1,0.32,1)` |
| Empty | `Board.Empty` — title names what would show, one-line body, optional icon + action |

## Primitives (pick by question)

| Question | Primitive |
|----------|-----------|
| How many right now | `Figure` (count-up, `size`, `tone`, `locale`) |
| How full vs ceiling | `Meter` (`value`, `max`, `target`) |
| How does the whole split | `Ribbon` (segments, legend) |
| Which way is it going | `Sparkline` (7–30 points) |
| When this week | `DayStrip` (7 columns, today, `compare`) |
| What needs a decision | `Ticket` (stamp, title, why, action, `wash`, `ink="ink"`) |
| Label → value | `Ledger` + `LedgerRow` (`stamp`, `href`, `hint`, `icon`) |
| Status word | `Stamp` (dot or chip) |

`toneFromKey(key, count)` maps factory words to tones. `toneInk` / `toneSoft` for custom paint.

## Page stack

1. Hero `Board` `wash="top"`: date/updated line → greeting `text-[26px]/[30px] tracking-[-0.02em]` → focus sentence (stamp + title + why + one dark pill action) → 3–6 `Figure`s on the right.
2. `grid gap-5 xl:grid-cols-12`: left `xl:col-span-7`, right `xl:col-span-5`, each `flex flex-col gap-5`.
3. Last board per column `className="xl:flex-1"` with `Board.Body grow` (jumps, activity, spotlight).
4. Zero rows: hide (ledger), teach (`Board.Empty`), or fold into a neighbour's `Board.Footer`. Permission-gated boards just don't render.
5. Navigation = dense two-column jump rows (`min-h-[44px]`, icon well 28px, hover reveals arrow). Never same-size icon tiles.

## Motion

- `.maher-stagger` on the page root; `Figure` counts up; `.maher-meter-fill` / `.maher-ribbon-seg` scaleX; `.maher-daystrip-bar` scaleY; `.maher-spark-line` draws.
- Reduced motion: movement off, fades stay (handled in `tokens.css`).

## RTL / Arabic

- Time axes flip (`rtl:-scale-x-100`, `transform-origin` right).
- Money, codes, percents, clock: `dir="ltr"` (primitives do this).
- Arrows `rtl:-scale-x-100`. Arabic: no uppercase, no tight tracking (`Figure locale="ar"`).

## Do not

- `w-[3px]` rails, coloured left borders, accent stripes.
- Eyebrows, uppercase kickers, `--maher-border-strong` on shells.
- Same-size icon tiles, nested boards, chart libraries, glass inside boards.
- `Card` / `FloorBoard` / `MetricCard` / `PageHero` / `SurfaceCard` / `FilterPanel` / `BentoMetricCard` / `QuickActionTile` / `AttentionChip` — all deleted. The contract test (`apps/web/src/lib/floor-board.contract.test.ts`) fails the build on any `@maher/ui` import of a retired name or on `.maher-list-card`.
- `input[type=date]`, raw `window.open(…/pdf)`, hand-rolled hold buttons or scanners — use `DateField`, `usePdfDownload`, `HoldButton`, `useCodeScanner`.

## Kit (lists, details, forms, dates, documents, scan)

| Need | Use |
|------|-----|
| Section / in-page tabs | `SectionTabs` (ink active tab, count stamps). Nested admin sections come from `nav-items.ts` via `NestedNav`. |
| List page | `useListParams` → `ListToolbar` (search `/`, filters stamp, sort) + `StatusChips` + `FilterDrawer`/`FilterGroup` → `DataBoard` (`numeric`, `rowHref`, `sortKey`, `mobileRow`) → `Pagination`; `BulkBar` for selection. |
| Detail page | `DetailHero` (back · code · title · stamp · facts · `InkPill` + `Menu`) → boards (`KeyFacts`, `DataBoard`, `Ledger`, `Timeline`, `StageStrip`, `Attachments`) → `ActionDock`. |
| Form | `FormSection` grid → `Field`/`Input`/`Combobox`/`NumberField`/`MoneyField`/`SegmentedControl`/`Switch`/`Checkbox` → `FormFooter` (dirty stamp). |
| Any date | `DateField` (popover / sheet with `MonthCalendar`), ranges `DateRangeField`. Never `input[type=date]`. |
| Any PDF | `usePdfDownload().openPdf({ path, documentName })` + `DocumentActions`. Never raw `window.open(…/pdf)`. |
| Any export | Same dialog with `csvPath` → branded PDF + CSV button (`PdfDownloadDialog csv`). Reports use `/api/v1/reports/export/<name>.{pdf,csv}`; never a bare CSV link. |
| Any note / long text | `TextArea autoGrow maxRows={…}` — grows with content, never a fixed 3-row box. |
| Live status | `Stamp pulse` for "running now" (live elapsed, active session); pulse stops under reduced motion. |
| Any scan | `useCodeScanner().openScanner()` → `routeForScan` / page handler. `QrDisplay` for showing codes. |
| Overlays | `Sheet`, `Popover`, `Menu`, `useToast`, `ConfirmDialog`, `ErrorBoard`, `BoardSkeleton`. |

| Worker finish | `HoldButton` (`onHold`, `durationMs`, `holdingLabel`) — ink pill with a progress ring; reduced motion shortens the hold. |
| Security / account | `SecurityDesk` (`apps/web/src/components/account/security-desk.tsx`): password, MFA QR + confirm, sessions `DataBoard` with revoke. Shared by admin, dealer and worker. |
| Notifications | `NotificationsDesk` (`components/notifications/notifications-desk.tsx`): day-grouped inbox, topic `Switch` matrix, templates (admin). |
| Dealer list page | `DealerListDesk` (`components/dealer/dealer-list-desk.tsx`): hero ribbon + figures, chips, search, `DataBoard`. |
| Auth page | `AuthPanelLayout` (`components/auth/auth-panel-layout.tsx`): shader wash + watermark + one paper panel. |
| Assign a stage | `StageAssignSheet` (`components/production/stage-assign-sheet.tsx`): worker cards with load meter, day `DateField`, ≥30-min slot picks from `worker-day-plan.ts`. Used by the orders-side `PlanStagesBoard` ("Prepare for production") and the hub ("Factory floor") — never a bare worker `Combobox`. |
| Stage timing | `StageTimePanel` in `components/workflow/order-workflow-section.tsx`: Estimated · Actual · Live elapsed (pulsing stamp) with a `Meter` against the estimate. |
| Fabric on an order | `OrderFabricTracker` (`components/purchasing/order-fabric-tracker.tsx`) on sales-order, plan and hub lifecycle; `SupplierMessageSheet` drafts/sends WhatsApp; `TaskFabricBoard` (`components/worker/task-fabric-board.tsx`) for take-in / disposition on the worker task. |
| Worker gates | `QualityGatePanel` (inspector checklist, report-problem → rework stage, packer confirm) and `RecoveryFloorPanel` (recovery lines) in `components/worker/`. `task-quality-kind.ts` decides which one a task gets; gates block `HoldButton` finish until done. |
| Cost hints on a quote | `GET /quotations/:id/cost-hints` → mini `Ledger` (planned · last actual · avg · samples) + margin `Stamp` beside `MoneyField`; "Use planned +35%" fills the price. |

Copy for all of these: `useKitCopy()` in `apps/web/src/lib/kit-copy.ts`.

## Surface shells

- Admin: `AppShell` sidebar (blurred) + `NestedNav` (`SectionTabs` with live counts) + `ScanButton`.
- Dealer: `PortalShell` — `SectionTabs` shelves Home · Shop · Orders · Money · Account, with a second row of pill links for the active shelf; basket and unread counts ride the shelf stamps.
- Worker: `EmployeeShell` — three `SectionTabs` (Home · My orders · Completed), heroes use `Board variant="ink"`.
- Auth: `AuthPanelLayout` for login, MFA, forgot/reset password, session expired, disabled.

## Build order

1. Find the closest desk board in `apps/web/src/components/admin/desk/` (dashboard) or the closest migrated section (Orders) and copy its structure.
2. Header = the question. Body = one or two primitives that answer it. Footer = the next step or a folded neighbour.
3. Set `tone` from the worst item; `wash` only on hero / critical.
4. Place in the 7 / 5 grid; make the column's last board elastic.
5. Lists and details follow the kit table above; add the mobile-parity actions listed in the plan for that page.
6. Verify light/dark, EN/AR, 1440/1024/768/390, reduced motion, empty and permission-gated states.
7. New API call from web? Add an `API_PARITY` row in `apps/web/src/parity/manifest.ts` naming the file that calls it (the parity test greps for the path; use the static prefix for templated paths). Redirect-only routes must point at a real page, never a stub that "doesn't load".
8. Dark-mode login glass: html2canvas cannot parse `color(srgb …)` (what `color-mix()` computes to); `login-liquid-glass.tsx` normalises the clone in `onclone` — keep that when touching the veil.
