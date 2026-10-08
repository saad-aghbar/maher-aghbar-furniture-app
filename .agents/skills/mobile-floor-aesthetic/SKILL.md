---
name: mobile-floor-aesthetic
description: >-
  Apply the Maher mobile floor / board aesthetic (parchment factory desk)
  used on dealers, invoices, purchasing, users, reports, production, inventory,
  and orders — boards, sheets, rails, touch bars, press states. Use when the user
  mentions floor aesthetic, floor plan aesthetic, parchment boards, polish dealers
  / invoices / purchasing / users / reports / production / inventory / orders UI,
  sheets, pop-ups, Factory review, or touch bars, or when building or restyling
  those screens.
---

# Mobile floor aesthetic

Warm factory-desk language. Screens are **boards on parchment**, not Material cards, not white SaaS tables, not traffic-light dashboards.

Canonical floors: **dealers**, **invoices**, **purchasing**, **users**, **reports**, **production**, **inventory**, **orders**. Copy those — do not invent a new look.

**Same aesthetic, different layout is OK.** Every floor uses the same parchment boards, rails, header bands, inset meta, press, and sheets. Stack, chrome, and what sits on a card may change by module (production is a hub + order detail; inventory is a stock desk with lifecycle + section chrome; orders is a commercial desk with All orders / Customer requests — not a dealer money stack). Do not flatten a floor into another module’s page map. Do not invent a new visual language to justify a new layout.

## Paste this to invoke

```
Use the mobile floor aesthetic (dealers / invoices / purchasing / users / reports / production / inventory / orders).
Boards on parchment. Accent rail. Header band. Inset meta. Soft press.
Sheets, rails, and touch bars match those floors. Read
.cursor/skills/mobile-floor-aesthetic/SKILL.md and match the canonical files.
```

## Feel

- Canvas is linen parchment (`colors.background`), never grey or pure white.
- Surfaces are warm paper (`colors.surface`), slightly lifted (`colors.surfaceSecondary` bands).
- Brand is Army Camo / coffee wood (`#776245` light). Semantics stay in that family: olive success, roasted amber warning, burnt sienna error. No UI blue, mint, or traffic red.
- Quiet. Soft scale on press. Soft stagger on enter. No bounce, no neon, no FABs on admin floors.

## Board (default surface)

Every list card, section, money panel, and chrome wrapper:

| Layer | Spec |
|-------|------|
| Shell | `radius.xl` (20), `borderWidth: 1`, `borderStrong`, `surface`, `overflow: 'hidden'` |
| Lift | `...orderBoardShadow(colorScheme)` from `@/features/sales-orders/components/orderFloorStyle` |
| Accent rail | 3px, reading-start (`left` LTR / `right` RTL), `colors.brand` @ **0.55** |
| Rail clearance | Extra **+4** padding on the rail side (`spacing.lg + 4`) |
| Header band | `surfaceSecondary`, bottom hairline `colors.border`, status / title / “Details” |
| Inset meta | Nested `radius.lg` (14) panel, `surfaceSecondary`, `border` |

Reuse wrappers when they exist: `DealerBoard`, `InvoiceFloorBoard`, `PurchasingFloorBoard`, `UserFormSection`, `ProductionIdentityBoard`, `InventoryBoardCard`, `InventoryIdentityBoard`, `OrdersRfqInboxChips`, `RequestIdentityBoard`. Do not restyle a one-off card.

```tsx
<View style={{
  borderRadius: theme.radius.xl,
  borderWidth: 1,
  borderColor: colors.borderStrong,
  backgroundColor: colors.surface,
  overflow: 'hidden',
  ...orderBoardShadow(colorScheme),
}}>
  <View pointerEvents="none" style={{
    position: 'absolute', top: 0, bottom: 0, width: 3,
    backgroundColor: colors.brand, opacity: 0.55,
    ...(isRTL ? { right: 0 } : { left: 0 }),
  }} />
  {/* header band → body / inset meta */}
</View>
```

## Screen stack

Default (dealers / invoices / purchasing / users / reports):

1. Centered `largeTitle` + start-edge back lead (`theme.sizes.touch.min` = 44).
2. Optional hero / metrics / money board.
3. Chrome (search + filters or pill tab bar) **inside one board**.
4. List of board cards, each wrapped in `ListItemEnter`.
5. Detail = stacked boards (`ListItemEnter` index 0…n), not a form page.

**Production** keeps the same boards but a factory-desk stack — see Tone → Production. Do not force a money hero or dealer summary rail onto it.

**Inventory** keeps the same boards but a stock-desk stack — see Tone → Inventory. Do not force a dealer money stack or a production hub-jump onto it.

**Orders** keeps the same boards but a commercial-desk stack — see Tone → Orders. Do not force an inventory lifecycle rail or a dealer money hero onto it.

Title weight everywhere: `locale === 'ar' ? 'medium' : 'semibold'`. Never 700.

## Press, pop-ups, motion

- Tappable card → `AnimatedPressable variant="card"` (scale **0.985**) + `haptics.selection()`.
- Chip / rail / row / CTA → `variant="button"` (scale **0.97**) + `haptics.selection()`.
- Save / apply → `confirmLight` or `confirmMedium`. Errors → `haptics.error()`.
- Enter: `ListItemEnter` (fade + 3px Y, ~16ms stagger). No `.springify()` on boards.
- Nested PDF / row actions stay `button` so they do not steal the card press.

**Sheets** always use shared `BottomSheet`:

- Paper surface, **top** `radius.xl`, handle 36×4 `borderStrong`, `heading` title.
- Body: same floor boards / chips / inset meta — not a flat iOS form.
- Footer pinned: Primary + Secondary, **xl or full** radius, min height 44.
- Close: backdrop, handle pan. Chain the next sheet with `onClosed` (~80ms).

## Rails and touch bars

| Kind | When | Look |
|------|------|------|
| **Pill tab bar** | Hub sections | Sliding wood bubble via `useDraggablePillBar`. Purchasing / reports / production wrap the track in an outer board (`PurchasingTabBar`, `ReportsTabBar`, `ProductionHubJump`, 40px). Users is the inner track only (`UsersSegmentRail`, 36px). |
| **Roles touch bar** | User create/edit role pick | Same bubble family as the users rail. Copy `RolesTouchBar`. |
| **Floor triggers** | Open a filter sheet | 48px, 1.5px border, icon well 28, chevron (header-compact triggers may omit the chevron). Active = `brandSoft` + brand border + 3px start rail. Copy `PurchasingFilterTriggers`, `UsersFilterTriggers`, `InvoiceFilterTriggers`, `OrdersFilterButton`. |
| **Period cells** | Report time window | 3 equal cells, icon well, uppercase caption. Active = brandSoft + **3px bottom bar**. Copy `ReportsPeriodChrome`. |
| **Sheet chips** | Status / mode inside a sheet | `radius.lg`, minHeight 40. Active = brandSoft + brand border + 3px start rail. Copy chips inside `OrdersFilterSheet`. |
| **Inbox cells** | Five-way hub picker that must stay on screen | Two-row equal cells (3 + 2). Icon well + caption. Active = brandSoft + **3px bottom bar**. Copy `OrdersRfqInboxChips`. Do not put these in a horizontal `ScrollView`. |
| **Summary rail** | Dealer detail buckets | Two-row board. Active cell = brandSoft + **3px bottom bar**. Copy `DealerSummaryRail`. |
| **Stage spine** | Orders / RFQ / production lifecycle | `OrdersStageSpine`, `RfqStageRail`, `ProductionLifecycleStrip` only. Do **not** add to purchasing, invoices, users, reports, or inventory. |

Idle chrome is parchment. Selected chrome is brand wash + brand ink. Bubble fills: 3-stop purchasing set, or the 5-stop users set (wood → olive). Do not invent new hex.

## Type and money

- Eyebrows: `caption`, 10–11px. Uppercase + `letterSpacing` 0.45–0.55 **only if locale !== 'ar'**.
- Codes, phones, currency, percents: `dir="ltr"` (block still sits on the reading-start edge).
- Money rows: label on start, value on the opposite edge (`textAlign` flips in RTL).
- Narrow cells: **stack** label over value (dealer `PriceBlock`). Do not squeeze side-by-side.
- Invoice **cards/detail boards** use `formatNumber` + ` ₪`. Sheets use `formatCurrency`.
- Amount due is the hero. Paid / credit are secondary. Never net due against credit on the same number.

## Tone by module

- **Dealers:** due = `warning` / `warningSoft`. Credit = `success` / `successSoft`. Always show both, separate.
- **Invoices:** overdue = `error` rail + error amount. Open due stays `textPrimary`. Partial badge = `warning`. Paid / credit values = `success`.
- **Purchasing PO:** phase on the header band. Overdue phase = `error`. Supplier-invoice due can use `warning` like a money board.
- **Users:** identity card — 44px initial disc, inset roles/dept/login, footer chips (edit / activate / password) + trash well. Inactive = muted rail (`textMuted` @ 0.35), softer border. Staff-type cards match. Sheets use `UserFormSection` (icon header band) + `RolesTouchBar`.
- **Reports:** category pill bar + period cells (sales / production only). Snapshot tiles and aging stay inset; delayed / aging 61+ use warning / error. Section boards reuse `DealerBoard`.
- **Production (layout differs, aesthetic does not):**
  - **Hub:** pulse eyebrow + centered `largeTitle` → workflow board → lane tiles (selected = brandSoft + **3px bottom bar**) → chrome board (`ProductionDealerBar` 48px trigger + search) → `ProductionOrderCard` list. Tab root — no back lead.
  - **Order card / task card:** header band (`StatusBadge` + high/late + Details) → media + number/title → inset meta → progress. Late = `error` rail @ 0.9. High/urgent = `warning` rail @ 0.9.
  - **Order detail:** `ProductionIdentityBoard` (all tabs) → `ProductionHubJump` (Overview / Materials / WIP / Tasks, 40px wood bubble) → section body. Overview = stacked `DealerBoard`s (cost, plan, readiness, assignments, progress, blockers, task chips) + `ProductionTaskCard` list + `AdminScheduleStrip` + `ProductionLifecycleStrip` + action rows. Materials = slim header `DealerBoard` then **sibling** `UsageRow` cards (not nested inside the header). WIP = section board + kit cards. Tasks = chip board + task cards.
  - **Materials card:** same card recipe as the order card — start rail, header band (status + SKU `dir="ltr"`), 56px thumb + name, inset qty ledger (assigned / used / returned / variance). Over = `error`, under/extra = `warning`, unused = muted rail, on target = brand @ 0.55. Empty = `DealerEmptyPanel`.
  - **WIP kit card:** header band (status + tap hint) → media + stage/name/QR + chips. Claimed = `warning`, ready = `success` (olive, never `colors.info`).
  - **Sheets:** `BottomSheet` + `DealerBoard` / `DealerFormFooter`. Assign workers = radio rows with start rail when selected. Priority = wood→sienna `PriorityTouchBar` or listed rows. Delivery = calendar inside a board. Task sheet / plan sheet / WIP kit (facts, pieces, QR) match. CTAs `xl`/`full`, min 44.
  - **Accent:** `DealerBoard` may take `accentColor` (late / blockers = `error`). Keep `ProductionLifecycleStrip`. Shadow alias `productionBoardShadow` = `orderBoardShadow`.
  - Do **not** use `DeskCard` / `SurfaceCard` / `colors.info` on this floor. Do **not** add a second stage spine.
- **Inventory (layout differs, aesthetic does not):**
  - **Hub:** brand eyebrow + title → chrome board (`InventoryLifecycleTabs` materials / semi / finished + `InventorySectionTabs` items / transfers / counts + search + scan/sync) → 48px filter trigger when needed → create / warehouse CTAs (`xl`, min 44) → list of floor cards (`ListItemEnter`). Tab root — no back lead. Category tiles sit in `InventoryCategoryRail` (selected = brandSoft + start rail). Low stock = warning board (`InventoryLowStockFocus`), never a dark spotlight.
  - **Material card:** same recipe as production materials — rail, header band (`StatusBadge` + Details), 56px thumb, inset qty pills, footer chips. Low stock = `warning` rail @ 0.9.
  - **Semi / finished order cards:** header band (number + leave-by / progress) → media → inset meta. At-station / load progress = **brand**, never `colors.info`. Overdue leave-by = `error`. Received / quarantine = `warning`. In-warehouse / FG ready = `success` olive.
  - **Transfer / count cards:** header band (status + number) → inset from/to or warehouse ledger → footer chip. In transit = `warning`. Posted / completed = `success`. Default rail = brand @ 0.55.
  - **Item detail:** back lead + eyebrow → `InventoryIdentityBoard` (all classes) → optional SKU photo board → qty / warehouse `InventoryBoardCard`s → one `InventoryAdjustmentHistoryBoard` (inset rows, footer expands the full ledger). Quarantine / low = `warning`. FG ready identity = `success`. Receive = parchment dock (`InventoryReceiveDock`), not a flat FAB.
  - **WIP kit card:** header band (status + tap hint) → name / QR + chips. Claimed = `warning`, ready = `success`.
  - **Sheets:** shared `BottomSheet` + `InventorySheetBody` / `InventorySheetFooter` (or Primary + Secondary `full`/`xl`). Warehouse / stage pickers = selected brandSoft + start rail. CTAs `xl`/`full`, min 44.
  - **Accent:** `InventoryBoardCard` may take `accent`. Shadow alias `inventoryBoardShadow` = `orderBoardShadow`.
  - Do **not** use `DeskCard` / `SurfaceCard` / `colors.info` on this floor. Do **not** add a stage spine.
- **Orders (layout differs, aesthetic does not):**
  - **Hub:** brand eyebrow + `largeTitle` + header-compact `OrdersFilterButton` (48px, icon well 28, no chevron) → search → desk chrome → list of floor cards (`ListItemEnter`). Tab root — no back lead. Active filter = brandSoft + brand border + 3px start rail + count badge.
  - **Admin desk switch:** `AdminOrdersDeskSwitch` — All orders / Customer requests wood bubble (`useDraggablePillBar`).
  - **Dealer trigger:** `OrdersDealerBar` 48px (icon well + chevron). Selected = brandSoft + start rail.
  - **All orders:** lifecycle station board (`AdminLifecycleChips`) or `OrdersStageSpine`. Dealer portal uses `OrdersFilterChips` (pill family). Keep the stage spine here — do not add it to inventory / purchasing / invoices / users / reports.
  - **Customer requests / Factory review:** `OrdersRfqInboxChips` — one board, header band (`requestsInboxEyebrow` + tray icon well), then a **3 + 2 cell grid** (All open / Waiting / Needs info, then Quoted / Drafts). Each cell = icon well + caption, `flex: 1`. Selected = brandSoft + brand border + **3px bottom bar**. All five stay on screen. Never a horizontal `ScrollView`.
  - **Request detail:** back lead → `RequestIdentityBoard` (status + RFQ number header, 72px media, dealer, phase) → `RfqStageRail` (Request / Quotation / Order period cells + path spine) → stacked `DealerBoard`s (`ListItemEnter`): details, lines, attachments, factory review, quotations. Needs-info / gaps = `warning` rail. Linked sales order = `success` rail. CTAs `full`, min 44. Rows = `AnimatedPressable`. Keep the workspace (Request → Quotation → Order) — do not flatten it into a sales-order detail.
  - **Quotation tab / quote detail:** `AdminQuotationPanel` — `DealerBoard` with header band (title + QT number `dir="ltr"` + `StatusBadge`). Hero total = `formatNumber` + ` ₪`. Subtotal / tax = inset money rows. Quote lines = sibling board, inset rows (name + qty chip + stacked dims/price). Accepted / approved = `success` rail. Rejected = `error`. Revision = `warning`. PDF / workflow CTAs `full`, min 44. Never `colors.info`.
  - **Filter sheet:** `OrdersFilterSheet` — `BottomSheet` + section boards (icon header band, optional start rail when that section is active) + sheet chips (`radius.lg`, minHeight 40, start rail when selected) + Primary / Secondary `full`, min 44.
  - Do **not** use `DeskCard` / `SurfaceCard` / `colors.info` on this floor (waiting / production / quotation chrome stay brand or warning, never UI blue).
- Status: `StatusBadge` with `dot` on header bands / identity rows.

## RTL (non-negotiable)

- Rows: `flexDirection: isRTL ? 'row-reverse' : 'row'`.
- Accent rail, progress fill, and chevrons flip (`chevron-back` in RTL).
- Arabic: no uppercase, no letter-spacing, title weight `medium`.

## Do not

- Flat white cards, Material FABs, generic table rows, dropdown filter menus.
- Hardcoded hex except the existing pill-bar wood arrays.
- Raw `Pressable` without `AnimatedPressable`.
- Square CTAs on these floors — use `radius.xl` or `full`.
- Skip `orderBoardShadow` on an elevated board.
- Put a stage spine on purchasing, invoices, users, reports, or inventory.
- Use traffic-light colors or `fontWeight: '700'`.

## Build order

1. Find the closest canonical screen (list card, detail stack, sheet, or rail) in [reference.md](reference.md).
2. Reuse the wrapper (`DealerBoard`, `InvoiceFloorBoard`, `PurchasingFloorBoard`, `UserFormSection`, `ProductionIdentityBoard`, `InventoryBoardCard`, `InventoryIdentityBoard`, `OrdersRfqInboxChips`, `RequestIdentityBoard`, `BottomSheet`). Layout may follow that module’s stack; the board recipe must not change.
3. Tokens only: `useTheme()`, `useLocale()`, `orderBoardShadow`, `AnimatedPressable`, `haptics`, `ListItemEnter`.
4. Match press + sheet + rail behavior, not just colors.
5. Verify RTL, Arabic weight, empty board (`DealerEmptyPanel` or equivalent), and reduced motion.
