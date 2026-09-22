# Web board template

The single card vocabulary for the admin and dealer web app. Every surface that holds content is a **Board**: warm paper, hairline border, layered shadow, header band. Tone is carried by a small ink mark, the number's colour, or a soft gradient wash — never a coloured stripe on the edge.

Source: `packages/ui/src/board/*` (exported from `@maher/ui`). Reference implementation: `apps/web/src/components/admin/desk/*`.

## Shell recipe

| Layer | Spec |
|-------|------|
| Shape | `rounded-[18px]`, `border` 1px `--maher-border`, `bg-[var(--maher-surface)]`, `overflow-hidden` |
| Lift | `.maher-board` → `--maher-shadow-board` (`0 1px 2px` + `0 10px 30px -18px`) |
| Header band | `--maher-surface-muted`, hairline bottom, 8px **stamp** before the title, meta/actions on the end edge |
| Body | `px-5 py-4` (`padding="tight"` for ledgers, `"none"` for lists that draw their own rows) |
| Footer | hairline top, `text-[13px]`, one link or one status line |
| Tone | `--board-ink` / `--board-soft` CSS vars set by the `tone` prop |
| Wash | `wash="top"` → 96px gradient from `color-mix(ink 14%)` to transparent over the header. `wash="full"` → whole board tinted (critical tickets, hero) |
| Interactive | `interactive` or `href` → `-1px` lift + shadow step on `(hover:hover)`, `scale(0.985)` on press, `160ms cubic-bezier(0.23,1,0.32,1)` |
| Ink | `className="maher-board--ink"` → always-dark board in both themes. Re-scopes text/surface/tone tokens so `Figure`, `Stamp`, buttons inside just work. Pair with a `.maher-board__field` child (`<BrandShaderWash variant="hero" />` + `.maher-board__field-veil`) for the moving gradient. **One per page**, hero only. |

```tsx
<Board tone="warning" wash="top">
  <Board.Header title="Production load" description="Active, due, blocked" meta={<Stamp tone="warning" size="sm">3</Stamp>} />
  <Board.Body>…</Board.Body>
  <Board.Footer>…</Board.Footer>
</Board>
```

`Board` renders a `<section>` by default (`as="div" | "article" | "li"`), or an `<a>` when `href` is set (pass `LinkComponent={Link}`).

## Tones

`neutral | brand | success | warning | error | info`. Use `toneInk(tone)` / `toneSoft(tone)` for custom paint; `toneFromKey(key, count)` maps factory words (`overdue`, `blocked`, `passed`…) to a tone and returns `neutral` for zero.

Rules:
- A board's tone is the **worst** thing inside it (any critical → `error`; any high → `warning`; clear → `success` or `brand`).
- Zero counts are `neutral` ink, not hidden and not coloured.
- Never more than one wash per column view; the hero and critical tickets earn it, ledgers don't.

## Data primitives

All authored SVG/CSS. No chart library. Token colours only. Tabular numerals. Time axes read in document direction (`rtl:-scale-x-100`, `transform-origin` flips).

| Primitive | Answers | Notes |
|-----------|---------|-------|
| `Figure` | *How many / how much right now* | value + unit + label + delta. Numbers count up via `AnimatedValue`; pass formatted strings for money. `locale="ar"` drops the tight tracking. |
| `Meter` | *How full against a ceiling* | fill + optional target tick. Use for shares, ladders, incomplete costing. |
| `Ribbon` | *How the whole splits* | proportional segments with gradient joins + legend. Use for status mix, station shares. |
| `Sparkline` | *Which way is it going* | 7–30 point line + area. Pair with a `Figure` for the current value. |
| `DayStrip` | *When this week* | 7 columns: count over bar over weekday. Today highlighted. `compare` draws a thin second bar. |
| `Ticket` | *What needs a decision* | stamp + title + why + action + arrow. `wash` for critical, `ink="ink"` for exceptions. |
| `Ledger` / `LedgerRow` | *Label → value* | label on start, value on end, always `dir="ltr"`. `stamp` shows tone, `href` makes the row a link. |
| `Stamp` | *Status in one word* | bare 8px dot before headings, or a chip with a label. Replaces pills and badges on boards. |

Pick the primitive by the question, not by the data shape. If a board only has one number, use one `Figure` and give the rest of the space to a `Meter` or `DayStrip` that explains it.

## Layout

- Page hero = one `Board` with `wash="top"`, greeting + one focus sentence + a strip of `Figure`s. No eyebrow. The management dashboard hero is additionally an **ink** board (`maher-board--ink`) with the dark shader field behind it — see `desk/shift-board.tsx`. Other pages keep the paper hero unless they have a reason to be the page's one dark moment.
- Content = `grid gap-5 xl:grid-cols-12`; left `xl:col-span-7`, right `xl:col-span-5`; single column below `xl`.
- Each column is `flex flex-col gap-5`; the **last board in each column is elastic** (`className="xl:flex-1"` + `Board.Body grow`) so columns end flush. Elastic candidates: quick jumps, activity, catalog spotlight.
- **Zero rows never leave gaps.** A board either hides its zero rows (ledgers), renders `Board.Empty` (teaching copy + one action), or folds into a neighbour's footer (e.g. "No open exceptions" inside Quality).
- Boards hidden by permission (`workers`, `finance`) simply don't render; the elastic board absorbs the slack.

## Motion

One authored moment per load: `.maher-stagger` on the page root, figures count up, meters and ribbons `scaleX` in, day bars `scaleY` up, sparklines draw. Nothing loops. Hover only under `(hover:hover) and (pointer:fine)`. `prefers-reduced-motion` removes movement and keeps fades.

## RTL and Arabic

- Time axes flip automatically (`Sparkline`, `Meter`, `Ribbon`, `DayStrip`).
- Codes, money, percents, times: `dir="ltr"` (primitives do this for you).
- Arabic titles: no uppercase, no letter-spacing; `Figure` respects `locale`.
- Arrows: `rtl:-scale-x-100`.

## Empty, loading, error

- Empty → `Board.Empty` with a title that names what would appear and a short body. Optional icon and one action. Never a bare "Nothing here".
- Loading → `Skeleton` with `rounded-[18px]` matching the board heights of the final layout.
- Error → `ErrorState` from `@maher/ui` (already on the recipe).

## Do / don't

Do:
- One board per question. Header names the question, body answers it, footer offers the next step.
- Reach for the shared desks before writing a page from scratch: `DealerListDesk`, `SecurityDesk`, `NotificationsDesk`, `ReturnDesk`, `AuthPanelLayout`, `MoneyDeskBoard`.
- Worker "finish" actions are a `HoldButton` (press-and-hold ink pill with a progress ring), never a plain button.

Don't:
- Side rails (`w-[3px]`), coloured left borders, or accent stripes.
- Eyebrows / uppercase kickers above titles.
- Same-size icon tiles for navigation — use `LedgerRow` or the dense two-column jump list.
- Nest a board inside a board. Use inset rows or a hairline instead.
- Charts from a library, glassmorphism inside boards, traffic-light colour blocks.
- `--maher-border-strong` on board shells (it's for inputs/focus).
- Importing a retired shell. `Card`, `FloorBoard`, `MetricCard`, `PageHero`, `SurfaceCard` and `FilterPanel` were deleted from `@maher/ui`; `apps/web/src/lib/floor-board.contract.test.ts` fails on any import of them or on the `.maher-list-card` class. `PageHeader`, `Table`, `Modal`, `Badge`, `StatusBadge` remain on the recipe but are `@deprecated`.

## The kit (everything beyond the dashboard)

All of these ship from `@maher/ui`; page-side copy comes from `useKitCopy()` in `apps/web/src/lib/kit-copy.ts`.

### Chrome

| Component | Use |
|-----------|-----|
| `SectionTabs` | The one strip for nested sections (`/admin/orders` → Overview · Price requests · …) and in-page tabs. Paper strip, ink active tab, sliding indicator, count `Stamp`s. Link mode navigates (`href` + `LinkComponent`), button mode is a tablist. `NestedNav` renders it with live counts from `nested-nav-counts.ts`. |
| `ScanButton` (web) | Topbar scanner. Resolves bin → kit → lot → item → order number via `lib/scan-router.ts` and navigates. |

### Lists

| Component | Use |
|-----------|-----|
| `ListToolbar` | Search (`/` focuses), `filterCount` stamp + `onOpenFilters`, `sort` menu, `actions`, chips as children. |
| `StatusChips` | Lifecycle row (all / preparing / in production …) with counts; selected chip takes the tone's soft wash. |
| `FilterDrawer` + `FilterGroup` | Side sheet ≥900px, bottom sheet below. Apply / Clear footer. Groups are hairline-titled, never railed. |
| `DataBoard` | Table inside a Board: header band, hairline rows, `numeric` columns LTR tabular, `rowHref` whole-row links, `sortKey` headers, selection, `hideBelow`. Give `mobileRow` and it becomes `ListRow`s under `md`. |
| `ListRow` / `ListRows` / `RowThumb` | The mobile row: stamp or thumb · title · meta · trailing · chevron. |
| `Pagination` | Offset `page`/`pageSize` with range line; hides itself on a single page. |
| `BulkBar` | Floating ink bar when rows are selected. |
| `useListParams` (web) | URL-synced `q`, `status`, `page`, dates, sort → react-query keys. Every list uses it. |

### Details

| Component | Use |
|-----------|-----|
| `DetailHero` | Back · code (LTR) · title · status `Stamp` · inline facts · `InkPill` primary + `Menu` overflow. Wash from the status tone. |
| `ActionDock` | Sticky bottom bar on compact, inline from `md`. Put the page's actions here, never in a floating FAB. |
| `StageStrip` | One entity's journey: done / current / blocked / todo nodes on a rail. |
| `Timeline` | Spine list with tone stamps and LTR times (history, activity). |
| `KeyFacts` | Label-over-value grid for descriptive facts. |
| `Attachments` | Drop zone + thumbs + PDF chips; upload logic stays in the page. |

### Forms

| Component | Use |
|-----------|-----|
| `Field` | Label / hint / error wiring for any control (render-prop gives `id`, `describedBy`). |
| `Combobox` | Typed search over static or async options (dealers, suppliers, materials). |
| `NumberField` / `MoneyField` | LTR tabular numerals, unit suffix or currency prefix; accepts Arabic-Indic digits. |
| `SegmentedControl`, `Switch`, `Checkbox` | Authored controls; brand fill, no blue. |
| `FormSection` | Board with a header band and a 1–3 column field grid. `tone="error"` when it holds invalid fields. |
| `FormFooter` | Sticky save bar with the unsaved-changes stamp; arms `beforeunload`. |

### Calendar

`MonthCalendar` is the mobile grid ported one-to-one (`calendar-math.ts` is the same file). `DateField` opens it in a popover (desktop) or sheet (compact) and replaces every `input[type=date]`. `DateRangeField` is one trigger, two months, presets, live hover strip. `dayMeta` paints load tones (`light` / `half` / `busy` / `closed`) and marker dots; `variant="admin"` adds load % per cell.

### Documents and scanning

- PDFs are always rendered by the API. `usePdfDownload()` (web) opens `PdfDownloadDialog` — language, white/brown paper, optional range — then fetches with cookies and saves or opens. Never `window.open(…/pdf)` directly.
- `DocumentActions` is the pill row for PDF / label / CSV buttons.
- `CodeScanner` is the full-bleed ink camera (viewfinder, torch, typed fallback, USB wedge, ZXing fallback). `QrDisplay` shows a high-ECL code with the brand mark and prints through the API label PDF.

### Overlays

`Sheet` (side/bottom), `Popover`, `Menu`, `ToastProvider` + `useToast` (Board-styled with tone stamp), `ConfirmDialog` (one question, one answer), `ErrorBoard`, `BoardSkeleton`, `DataBoardSkeleton`.

## Migrating a section

1. Wrap the page in a hero `Board` (`wash="top"`) or `DetailHero`, and a 12-col grid.
2. Lists: `useListParams` → `ListToolbar` + `StatusChips` + `FilterDrawer` → `DataBoard` (with `mobileRow`) → `Pagination`.
3. Details: `DetailHero` → boards per question (`KeyFacts`, `DataBoard`, `Ledger`, `Timeline`, `Attachments`) → `ActionDock`.
4. Forms: `FormSection`s → `FormFooter`; dates through `DateField`; pickers through `Combobox`.
5. Replace stat tiles with `Figure`s; label/value tables with `Ledger`; status pills with `Stamp`.
6. Documents through `usePdfDownload`; scanning through `useCodeScanner` + `scan-router`.
7. Check `Board.Empty` copy, RTL, dark mode, reduced motion, and that no `w-[3px]` remains.

## Surfaces

| Surface | Shell | Hero | Notes |
|---------|-------|------|-------|
| Admin | `AppShell` (blurred sidebar) + `NestedNav` (`SectionTabs` with live counts) + `ScanButton` | paper `Board wash="top"` or `DetailHero` | 12-col grid, 7 / 5 |
| Dealer | `PortalShell` — `SectionTabs` shelves Home · Shop · Orders · Money · Account + pill links for the active shelf | paper hero or `DetailHero` | Basket / unread counts ride the shelf stamps; `DealerListDesk` for every list |
| Worker | `EmployeeShell` — Home · My orders · Completed | `Board variant="ink"` | `HoldButton` to finish, `useCodeScanner` for take-in / material / lot |
| Auth | `AuthPanelLayout` — shader wash, watermark field, one paper panel | — | login, MFA, forgot / reset, session expired, disabled |

## Verification matrix

Every section was checked in the browser at 1440 (EXPANDED nav) with the seeded demo accounts (`admin`, `nile`, `carpenter`, password `123`). Before shipping a new page run through: light/dark · EN/AR · 1440/1024/768/390 · reduced motion · zero-data account · finance-less account. Popovers must open beside their trigger (floating-ui positions with `left/top`; never re-add `transform` to `.maher-popover`).
