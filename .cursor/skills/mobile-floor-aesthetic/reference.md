# Floor aesthetic — canonical files

Copy these. Do not restyle from memory.

## Shared

| Piece | Path |
|-------|------|
| Board shadow | `apps/mobile/src/features/sales-orders/components/orderFloorStyle.ts` |
| Colors (parchment / camo) | `apps/mobile/src/theme/colors.ts` |
| Elevation | `apps/mobile/src/theme/elevation.ts` |
| Press / enter | `apps/mobile/src/motion/AnimatedPressable.tsx`, `ListItemEnter.tsx`, `haptics.ts`, `presets.ts` |
| Pill drag | `apps/mobile/src/motion/useDraggablePillBar.ts` |
| Sheet shell | `apps/mobile/src/components/sheets/BottomSheet.tsx` |
| Type | `apps/mobile/src/components/AppText.tsx` |
| Badge | `apps/mobile/src/components/badges/StatusBadge.tsx` |

## Dealers

| Piece | Path |
|-------|------|
| List | `apps/mobile/src/features/dealers/DealersListScreen.tsx` |
| List card | `apps/mobile/src/features/dealers/components/DealerListCard.tsx` |
| Detail stack | `apps/mobile/src/features/dealers/DealerDetailScreen.tsx` |
| Section board | `apps/mobile/src/features/dealers/components/DealerBoard.tsx` |
| Wallet / credit | `apps/mobile/src/features/dealers/components/DealerCreditBoard.tsx` |
| Summary rail | `apps/mobile/src/features/dealers/components/DealerSummaryRail.tsx` |
| Empty | `apps/mobile/src/features/dealers/components/DealerEmptyPanel.tsx` |
| Sheet form | `apps/mobile/src/features/dealers/components/dealerSheetForm.tsx` |
| CRM / range sheets | `DealerCrmSheets.tsx`, `StatementRangeSheet.tsx`, `DealerPickerSheet.tsx` |

## Invoices

| Piece | Path |
|-------|------|
| List | `apps/mobile/src/features/invoices/InvoicesListScreen.tsx` |
| List card | `apps/mobile/src/features/invoices/components/InvoiceBoardCard.tsx` |
| Detail | `apps/mobile/src/features/invoices/InvoiceDetailScreen.tsx` |
| Balance | `apps/mobile/src/features/invoices/components/InvoiceBalanceBoard.tsx` |
| Section board | `apps/mobile/src/features/invoices/components/InvoiceFloorBoard.tsx` |
| Filter triggers | `apps/mobile/src/features/invoices/components/InvoiceFilterTriggers.tsx` |
| Status sheet | `apps/mobile/src/features/invoices/components/InvoiceStatusFilterSheet.tsx` |
| Pay / credit sheets | `RecordPaymentSheet.tsx`, `ApplyCreditSheet.tsx` |
| Detail dock | `InvoiceStickyActions.tsx` + `FloatingActionDock` |

Invoice money on boards: `formatNumber` + ` ₪`. Amount due first. Overdue = `colors.error`.

## Purchasing

| Piece | Path |
|-------|------|
| Hub | `apps/mobile/src/features/purchasing/PurchasingHubScreen.tsx` |
| Pill tab bar | `apps/mobile/src/features/purchasing/components/PurchasingTabBar.tsx` |
| Hero tiles | `apps/mobile/src/features/purchasing/components/PurchasingHeroActions.tsx` |
| Filter triggers | `apps/mobile/src/features/purchasing/components/PurchasingFilterTriggers.tsx` |
| Status sheet | `apps/mobile/src/features/purchasing/components/PurchasingStatusFilterSheet.tsx` |
| Section board | `apps/mobile/src/features/purchasing/components/PurchasingFloorBoard.tsx` |
| PO card | `apps/mobile/src/features/purchasing/components/PurchaseOrderBoardCard.tsx` |
| PR / SI cards | `PurchaseRequestBoardCard.tsx`, `SupplierInvoiceBoardCard.tsx` |
| Create PO sheet | `apps/mobile/src/features/purchasing/components/CreatePurchaseOrderSheet.tsx` |
| Supplier picker | `apps/mobile/src/features/purchasing/components/PurchasingSupplierSheet.tsx` |

Chrome metrics: `PURCHASING_CHROME_CONTROL_H = 48`, `PURCHASING_CHROME_GAP = 10`. No stage spine on this hub.

## Users

| Piece | Path |
|-------|------|
| Hub | `apps/mobile/src/features/users/UsersListScreen.tsx` |
| Segment rail | `apps/mobile/src/features/users/components/UsersSegmentRail.tsx` |
| Filter triggers | `apps/mobile/src/features/users/components/UsersFilterTriggers.tsx` |
| User card | `apps/mobile/src/features/users/components/UserBoardCard.tsx` |
| Staff-type list | `apps/mobile/src/features/users/StaffTypesListScreen.tsx` |
| Staff-type card | `apps/mobile/src/features/users/components/StaffTypeBoardCard.tsx` |
| Staff-type editor | `apps/mobile/src/features/users/StaffTypeEditorScreen.tsx` |
| Roles touch bar | `apps/mobile/src/features/users/components/RolesTouchBar.tsx` |
| Sheet form | `apps/mobile/src/features/users/components/userSheetForm.tsx` |
| Create / edit | `CreateUserSheet.tsx`, `EditUserSheet.tsx` |
| Filter / dept / password | `UsersStatusFilterSheet.tsx`, `DepartmentPickerSheet.tsx`, `TempPasswordSheet.tsx` |

Hub stack: title → pill Add/Staff types → `UsersSegmentRail` → chrome board (search + floor triggers) → `UserBoardCard` list.

Card: 3px rail (brand if active, muted if not) → 44px initial disc → `StatusBadge dot` → inset roles/dept/login → footer chips + trash well.

5-stop bubble fills live on `UsersSegmentRail` / `RolesTouchBar` (wood → olive). Prefer those arrays when a rail has more than 3 tabs.

## Reports

| Piece | Path |
|-------|------|
| Hub | `apps/mobile/src/features/reports/ReportsScreen.tsx` |
| Pill tab bar | `apps/mobile/src/features/reports/components/ReportsTabBar.tsx` |
| Period chrome | `apps/mobile/src/features/reports/components/ReportsPeriodChrome.tsx` |
| Metric tiles | `apps/mobile/src/features/reports/components/ReportsMetricGrid.tsx` |
| Status ledger | `apps/mobile/src/features/reports/components/ReportsStatusRows.tsx` |
| Money ledger | `apps/mobile/src/features/reports/components/ReportsMoneyRows.tsx` |

Hub stack: title + subtitle → `ReportsTabBar` → `ReportsPeriodChrome` (sales / production only) → `DealerBoard` sections.

Snapshot = inset metric tiles. Status = inset badge ledger. Aging = inset money rows (warning 31–60, error 61+). No stage spine.

## Production

Layout is a factory desk, not a money stack. Aesthetic is the same board recipe.

| Piece | Path |
|-------|------|
| Hub | `apps/mobile/src/features/production/ProductionOverviewScreen.tsx` |
| Order card | `apps/mobile/src/features/production/components/ProductionOrderCard.tsx` |
| Task card | `apps/mobile/src/features/production/components/ProductionTaskCard.tsx` |
| Dealer trigger | `apps/mobile/src/features/production/components/ProductionDealerBar.tsx` |
| Hub jump (detail tabs) | `apps/mobile/src/features/production/components/ProductionHubJump.tsx` |
| Detail | `apps/mobile/src/features/production/ProductionDetailScreen.tsx` |
| Identity | `apps/mobile/src/features/production/components/ProductionIdentityBoard.tsx` |
| Materials header + cards | `ProductionMaterialUsageBoard.tsx` (`UsageRow` = the material card) |
| Issued / return cards | `ProductionMaterialsCard.tsx` (`MaterialRow`) |
| WIP section + kit cards | `ProductionWipSection.tsx` |
| WIP inspect sheet | `ProductionWipKitSheet.tsx` |
| Task sheet | `ProductionTaskSheet.tsx` |
| Assign / plan sheets | `AssignWorkerSheet.tsx`, `ProductionPlanAssignSheet.tsx` |
| Priority / delivery | `PriorityDeliverySheets.tsx`, `PriorityTouchBar.tsx` |
| Lifecycle / schedule | `ProductionLifecycleStrip.tsx`, `AdminScheduleStrip.tsx` |
| Skeleton | `ProductionSkeleton.tsx` |
| Inset / shadow helpers | `apps/mobile/src/features/production/productionFloorStyle.ts` (`productionBoardShadow`, `productionInsetStyle`) |
| `DealerBoard` accent | `accentColor` for late / blockers (`error`) |

**Hub stack:** pulse eyebrow + centered `largeTitle` → workflow board → lane tiles (selected = 3px **bottom** bar) → chrome board (dealer trigger + search) → `ProductionOrderCard` list. Tab root — no back lead.

**Order card:** rail → header band (status + high/late + Details) → 72px thumb + number/title → inset (dealer / delivery / stage / blocked) → progress + workflow hit. Late = error. High/urgent = warning.

**Task card:** same recipe. Header = status + priority + Details. Inset = worker / planned / lock. Progress bar in the body.

**Order detail stack:** identity (all tabs) → `ProductionHubJump` → section body.

| Tab | Body |
|-----|------|
| Overview | `DealerBoard` stack (cost, plan, readiness, assignments, progress, blockers) + task-chip board + `ProductionTaskCard` list + schedule + lifecycle + priority/delivery action rows + WIP preview |
| Materials | Slim materials `DealerBoard` (eyebrow + hint + count), then **sibling** material cards — do not nest cards inside the header board |
| WIP | WIP section board + kit cards |
| Tasks | Chip board (all / completed) + `ProductionTaskCard` list |

**Material card (`UsageRow` / `MaterialRow`):** rail → header band (usage status + SKU) → 56px SKU thumb + name → inset qty ledger. Over = error, under/extra = warning, unused = muted, on target = brand @ 0.55. Empty = `DealerEmptyPanel`.

**WIP kit card:** rail → header band (status + tap hint) → media + stage/name/QR + chips. Claimed = warning, ready = success olive. Never `colors.info`.

**Sheets (every press destination):** `BottomSheet` + `DealerBoard` body + `DealerFormFooter` or Primary/Secondary `full`/`xl`. Assign = worker rows with start rail when selected. Plan = one board per stage. Priority / delivery / task / WIP kit (facts, pieces, QR) match. Hours/minutes sit in an inset panel.

**Do not** reintroduce `DeskCard` / `SurfaceCard` / top-edge 3px bars. Keep one lifecycle strip. Shadow = `orderBoardShadow` (alias `productionBoardShadow`).

## Inventory

Layout is a stock desk, not a money stack. Aesthetic is the same board recipe.

| Piece | Path |
|-------|------|
| Hub | `apps/mobile/src/features/inventory/components/InventorySignatureHome.tsx` |
| Chrome | `apps/mobile/src/features/inventory/components/InventoryCompositionChrome.tsx` |
| Lifecycle / section pills | `InventoryLifecycleTabs.tsx`, `InventorySectionTabs.tsx` |
| Filter trigger | `apps/mobile/src/features/inventory/components/InventoryFilterButton.tsx` |
| Category rail | `apps/mobile/src/features/inventory/components/InventoryCategoryRail.tsx` |
| Low-stock board | `apps/mobile/src/features/inventory/components/InventoryLowStockFocus.tsx` |
| Material card | `apps/mobile/src/features/inventory/components/InventoryMaterialRow.tsx` |
| Semi / finished order cards | `InventorySemiOrderGroupCard.tsx`, `InventoryFinishedOrderCard.tsx` |
| Transfer / count cards | `InventoryTransferRow.tsx`, `InventoryStockCountRow.tsx` |
| WIP / FG lot rows | `InventoryWipKitRow.tsx`, `InventoryProductionRows.tsx` |
| Item detail | `apps/mobile/src/features/inventory/InventoryItemDetailScreen.tsx` |
| Identity | `apps/mobile/src/features/inventory/components/InventoryIdentityBoard.tsx` |
| Section board | `apps/mobile/src/features/inventory/components/InventoryBoardCard.tsx` |
| Sheet body / footer | `InventorySheetBody.tsx`, `InventorySheetFooter.tsx` |
| Receive / transfer / count sheets | `AddStockSheet.tsx`, `CreateTransferSheet.tsx`, `CreateStockCountSheet.tsx` |
| Semi / FG inspect | `InventorySemiOrderDetailSheet.tsx`, `InventoryLotInspectSheet.tsx`, `InventoryFgLotInspectSheet.tsx` |
| Skeleton | `apps/mobile/src/features/inventory/components/InventorySkeleton.tsx` |
| Inset / shadow helpers | `apps/mobile/src/features/inventory/inventoryFloorStyle.ts` (`inventoryBoardShadow`, `inventoryInsetStyle`) |

**Hub stack:** brand eyebrow + title → chrome board (lifecycle + section pills + search + scan/sync) → filter trigger (48px) → create / warehouse CTAs → `InventoryCategoryRail` on materials → list of floor cards. Tab root — no back lead.

**Material card:** rail → header band (stock status + Details) → 56px thumb + name/SKU → inset qty pills → footer chips. Low = warning.

**Semi / FG order card:** rail → header band (number + leave-by / progress) → media → inset packages / stages. Station / load = brand. Never `colors.info`.

**Item detail stack:** back lead + eyebrow → `InventoryIdentityBoard` → optional SKU photo → qty board → warehouse board → history cards.

**Sheets:** `BottomSheet` + `InventorySheetBody` / `InventorySheetFooter`. Selected picker rows = brandSoft + start rail.

**Do not** use `DeskCard` / `SurfaceCard` / `colors.info`. No stage spine. Shadow = `orderBoardShadow` (alias `inventoryBoardShadow`).

## Orders

Layout is a commercial desk, not a money stack. Aesthetic is the same board recipe.

| Piece | Path |
|-------|------|
| Hub | `apps/mobile/src/features/sales-orders/components/OrdersSignatureHome.tsx` |
| Chrome | `apps/mobile/src/features/sales-orders/components/OrdersCompositionChrome.tsx` |
| Filter trigger | `apps/mobile/src/features/sales-orders/components/OrdersFilterButton.tsx` |
| Filter sheet | `apps/mobile/src/features/sales-orders/components/OrdersFilterSheet.tsx` |
| Desk switch | `apps/mobile/src/features/sales-orders/components/AdminOrdersDeskSwitch.tsx` |
| Dealer trigger | `apps/mobile/src/features/sales-orders/components/OrdersDealerBar.tsx` |
| Factory review (3+2 cells) | `apps/mobile/src/features/sales-orders/components/OrdersRfqInboxChips.tsx` |
| Dealer lifecycle pills | `apps/mobile/src/features/sales-orders/components/OrdersFilterChips.tsx` |
| Admin lifecycle stations | `apps/mobile/src/features/sales-orders/components/AdminLifecycleChips.tsx` |
| Stage spine | `apps/mobile/src/features/sales-orders/components/OrdersStageSpine.tsx` |
| Order card | `apps/mobile/src/features/sales-orders/components/OrdersProgressCard.tsx` |
| List / detail | `OrdersListScreen.tsx`, `OrderDetailScreen.tsx` |
| Request detail | `apps/mobile/src/features/requests/AdminRequestDetailScreen.tsx` |
| Request identity | `apps/mobile/src/features/requests/components/RequestIdentityBoard.tsx` |
| RFQ stage rail | `apps/mobile/src/features/requests/components/RfqStageRail.tsx` |
| Quotation panel | `apps/mobile/src/features/quotations/AdminQuotationDetailScreen.tsx` |

**Hub stack:** brand eyebrow + title + `OrdersFilterButton` → search → `AdminOrdersDeskSwitch` → `OrdersDealerBar` → desk body → floor cards. Tab root — no back lead.

**Customer requests:** `OrdersRfqInboxChips` Factory review board. Header band + two-row cells (All open / Waiting / Needs info, then Quoted / Drafts). Selected = brandSoft + **3px bottom bar**. Never a sideways chip scroll.

**Request detail stack:** back lead → `RequestIdentityBoard` → `RfqStageRail` → `DealerBoard` stack (details / lines / attachments / factory review / quotations). Quotation tab = `AdminQuotationPanel` (hero total + inset ledger + line boards). Needs-info = warning. No `colors.info`.

**Filter sheet:** section boards with icon header band + sheet chips (start rail) + Primary / Secondary `full`.

**Do not** use `DeskCard` / `SurfaceCard` / `colors.info`. Stage spine stays on this floor only. Shadow = `orderBoardShadow`.

## Tokens (do not invent)

```
colors.background | surface | surfaceSecondary | border | borderStrong
colors.brand | brandSoft | brandActive | onBrand
colors.success | successSoft | warning | warningSoft | error | errorSoft
theme.radius.sm 6 / md 10 / lg 14 / xl 20 / full 9999
theme.spacing.xs 4 / sm 8 / md 12 / lg 16 / xl 20
theme.sizes.touch.min 44
pressScale.button 0.97 / card 0.985
```

Title weight: `locale === 'ar' ? 'medium' : 'semibold'`.
