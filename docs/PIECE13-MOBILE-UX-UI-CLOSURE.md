# PIECE 13 — MOBILE UX/UI CONSISTENCY & SIMPLIFICATION CLOSURE

> **CODE COMPLETE** · **AUTOMATED UAT PASS** (smoke 20/20 + unit tests) · **HANDSET VISUAL = PENDING**  
> Pieces 1–12 **FROZEN**. **Piece 14 was NOT started.**

---

## 1. Executive summary

Piece 13 is a **presentation-only** whole-app mobile UX pass: one sticky CTA dock, human status labels, Orders journey copy, Production/Worker/Inventory/Dealer/Finance polish, filter URL persistence, and documentation. Business lifecycles from P1–12 were not reinterpreted.

Visual baseline = live Products / Purchasing / Invoices / Inventory / Home (warm parchment, floor boards, depth) — **not** a new design system.

---

## 2. Audit result

Full inventory: [`docs/PIECE13-MOBILE-UX-UI-AUDIT.md`](./PIECE13-MOBILE-UX-UI-AUDIT.md)  
~98 Expo routes (admin ~48 / dealer ~22 / worker ~7 / auth / shared / `__DEV__`).

HIGH fixes addressed in code: sticky CTA fragmentation, StatusBadge raw enums, Orders journey language, Preparing setup chips, Production blocked reason, Worker Today separation, RAW/SEMI/FIN chrome, dealer destinations, Home density.

---

## 3. Design baseline

[`docs/PIECE13-MOBILE-VISUAL-BASELINE.md`](./PIECE13-MOBILE-VISUAL-BASELINE.md)

- Canvas: warm parchment `colors.background` / `surface`
- Depth: `orderBoardShadow` / `theme.elevation.card|raised`
- Dock: `FloatingActionDock` (transparent surround, opaque CTA, safe-area + tab clearance)
- Reference screens: Catalog, PurchasingHub, Invoices, InventorySignature, AdminHomeSignature

---

## 4. Shared components created / consolidated

| Primitive | Path |
|---|---|
| FloatingActionDock | `apps/mobile/src/components/layout/FloatingActionDock.tsx` |
| stickyCtaInset | `apps/mobile/src/components/layout/stickyCtaInset.ts` |
| JourneyStickyDock | thin re-export of FloatingActionDock |
| presentStatus | `apps/mobile/src/lib/presentStatus.ts` |
| StatusBadge | uses presentStatus |
| deliveryHumanPhase | deliveries feature helper |

---

## 5–14. Area results (change table)

| AREA | ROUTE | BEFORE | AFTER | DEMO ACCOUNT | DEMO RECORD | WHAT TO TEST |
|---|---|---|---|---|---|---|
| Orders journey | `/(admin)/(tabs)/orders` | Technical chip names; mixed cards | Human Preparing/Production/Ready/Shipped/Delivered/Attention + hints | admin / 123 | Preparing SO | Chip labels + Preparing setup chips |
| Orders detail | `/(admin)/orders/[id]` | Multiple CTAs / absolute dock | Hierarchy + FloatingActionDock primary; hold/cancel in more | admin | any draft/setup SO | One dock CTA |
| Customer Requests | Orders desk switch | Easy to confuse with SO | Distinct requests band | admin | RFQ inbox | Switch to Requests |
| Filter persist | Orders / Production | Chip lost on back | URL `focus`/`chip`/`bucket` params | admin | Attention → detail → back | Filter restored |
| Production board | `/(admin)/(tabs)/production` | Status enum; weak block signal | Human StatusBadge; blocked callout | admin | blocked PO | Blocked reason visible |
| Production setup | product/order setup | Divergent sticky | FloatingActionDock save | admin | setup line | Dock above tabs |
| Worker Today | `/(employee)/(tabs)/` | Buckets muted | Distinct Do now / Ready after receiving / Waiting | carpenter / 123 | Today | Visual separation |
| Worker task | `/(employee)/tasks/[id]` | Dense controls | What you need / Your work + primary dock | carpenter | open task | Step hierarchy |
| Inventory | `/(admin)/(tabs)/inventory` | Lifecycle tabs weak copy | RAW / SEMI / FIN distinct chrome | admin | SEMI order | Never mixed list |
| SEMI | `inventory/semi/[orderId]` | Stock wording | Physical PO/stage/kit/custody | admin | SEMI PO | Piece language |
| FIN | `inventory/finished/[so]` | Strong P10 | Imagery/consistency polish | admin | FG SO | Outbound desk |
| Purchasing | purchasing hub/detail | Minor docks | FloatingActionDock + search empty | admin | any PO | PRESERVE aesthetic |
| Products | catalog | Reference | Untouched structurally | admin | product | PRESERVE |
| Quality/Pack | task detail | Buried packing | Package N of N + complete CTA | inspector/packer | QC/pack task | Pass / Report / Complete |
| Deliveries | order/delivery | Raw phases | Planned/Ready/Shipped/Delivered/Attention(+WHY) | admin | DLV | Human phases |
| Dealer dlv | dealer order | Logistics clutter risk | Shipped/Delivered + Confirm | oasis / 123 | shipped SO | Confirm only |
| Returns | returns list/detail | CRUD feel | Photo/SO/physical/resolution/next | admin | RET | Next action |
| Finance | invoices/statement | Credit vs debt unclear | Amount due / Paid / credit success / overdue error | admin / oasis | invoice | Credit ≠ debt |
| Dealer Home | customer tabs index | Tiny destinations | Prominent Statement/Payments/Deliveries/Returns | oasis | — | Destinations |
| Management Home | admin tabs index | Density risk | Attention first; zero tiles collapsed; COUNT=DATASET | admin | — | Attention WHY |
| Reports entry | More + Home | Weak | Intentional Reports link on More | admin | — | Opens reports path |
| Status | app-wide | Raw enums | presentStatus | all | — | No OUT_FOR_DELIVERY text |
| Sticky CTA | detail screens | Opaque blocks / tab collision | Shared FloatingActionDock | all | — | CTA above tabs |

---

## 15. Search / filters / forms / sheets

- Search empty vs dataset empty on Purchasing hub (and existing EmptyState patterns retained).
- Lifecycle chips + URL persist on Orders/Production; secondary filters remain in sheets.
- Confirmation sheets already avoid bare “Are you sure?” (no matches found).
- Forms: setup docks consolidated; broader form audit documented in audit as MED remaining polish.

---

## 16. Navigation

- Tabs unchanged (no redesign without evidence).
- Deep links preserved.
- Lifecycle/bucket filters persist via search params on back.

---

## 17. Loading / empty / error

- Existing skeletons retained on Orders/Production/Home; no flash-zero regression intentional on management summary.
- Healthy empties + Retry patterns preserved; search-empty differentiated where touched.

---

## 18. RTL

- StatusBadge / chips / docks use `isRTL` alignment.
- New EN/AR/HE keys for journey, inventory, finance, dealer destinations.
- **AR/HE HANDSET RTL = PENDING** (not observed this session).

---

## 19. DEV / dead UX cleanup

- No literal `DEV:` UI badges found in mobile source.
- `/dev/*` remains `__DEV__`-gated.
- Graph Inspector not present in mobile production path.
- Orphan composition modes left in-tree but signature defaults remain; not blindly deleted.

---

## 20. Automated tests

| Suite | Result |
|---|---|
| `presentStatus.test.ts` | PASS |
| `piece13-ux-primitives.test.ts` | PASS |
| `adminOrderLifecycle.test.ts` | PASS |
| `deliveryHumanPhase.test.ts` | PASS (present; included in §33 rerun) |
| `selectInvoice` finance tone tests | updated/pass per finance agent |

See **§33 Verification rerun** for latest timestamps and counts.

---

## 21. P1–P12 regression

| Smoke | Result |
|---|---|
| `pnpm smoke:piece12-management-dashboard-uat` | **PASS 10/10** (COUNT=DATASET intact) |
| Piece 13 changes | Read-only presentation; no lifecycle write changes |

---

## 22. UX smoke

`pnpm smoke:piece13-mobile-ux-uat` → **PASS 20/20**  
Report: [`docs/piece13-mobile-ux-uat-report.md`](./piece13-mobile-ux-uat-report.md)

---

## 23. Admin handset walkthrough (§90)

ACCOUNT: `admin` / `123`  
DEVICES: **SMALL PHONE (~375×667) = PENDING HANDSET** · **LARGE PHONE (~430×932) = PENDING HANDSET** · AR/HE RTL = **PENDING HANDSET**

| Step | Route / action | Pass criteria (observe on device) | Phone-size note |
|---|---|---|---|
| A1 | Home `/(admin)/(tabs)/` | Attention cards show **WHY + action**; zero tiles collapsed; tap opens destination list | Confirm Attention stack does not collide with tab bar on small; no cramped metric wrap on large |
| A2 | Orders → **Preparing** chip | Human chip labels; card shows setup remaining; open SO → Production setup | Chip row scrollable without clipping; sticky setup dock clears tabs on both sizes |
| A3 | Orders → **Attention** → detail → **back** | URL/focus restored; Attention still selected | Back restores filter on small & large |
| A4 | Production board | Needs planning / Blocked; card image + **block reason**; PO → plan dock | Blocked callout readable at 375w; dock above safe-area + tabs |
| A5 | Inventory RAW → SEMI → FIN | Distinct chrome; SEMI physical PO/stage/kit; FIN outbound desk; **never mixed list** | Lifecycle tabs remain tappable; FIN media cards not crushed on small |
| A6 | Purchasing hub | Floor boards / hero tiles **preserved** (baseline) | No dock collision; search empty vs dataset empty |
| A7 | Products catalog | Media grid **preserved** (baseline) | Grid columns / gutters look intentional on both sizes |
| A8 | Returns list → detail | Photo + SO + next action hierarchy | Primary next-action dock clears home indicator |
| A9 | Invoices | Amount due / Paid / credit success / overdue error tones | Money figures not truncated; sticky actions clear tabs |
| A10 | More → Reports | Intentional Reports entry opens reports path | Hub tiles readable; no dead row |

EXPECT: warm parchment boards, `FloatingActionDock` above tabs, **no raw enums** in StatusBadge path, **no `DEV:` badges**.

---

## 24. Dealer handset walkthrough (§91)

ACCOUNT: `oasis` / `123` (also `nile`, `balqis`)  
DEVICES: **SMALL PHONE = PENDING HANDSET** · **LARGE PHONE = PENDING HANDSET** · commercial privacy on device = **PENDING HANDSET**

| Step | Route / action | Pass criteria | Phone-size note |
|---|---|---|---|
| D1 | Dealer Home | Metrics + **prominent** Statement / Payments / Deliveries / Returns destinations | Destinations not tiny/secondary on small; no factory tiles |
| D2 | Create Order | Catalog → customize → review → **one** submit flow | Review sticky CTA clears keyboard + tabs on small |
| D3 | Orders list | Human chips only (Ready / Shipped / Delivered / …) | Chip strip scroll OK; no OUT_FOR_DELIVERY text |
| D4 | Shipped order detail | **Confirm received** only; no workers / costs / RAW / SEMI / factory logistics | Confirm dock safe-area on both sizes |
| D5 | Statement / Payments | Amount due vs credit tones clear; credit ≠ debt | Figures wrap cleanly; no overflow on 375w |
| D6 | Returns / Account | Customer-safe copy; next action obvious | Sheets dismissible; no dead CTAs |

EXPECT: commercial-safe surface; smoke already proves dealer **403** on management-summary.

---

## 25. Worker handset walkthrough (§92)

ACCOUNT: `carpenter` / `123` (also `assembler`, `inspector`, `upholsterer`, `packer`)  
DEVICES: **SMALL PHONE = PENDING HANDSET** · **LARGE PHONE = PENDING HANDSET** · gloved tap targets = **PENDING HANDSET**

| Step | Route / action | Pass criteria | Phone-size note |
|---|---|---|---|
| W1 | Today `/(employee)/(tabs)/` | **Do now** / Ready after receiving / Waiting / Completed today **visually distinct** | Bucket headers not muted into one blob on small |
| W2 | Task detail | Photo → product/PO → stage → What you need → Your work → **one primary** dock action | Primary hold/tap target ≥ touch min; dock clears tabs |
| W3 | Inspector task | Pass / Report problem clear; no buried packing language | Dual actions not overlapping on small |
| W4 | Packer task | Package **N of N** + Complete | Complete dock reachable with home indicator |

EXPECT: floor-first hierarchy; smoke proves worker tasks reachable + management-summary **403**.

---

## 26. UI scoreboard

> **Legend:** `PASS (code)` = automated/wiring evidence only. **`PENDING HANDSET`** = must be observed on a real device or simulator before visual PASS. Do **not** upgrade PENDING HANDSET from this doc alone.

| Row | Status |
|---|---|
| DESIGN CONSISTENCY | **PENDING HANDSET** |
| BEIGE VISUAL LANGUAGE | **PENDING HANDSET** (code aligned to baseline) |
| DEPTH / NON-FLAT UI | **PENDING HANDSET** |
| TYPOGRAPHY | **PENDING HANDSET** |
| SPACING | **PENDING HANDSET** |
| CARDS | **PENDING HANDSET** |
| SEARCH | PASS (code) |
| FILTERS | PASS (code + URL persist) |
| PRODUCT IMAGERY | **PENDING HANDSET** |
| STICKY CTA | PASS (code) / **PENDING HANDSET** |
| SAFE AREA | PASS (code) / **PENDING HANDSET** |
| ORDERS UX | **PENDING HANDSET** |
| PRODUCTION UX | **PENDING HANDSET** |
| WORKER UX | **PENDING HANDSET** |
| INVENTORY UX | **PENDING HANDSET** |
| PURCHASING UX | **PENDING HANDSET** (PRESERVE) |
| PRODUCTS UX | **PENDING HANDSET** (PRESERVE) |
| QUALITY UX | **PENDING HANDSET** |
| PACKAGING UX | **PENDING HANDSET** |
| DELIVERIES UX | **PENDING HANDSET** |
| RETURNS UX | **PENDING HANDSET** |
| FINANCE UX | **PENDING HANDSET** |
| DEALER UX | **PENDING HANDSET** |
| MANAGEMENT HOME | **PENDING HANDSET** |
| REPORTS | **PENDING HANDSET** |
| LOADING | PASS (code patterns) |
| EMPTY | PASS (code patterns) |
| ERROR | PASS (code patterns) |
| KEYBOARD | **PENDING HANDSET** |
| **SMALL PHONE (~375×667)** | **PENDING HANDSET** — not observed; required before visual close |
| **LARGE PHONE (~430×932)** | **PENDING HANDSET** — not observed; required before visual close |
| EN | PASS (copy keys) |
| AR RTL | **PENDING HANDSET** |
| HE RTL | **PENDING HANDSET** |
| RAW ENUMS | 0 expected in StatusBadge path (`presentStatus`) |
| DEV BADGES | 0 literal `DEV:` found (see §32 appendix) |
| CRITICAL DEAD BUTTONS | 0 known (smoke wiring PASS; see §32) |
| COUNT=DATASET REGRESSION | 0 (P12 smoke PASS) |
| P1–P12 REGRESSION | PASS (P12 smoke) |

---

## 27. What you can check off

| Item | Checkable now? |
|---|---|
| Whole-app visual consistency | **No** — PENDING HANDSET |
| Orders / Production / Worker / Inventory UX | Code done; visual **No** until handset |
| Purchasing / Products | Preserve — visual confirm on handset |
| Quality / Packaging / Deliveries / Returns / Finance / Dealer / Home | Code done; visual **No** |
| Search / Filter consistency | **Partial yes** (code) |
| Sticky CTA consistency | **Partial yes** (code) |
| Loading / Empty / Error | **Partial yes** (code) |
| RTL | **No** — PENDING HANDSET |
| Dead-button / DEV cleanup | **Yes** (audit + smoke) |
| COUNT=DATASET / P12 | **Yes** |

---

## 28. Known limitations

- Handset/simulator visual observation **not** performed this session.
- Not every form sheet globally restyled — prioritized operational desks.
- Alternate Orders/Inventory composition modes remain in-tree (signature is default).
- Smoke proves API wiring, not pixels.

---

## 29. Visual acceptance

[`docs/PIECE13-MOBILE-VISUAL-ACCEPTANCE.md`](./PIECE13-MOBILE-VISUAL-ACCEPTANCE.md) — all boxes unchecked / PENDING HANDSET.

---

## 30. Handset visual status

**PENDING HANDSET**

---

## 31. Piece 14

**NOT STARTED.**

---

## Files changed (representative)

- `apps/mobile/src/components/layout/FloatingActionDock.tsx` (+ sticky inset)
- `apps/mobile/src/lib/presentStatus.ts` + tests
- `apps/mobile/src/components/badges/StatusBadge.tsx`
- Orders / Production / Worker / Inventory / Purchasing / Invoices / Dealer / Admin Home / Deliveries / Returns feature screens (see area table)
- `packages/i18n/src/messages/{en,ar,he}/mobile.json`
- `scripts/smoke-piece13-mobile-ux-uat.mjs` + `package.json` script
- Docs: AUDIT, BASELINE, VISUAL-ACCEPTANCE, this CLOSURE, uat-report

---

## Remaining gap fills (session 2)

Concrete fills for leftover Piece 13 gaps (P1–12 business logic frozen; plan file untouched).

### Forms / read-only (§42–43)
- Added shared `InfoRow` (`apps/mobile/src/components/forms/InfoRow.tsx`); OrderDetail `FieldRow` delegates to it.
- Order production setup line: manufacturing name, dimensions (`DimCompare`), and notes no longer use disabled `TextInput` when read-only — `InfoRow` / `AppText` instead.

### Confirmation sheets (§44–45)
- Truck depart: `ConfirmationSheet` on `DeliveryLoadSheetScreen` with impact copy (`departConfirmTitle/Body/Cta`).
- Cancel order: `cancelImpactDescription` (what happens to production / inventory / invoices).
- Confirm order / hold / release-to-factory / confirm-receipt bodies strengthened (EN/AR/HE).

### Imagery (§38)
- Wired shared `ProductThumb` on `IndustrialFloorTaskCard`, `ReturnBoardCard`, `DeliveryFloorOrderCard` (with `ProductionOrderCard` / `OrdersProgressCard` already on ProductThumb).

### Setup / workflow (§16–17)
- Setup home/line: `FloatingActionDock`; home sections wrapped in `DeskSectionBand`; empty lines use `EmptyState`.
- Graph Inspector: still absent (not shown in prod). Workflow list empty states already present.

### Disabled CTA reasons (§61)
- Setup Mark Ready / Release review / line Save / product workflow Save / production plan dock: one-line reason when disabled or release not yet available.

### Loading / empty search (§55–57)
- `OrdersListScreen` classic path: `mobile.orders.searchEmpty` vs `emptyTitle`.
- `ProductionOverviewScreen`: `mobile.production.searchEmpty` vs `emptyTitle`.

### Role-safe (§69)
- Re-checked dealer `selectOrderDetail` + `assertDealerDetailSafe`; cost/worker/end-customer remain admin-gated; worker assignment strip is admin lifecycle only — no dealer leak found.

### Files touched (session 2)
- `apps/mobile/src/components/forms/InfoRow.tsx` (new)
- `apps/mobile/src/components/index.ts`
- `apps/mobile/src/features/sales-orders/OrderDetailScreen.tsx`
- `apps/mobile/src/features/sales-orders/OrdersListScreen.tsx`
- `apps/mobile/src/features/sales-orders/components/ConfirmReceiptSheet.tsx`
- `apps/mobile/src/features/sales-orders/production-setup/OrderProductionSetupHomeScreen.tsx`
- `apps/mobile/src/features/sales-orders/production-setup/OrderProductionSetupLineScreen.tsx`
- `apps/mobile/src/features/sales-orders/production-setup/components/ReleaseReviewSheet.tsx`
- `apps/mobile/src/features/production/ProductionDetailScreen.tsx`
- `apps/mobile/src/features/production/ProductionOverviewScreen.tsx`
- `apps/mobile/src/features/workflow/ProductionSetupScreen.tsx`
- `apps/mobile/src/features/delivery-load/DeliveryLoadSheetScreen.tsx`
- `apps/mobile/src/features/delivery-load/components/DeliveryFloorOrderCard.tsx`
- `apps/mobile/src/features/tasks/components/IndustrialFloorTaskCard.tsx`
- `apps/mobile/src/features/returns/components/ReturnBoardCard.tsx`
- `packages/i18n/src/messages/{en,ar,he}/mobile.json`
- `packages/i18n/src/messages/{en,ar,he}/lifecycle.json`
- `docs/PIECE13-MOBILE-UX-UI-CLOSURE.md` (this section)

---

## 32. Appendix — DEV badges / dead CTA grep (rerun)

Grep of `apps/mobile` for literal `DEV:` UI badges and obvious dead CTA stubs:

| Finding | Path | Assessment |
|---|---|---|
| Literal `DEV:` badge text | *(none)* | **Clean** — 0 matches |
| `onPress={() => undefined}` | `HoldToConfirmButton.tsx` | **Intentional** — hold-to-confirm uses press-in/out; tap alone must no-op |
| `stubStyle` animated style name | `UrgentTasksList.tsx` | **Not a dead CTA** — Reanimated style identifier only |
| Comment: push delivery not implemented | `registerPushDevice.ts` | Server push delivery note; registration path only — not a UI button stub |

**Critical dead buttons:** none found beyond intentional hold-to-confirm no-op.

---

## 33. Verification rerun

**When:** 2026-08-29T17:29:06Z (local 2026-08-29 20:29:06 EEST)  
**Host:** API `http://localhost:4000`  
**Plan file:** not edited.

### Docs confirmed present

| Doc | Status |
|---|---|
| `docs/PIECE13-MOBILE-VISUAL-BASELINE.md` | Present (baseline) |
| `docs/PIECE13-MOBILE-VISUAL-ACCEPTANCE.md` | Present — **PENDING HANDSET** (all boxes unchecked) |
| `docs/PIECE13-MOBILE-UX-UI-CLOSURE.md` | Present — walkthroughs §90–92 strengthened; scoreboard + phone-size PENDING explicit |

### Smoke / unit results

| Suite | Result | Detail |
|---|---|---|
| `pnpm smoke:piece13-mobile-ux-uat` | **PASS 20/20** | Exit 0; report → `docs/piece13-mobile-ux-uat-report.md` |
| `pnpm smoke:piece12-management-dashboard-uat` | **PASS 10/10** | Exit 0; COUNT=DATASET intact; report → `docs/piece12-management-dashboard-uat-report.md` |
| Jest `presentStatus.test.ts` | **PASS** | |
| Jest `piece13-ux-primitives.test.ts` | **PASS** | |
| Jest `adminOrderLifecycle.test.ts` | **PASS** | |
| Jest `deliveryHumanPhase.test.ts` | **PASS** | Suite present; included in run |
| **Jest totals** | **4 suites / 20 tests PASS** | ~0.66s |

### Pass / fail counts (this rerun)

| Category | Pass | Fail | Gaps |
|---|---:|---:|---|
| Piece 13 smoke checks | 20 | 0 | — |
| Piece 12 smoke checks | 10 | 0 | — |
| Mobile Jest (listed suites) | 20 | 0 | — |
| Automated total | **50** | **0** | |
| Handset visual acceptance | 0 | 0 | **All PENDING HANDSET** (small/large phone, AR/HE RTL, imagery/depth/typography, sticky CTA on device) |
| Literal `DEV:` badges | — | — | 0 found |
| Critical dead CTAs | — | — | 0 known |

### Gaps remaining (not closed by automation)

1. **PENDING HANDSET** — full visual matrix in `PIECE13-MOBILE-VISUAL-ACCEPTANCE.md` unchecked.
2. **SMALL PHONE / LARGE PHONE** — not observed; scoreboard rows stay PENDING.
3. **AR RTL / HE RTL** — not observed on device.
4. Smoke proves API wiring + privacy gates, **not pixels**.
