# Cost & Performance overhaul report

Shipped sequentially: one costing engine on the API, then six purpose-built mobile desks. This is not a visual restyle. An admin with `inventory.cost.read` can drill every important number to its source. Dealers never see manufacturing cost.

**Do not treat this as net profit, EBITDA, or COGS.** Sale value, actual production, after-sale, inventory value, purchase spend, and collection stay separate.

Nile walkthrough `Golden factory path` (typically `SO-2026-00026` after `demo:reset`) stays **READY_FOR_PRODUCTION** with the four-line mix and no posted actuals — completing it would break the golden order-to-factory report.

Live **294 / 630 / 336** after `demo:reset` is sibling **`SO-COST-GOLDEN`** (Nile), derived from posted `InventoryTransaction` + `TaskTimeEntry` × dated `LaborRate` + invoice/SO line totals + `Delivery.actualDeliveredAt`. Same four-line manufacturing mix:

| Line | Mix | Actual |
|---|---|---|
| STD qty 2 (collective) | materials 64 + waste 8 + labor 25 | **97** |
| KARINA STANDARD | fabric 60 + labor 10 | **70** |
| MODIFIED | materials 50 + labor 15 | **65** |
| CUSTOM | materials 12 + labor 50 | **62** |
| **Order actual** | | **294** |
| Sale (line totals 200+180+150+100) | | **630** |
| Gross production margin (coverage complete) | 630 − 294 | **336** |

Qty 2 stays collective: total + average per unit. Never a fake per-physical-piece cost.

---

## 1. Audit freeze

Before this overhaul the mobile floor was a god-screen: sticky title/rail/period, Money totals from page 1 of cost-orders, Sunday vs Monday week drift, no Inventory economics desk, dossier gated with `report.inventory.read`. The API already had `CostPerformanceService`; the phone was inventing a second ledger. `GET /reports/period-pl` and `order-profit` stay unused for this product.

## 2. Costing language

| Concept | Source of truth | Date basis | Trust |
|---|---|---|---|
| Catalog cost | Frozen planned on SO/PO | Snapshot at freeze | Shown as planned, never as actual |
| Actual production | Posted `InventoryTransaction` + `TaskTimeEntry` | Execution / tx `createdAt` | Stored `unitCost` / dated `LaborRate` |
| After-sale | Return-origin POs | Return activity | Shown separately; recovered value **not** netted |
| Inventory value | Current balances × canonical item cost | **As-of now** | Labelled CURRENT; no fake historical as-of |
| Purchase spend | `PURCHASE_RECEIPT` | Tx date | Not a production cost |
| Sale value | Latest non-cancelled invoice subtotal else SO/line totals | Commercial date | Ex-tax |
| Collection | Payments on invoices | Payment date | Off margin |

## 3. Actual production formula

```
materials (non-fabric ISSUE − RETURN)
+ fabric (fabric ISSUE − unused fabric RETURN)
+ labor (priced actual minutes only)
+ attributable waste/scrap
+ attributable rework
= actual production cost
```

Transfers, receipts, and WIP/FIN output are not consumption. Missing components stay null. Never `?? 0` into margin.

## 4. Materials and dual SOT

Money uses posted txs (`PRODUCTION_ISSUE` − `PRODUCTION_RETURN`) with stored `unitCost`. `ProductionTaskMaterialUsage` is qty/scrap provenance. Usage scrap with frozen `unitCost` fills waste only when no matching `SCRAP`/`DAMAGE` tx. Never add usage extended cost on top of the same ISSUE.

## 5. Fabric

Take-in already posts `PRODUCTION_ISSUE`. Mix splits fabric vs other materials by item class/group (`FABRIC`). Procurement receipt is not production.

## 6. Labor

`TaskTimeEntry` minutes × dated `LaborRate` on the entry date. Unique entry ids. Never add `ProductionTask.actualMinutes` on top. Missing dated rate → **Labor rate missing** / `MARGIN INCOMPLETE`. No schema snapshot in this overhaul.

## 7. Margin and sale vs collection

`grossProductionMargin` = sale − actual **only when coverage is complete**. Otherwise **MARGIN INCOMPLETE**. Invoice subtotal, collected, and outstanding display separately. Collection is never subtracted from factory margin.

## 8. Date basis

Default **Delivered** uses `Delivery.actualDeliveredAt` on outbound deliveries (there is no `SalesOrder.deliveredAt`). **Production activity** uses tx/timer dates. **Order date** uses `orderDate`. Human labels only — no DB field names on the phone. Factory week is **Sunday→today**. Dead Monday `period.ts` was deleted.

## 9. Display tokens

Never silent zero. Tokens: `—` / Not costed / Partially costed · n% / Labor rate missing / No actual usage yet / No completed orders in this period. Tap incomplete margin → explanation sheet.

## 10. Information architecture

Six desks: Money, Orders, Products, Inventory, Returns, Coverage. 3+3 rail (same family as customer-request inbox chips). Whole page scrolls — title, rail, and period live in the `ScrollView` / `ListHeaderComponent`. Bottom inset `SURFACE_TAB_BAR_CLEARANCE`.

Routes: `/(app)/(admin)/reports` (Money for cost.read, else sales/production/financial fallback). `/reports/orders|products|inventory|returns|coverage`. Keep `/reports/order/[id]` and `/reports/returns/[id]`. Added product, variant, custom-work, inventory item, and coverage issue routes.

## 11. Period and custom calendar

Today / Week / Month / **Custom**. Custom uses tap-start → tap-end (`nextDateRange` + `MonthCalendar`) with Apply / Clear / Cancel. Selected range under chrome. `ReportsPeriodProvider` in `reports/_layout.tsx` keeps from/to/basis through drilldowns. Drilldown hrefs also pass `from`/`to`/`basis`.

## 12. Filters

Per-desk sheet + `Filters · n` + removable chips + Clear all. Server query params only. No fake local search over page 1. Orders search is server `q` (SO / dealer / model / variant).

## 13. Money desk

`GET /reports/cost/money` is the SOT. One Factory Money board: sale / actual + coverage / margin %. One mix composition (materials, fabric, labor, waste, rework). Secondary: Invoiced / Collected / Outstanding / After-sale / Purchase inflow / Current inventory value. Factory Activity: cost incurred, worker hours, material consumption, finished output. Attention rows use the **same predicates** as the Orders/Coverage lists they open.

## 14. Orders desk and Cost Order Dossier

Server search, sort (highest cost, lowest/highest margin, longest time, largest sale, newest), filters (dealer, lifecycle, STANDARD/MODIFIED/CUSTOM, delivered/active, coverage, margin health, return, rework). Cards: SO, dealer, items, sale, actual, margin, time, coverage. Dossier: identity, line boards (qty > 1 = total + average/unit), material provenance, time, after-sale, human transaction labels. Line mix sums to line actual; lines sum to order actual (golden 97+70+65+62=294).

## 15. Products and custom work

Server product/variant aggregates from historical actuals (assemble mix + labor entries), not live catalog cost. CUSTOM stays in **Custom work**, not a fake Product. Profiles show period performance and planned catalog baseline labelled as catalog-only.

## 16. Inventory economics

Not the operational Inventory tab. Current value RAW / SEMI / FIN and Fabric / Wood / Foam / Accessories. Period flow: receipts, out to production, unused returns, WIP output, finished output, waste, recovery, **transfer (neutral, not consumption)**, adjustment. Item ledger paginated. Label **CURRENT INVENTORY VALUE**.

## 17. Returns

Case cards: RT, original SO, dealer, pieces, original production, after-sale, lifetime factory cost, recovered value. Dossier by piece branch (repair / replacement / recovery). Recovered value shown separately, **never silently netted**. Lifetime = original production + attributable after-sale. Net economic effect is a separately labeled metric only.

## 18. Coverage

Large %: orders fully costed, material, fabric, labor-time, labor-price, inventory valuation. Tap → `GET /reports/cost/coverage/issues?type=` exact records, including unpriced issues, unpriced SKUs, unlinked lines, and transactions without attributable work. Catalog receipt backfill remains **optional standardCost only**, never rewriting historical actuals to 100%. Records that cannot be historically repaired stay **Historical cost basis unavailable**.

## 19. Permissions, i18n, tests

Cost desks and all cost drilldowns require **`inventory.cost.read` only**. Overflow `/reports` still opens for `report.sales/production/financial.read` (fallback desks). EN / AR / HE. SO/PO/SKU/RT stay `dir="ltr"`. Calendar RTL uses the shared month board.

API tests cover issue−return, transfer not consumption, historical unitCost, missing labor rate, waste, rework, incomplete margin, golden rollup, date basis, product stats, and Money desk totals matching the Orders list. Mobile tests cover Money, Orders, Products, Inventory, Returns, Coverage, dossiers, and the floor contract (no `DeskCard` / `colors.info`).

## 20. Deterministic Cost UAT data

Seeded by `packages/database/prisma/demo/cost-performance-uat.ts` after catalog, stock, orders, people, and pieces 5–11. Wipe/rebuild uses distinctive `SO-COST-*` / `RT-COST-*` / `TSK-COST-*` numbers. Worker `cost.unpriced` has a stage skill and **no** `LaborRate` (floor workers keep placeholder ₪25/h). Demo clock: **2026-09-12 14:00 Asia/Amman**.

| Ref | What it proves after `demo:reset` |
|---|---|
| `SO-COST-GOLDEN` | Live **294 / 630 / 336**, 100% coverage, CUSTOM `productId` null, delivered + `actualDeliveredAt` |
| `SO-COST-PROFIT` | Complete coverage, positive margin |
| `SO-COST-LOW` | ~10% margin from real txs/time (not a fake %) |
| `SO-COST-LOSS` | Actual > sale; attention because the numbers say so |
| `SO-COST-PARTIAL` | Timed labor + missing dated rate → PARTIAL, labor ≠ 0 |
| `SO-COST-NORATE` / `cost.unpriced` | Coverage `labor_price` lists the order; time known, price missing |
| `SO-COST-UNUSED` | ISSUE 10, PRODUCTION_RETURN 2 → consume 8 |
| `SO-COST-WASTE` | SCRAP/DAMAGE separate from ISSUE; still in actual when rules say so |
| `SO-COST-REWORK` | `isRework` task + attributable txs/time |
| `SO-COST-FAB-OLD` / `FAB-NEW` | Historical ISSUE `unitCost`s; later catalog `standardCost` must not rewrite old txs |
| `SO-COST-VAR-*` | SOF-3S-STD STD / KARINA / UKR across several orders |
| `SO-COST-CUSTOM-*` | Extra CUSTOM lines; excluded from product aggregation |
| `SO-COST-LIFE` + `RT-COST-*` | Lifetime = original + after-sale; recovered **not** netted |
| `RT-COST-REPAIR` / `REPL` / `RECOVERY` | Repair / replacement / scrap-recovery with real return-origin work |
| `COST-GAP-TRIM` | Unpriced SKU (valuation gap) |
| `SEMI-COST-FRAME` / `FIN-COST-SOFA` | Priced SEMI 80 / FIN 220 in current inventory value |
| `WHT-COST-1` | Signed `WAREHOUSE_TRANSFER`; not consumption |

`demo:validate` asserts golden 294/630/336, low/loss/partial/unused-return, recovery recovered-value rows, gap SKU, and priced SEMI/FIN. Cost APIs are not given fake `money.actualCost` seeds.

## 21. Simulator UAT

**Not a physical iPhone pass.** Device: iPhone 17 Simulator, iOS 26.5. Account **`admin` / `123`**. `pnpm demo:reset` + `pnpm demo:validate` passed (206 sales orders). Walk screenshots were captured on the agent machine under `/tmp/cost-uat/`.

Device civil date during the walk was **2026-09-14** (Monday), so in-app **Today** is 14 Sep and **This week** is Sunday 13 Sep → 14 Sep. Seeded “week not today” rows (~8 Sep) sit in **This month**, not This week, relative to the Simulator clock. API month (delivered) matched Money **₪29,933.60**.

| Area | Result | Notes |
|---|---|---|
| Date-basis wood bar | **PASS** | Delivered / Activity / Order date; `cost-basis-*` testIDs; RTL `row-reverse` |
| Period 2×2 | **PASS** | Today / Week / Month differ (coverage 71.4% / 75% / 50% on Delivered in an earlier walk; Activity month coverage **81%**) |
| Custom calendar | **PASS** | Parchment board, From/To, month nav, Apply / Clear / Cancel; connected range wash uses `calendarLoadLight` |
| Whole-page scroll | **PASS** | Chrome in `ListHeaderComponent`; tab bar inset `SURFACE_TAB_BAR_CLEARANCE`. First coverage metric sits on the fold — scroll to tap. |
| Money | **PASS** | Sale title vs quieter actual; Activity vs Delivered changes sale (₪16,380 vs ₪29,933.60) |
| Orders cards | **PASS** | SO title, dealer, date, actual first, muted sale, margin, coverage |
| Golden dossier | **PASS** | `SO-COST-GOLDEN` sale **630**, actual **294**, margin **336**, Final. STD 97 (64+25+8, avg 48.50). CUSTOM 62. Labor **Khaled Obeid** ₪100 · 4.0 h |
| Products | **PASS** | Localized names; compact STD / Karina velvet / Ukrainian linen |
| Inventory value | **PASS** | TOTAL ₪122,711.09 → RAW 121,351.09 / SEMI 480 / FIN 880 → Fabric/Wood/Foam/Accessories |
| Inventory flow | **PASS** | Receipts 288, out to production 26,444.60, unused return 16, WIP 480, FIN 880, waste 28, recovery 30, **transfer 48 + hint**, adjustment 8 |
| Returns | **PASS** | Recovered inset separate; `RT-COST-RECOVERY` original 96 / after-sale 28 / lifetime 124 / recovered **30** (not netted) |
| Coverage copy | **PASS** | % + label + one-line explain + `{n} records` + Review N |
| Coverage drill | **PASS** | `labor_price` → `SO-COST-NORATE` + `SO-COST-PARTIAL` with id + number; tap opens dossier. Incomplete ≠ ₪0 (`Margin incomplete`, labor `—`) |
| Server search | **PASS** | Returns `recovery` → `RT-COST-RECOVERY` (not only page-1 `RET-UF-*`) |
| Sort | **PASS (API)** | `sort=lowestMargin` → `SO-COST-LOSS` then `SO-COST-LOW`. Filter sheet rails exist (`RolesTouchBar`); live sheet tap was not captured (chrome crowding vs tab bar) |
| EN / AR / HE | **PARTIAL** | Keys present in `en`/`ar`/`he` (`basis*Short`, `flow.transfer`, `issueExplain.*`). In-app locale switcher on More was not reached (tab bar sits on the home-indicator edge in this Simulator window) |
| Keyboard vs search | **FIXED in code** | Search field was covered by the software keyboard. Desk `FlatList`s now set `automaticallyAdjustKeyboardInsets` |

**Defects found and fixed in this pass**

- Unpriced timed labor: `rollupLaborCost` dropped `byWorker` / `byStage` when every entry lacked a matching rate. Minutes now remain; actual stays null.
- Dossier Time board showed **UNKNOWN / NaN h** and **0.0 h** when only `TaskTimeEntry` minutes existed. Dossier effort now prefers `labor.timedMinutes`; stage rows use `minutes`; UI guards NaN.
- Custom range strip was invisible on parchment (`brandSoft` ≈ surface). In-range days use `calendarLoadLight`.
- Inventory flow now includes recovery / transfer / adjustment from nested `factoryActivity.flow`.

**Unresolved (not this task)**

- Physical iPhone UAT.
- Golden wall-clock **218 h** is PO start→complete span, not worker effort (effort is 4.0 h). Do not add them.
- Simulator “This week” follows the **device** Sunday week, not the frozen demo clock.
- Coverage Review on the first metric is easy to miss under the floating tab bar until you scroll.

**Honest remaining limitations**

- No historical inventory as-of (labelled CURRENT). Canonical item cost is catalog `standardCost` on the balance, not a reconstructed lot layer.
- No labor-rate schema snapshot; dated `LaborRate` rows are the historical basis.
- Scrap txs that cannot be attributed to a PO stay on factory activity, not silently stuffed into an unrelated order.
- Product analytics still loads matching orders in memory (capped like Money at the order-where). Very large periods may paginate products after a 500-order assemble.
- After-sale on Money uses return-origin production orders in the period, not a second phone-side engine.
- `GET /reports/period-pl` remains a different, non-authoritative report.

Complete because an admin can make factory decisions and drill important numbers to source — not because the parchment looks better.
