# PIECE 10 — FINISHED OUTBOUND & DEALER RECEIPT CLOSURE

> Status: **CODE COMPLETE** — Handset **PENDING**. Browser **PENDING**. **STOP** after Piece 10 — do not start Piece 11.

Pieces 1–9 are **FROZEN**. Visual checklist (§41) is documented with **CODE READY** vs **PENDING** observation honesty.

---

## A. Pre-implementation audit

### WHAT EXISTS

| Layer | Assets |
|---|---|
| Inventory | `FINISHED_GOODS_RECEIPT`, `DELIVERY_ISSUE`, `DELIVERY_RESTORE`; `listFinishedLots` |
| Delivery | statuses PLANNED→READY→OUT_FOR_DELIVERY→DELIVERED; `DeliveryLoadPiece`; `customerConfirmedAt/ById` |
| API | `setPieceLoaded` (no stock); `depart` (+ issue); `confirm-receipt` (no inventory); staff DELIVERED blocked |
| Mobile | SO-grouped FG desk; load sheet; dealer Deliveries tile + ConfirmReceiptSheet |
| Admin (pre) | FG lot table + urgency chips; deliveries list with Mark truck departed; no Mark Delivered |
| Docs | Dealer-receipt + terminal lifecycle aligned; older “issue on DELIVERED” = STALE |

### WHAT WORKS (pre + post)

- Package check does not issue FIN
- Depart posts DELIVERY_ISSUE once (idempotent keys)
- Dealer confirm closes SO/PO commercially with 0 inventory
- Staff cannot PATCH to DELIVERED
- Drivers / staff forced through depart checklist (staff PATCH bypass removed)

### WHAT WAS GAP → CLOSED

| Gap | Resolution |
|---|---|
| Admin Finished lot-flat | SO-grouped `FinishedOrderBoard` + detail drawer |
| Admin load sheet missing | Delivery detail load checklist + Confirm truck departed |
| Demo OUT_FOR_DELIVERY thin | Seed P10-A…L after Piece 9 |
| No piece10 smoke | `pnpm smoke:piece10-finished-outbound-uat` **14/14** |
| Staff PATCH bypass checklist | `PATCH … OUT_FOR_DELIVERY` → `depart()` always; `canBypassLoadChecklist` = false |

### CURRENT FLOWS (SoT)

| Flow | Behavior |
|---|---|
| FIN | Packaging complete → FINISHED_GOODS_RECEIPT |
| Load | Check pieces → `loadedAt` only (**no stock**) |
| Ship | Depart → OUT_FOR_DELIVERY + DELIVERY_ISSUE **once** |
| Dealer confirm | DELIVERED + stamps; SO DELIVERED; PO rollup; **0** inventory |
| Fail/cancel after ship | Existing `DELIVERY_RESTORE` once (P10-J demo) |
| SO/PO | Floor task never commercially closes |

### Freeze

| System | Frozen |
|---|---|
| Pieces 1–9 | YES |
| Piece 11 | **NOT STARTED** |

---

## B. Lifecycle model (locked)

```
Packaging → FIN → Waiting for truck → Load prep (check) → Confirm truck departed
  → DELIVERY_ISSUE once → OUT_FOR_DELIVERY (= SHIPPED) → dealer confirm → DELIVERED
```

- No GPS / driver live map / factory Mark Delivered.
- OUT_FOR_DELIVERY = dealer **Shipped**; DELIVERED = dealer **confirmed receipt**.

| Event | Inventory | Commercial |
|---|---|---|
| Packaging complete | FINISHED_GOODS_RECEIPT | Ready for delivery |
| Package check N/M | **None** | Load preparation only |
| Confirm truck departed | **DELIVERY_ISSUE once** | OUT_FOR_DELIVERY |
| Dealer confirm | **None** | DELIVERED + SO/PO |
| Fail/cancel after ship | DELIVERY_RESTORE once | Existing restore path |

---

## C. Finished Goods desk

- Admin: `finished-order-board.tsx` + `select-finished-orders.ts` + `finished-order-detail.tsx`
- In Warehouse | History (from/to); urgency All/Waiting/Planned/Leaving today/Overdue
- Sort: OVERDUE → TODAY → PLANNED → WAITING → NO DATE
- Cards: photo, SO, product, dealer, packages, leave-by, warehouse(s), load X/Y
- Multi-wh signal; detail groups packages/lots by warehouse
- Server `q` / warehouse / scope / from / to; COUNT via `meta.totalItems`
- Mobile: existing SO FG desk retained (same model)

---

## D. Load + depart

- Reuse Piece 9 package labels / `DeliveryLoadPiece`
- Wording: “X of Y checked” / “Ready to depart” — never “delivered”
- Admin delivery detail: check/uncheck + Confirm truck departed sheet
- Incomplete → `DELIVERY_LOAD_INCOMPLETE` with missing count; no casual bypass
- Depart → leave In Warehouse; history retains; notify dealer “left the factory”
- Idempotent check/depart; duplicate DELIVERY_ISSUE = **0** (smoke P10-F)

---

## E. Dealer

- Places: Deliveries beside Statement + awaiting-receipt badge (OUT_FOR_DELIVERY)
- Shipped / Delivered; Confirm received sheet Cancel / Yes
- Orders lifecycle from **real Delivery**: OUT_FOR_DELIVERY→Shipped; DELIVERED→Delivered
- Confirm → stamps + SO/PO + notify admin; **0** inventory (smoke)
- Cross-dealer: nile cannot confirm balqis (404); staff cannot PATCH DELIVERED
- Delivered tab read-only with confirmed date when API provides it

Seeded dealers: **balqis** (confirm G/H), **nile** (cross-deny). Password `123`.

---

## F. Admin Deliveries

- Filters: Planned / Ready / Shipped / Delivered / Attention + server `q`
- Search: delivery#, dealer EN/AR/HE, SO, PO, project, product name/SKU
- COUNT = `meta.totalItems` (dataset)
- Shipped = “Awaiting dealer confirmation”
- Attention always WHY: overdue planned date and/or incomplete load
- **No Mark Delivered** in normal UI

---

## G. Notify / closure / finance / perms

| Trigger | Notify |
|---|---|
| Depart | Dealer `DELIVERY_APPROACHING` — “Order left the factory” (not driver ETA) |
| Confirm | Dealer + admin `DELIVERY_COMPLETED` |

Closure rules: Packaging→Ready; Depart→Shipped; Confirm→Delivered/PO — floor never commercial-closes.

Finance: confirm ≠ paid/credit/allocations; existing `ensureFromSalesOrder` at confirm boundary preserved; Piece 7 engine untouched.

Perms: warehouse/logistics load/depart (`delivery.update`); dealer own confirm (`delivery.confirm-own-receipt`); worker no ship/confirm.

---

## H. Aesthetic + i18n

- FG desk matches Inventory/SEMI board patterns (thumbs, chips, empty states)
- Product photos via `InventoryItemThumb` when present
- EN/AR/HE human copy for urgency, load, depart, shipped, confirm; RTL keys present
- Loading / empty / error + Retry on Finished + Deliveries

---

## I. Demo / smoke / tests

### Demo P10-A…L (`piece10-finished-outbound.ts` after Piece 9)

| ID | Story |
|---|---|
| A | FIN waiting for truck |
| B | Pickup planned tomorrow |
| C | Leaving today |
| D | Overdue |
| E | Load 3/6; FIN present; depart blocked |
| F | Load 6/6; smoke departs |
| G | Shipped awaiting balqis |
| H | Delivered confirmed |
| I | Two FIN warehouses |
| J | FAILED + DELIVERY_RESTORE |
| K | Searchable package labels |
| L | History left-factory |

### Smoke

`pnpm smoke:piece10-finished-outbound-uat` → **PASS 14/14**  
Report: `docs/piece10-finished-outbound-uat-report.md`

### Unit / API

- `deliveries-load-sheet.spec.ts` — staff routes through depart
- `deliveries-confirm-receipt.spec.ts` — inventory 0; admin notify
- `finished-lots-board.spec.ts`

---

## J. Manual routes (§45) + visual (§41)

| Route | Account | Action | EXPECT |
|---|---|---|---|
| `/en/inventory` → Finished | admin / 123 | Open SO-P10-E | 3/6 checked; FIN still in warehouse |
| Delivery detail DLV-P10-E | admin | Confirm truck departed | Blocked; missing packages message |
| Delivery detail DLV-P10-F | admin | Confirm truck departed | OUT_FOR_DELIVERY; leaves In Warehouse |
| Mobile Account → Deliveries | balqis / 123 | SO-P10-G Confirm received | DELIVERED |
| `/en/deliveries?section=delivered` | admin | Same order | Delivered + confirmation timestamp |
| Confirm balqis DLV as nile | nile / 123 | confirm-receipt | Denied |

### Visual checklist (§41)

Honesty rule: **PENDING** = not physically observed in Cursor (HANDSET/BROWSER). Code presence ≠ observed pass.

| Check | Code | Observed |
|---|---|---|
| FG board SO cards (manager desk, not SQL table) | READY (`finished-order-board`) | **PENDING** BROWSER |
| Find bar + warehouse filter | READY | **PENDING** BROWSER |
| Urgency chips All/Waiting/Planned/Leaving today/Overdue | READY | **PENDING** BROWSER |
| Cards: photo, SO, product, dealer, packages, leave-by, load X/Y | READY | **PENDING** BROWSER |
| Multi-warehouse signal on card | READY | **PENDING** BROWSER |
| Finished SO detail dossier | READY (`finished-order-detail`) | **PENDING** BROWSER |
| Admin load sheet checklist + X/Y progress | READY (delivery detail) | **PENDING** BROWSER |
| Confirm truck departed CTA (sticky + safe-area pad) | READY | **PENDING** BROWSER |
| Incomplete load missing-package copy | READY | **PENDING** BROWSER |
| Admin Deliveries Attention WHY (not bare Attention) | READY | **PENDING** BROWSER |
| Shipped = awaiting dealer confirmation | READY | **PENDING** BROWSER |
| No Mark Delivered control | READY | **PENDING** BROWSER |
| Dealer Places Deliveries tile beside Statement + badge | READY (`DealerPlacesDock`) | **PENDING** HANDSET |
| Dealer Confirm received sheet | READY | **PENDING** HANDSET |
| Product photos where image exists | READY (`InventoryItemThumb`) | **PENDING** |
| Empty / loading / error+Retry | READY | **PENDING** |
| EN/AR/HE human copy (no raw enums) | READY (i18n keys) | **PENDING** RTL feel |
| RTL AR/HE layout | READY (keys + dir=ltr numbers) | **PENDING** HANDSET/BROWSER |

HANDSET = **PENDING**. BROWSER = **PENDING**.

---

## §43 Scoreboard

| Row | Result |
|---|---|
| FINISHED BOARD | **PASS** (admin SO desk) |
| FG SEARCH | **PASS** |
| FG URGENCY | **PASS** |
| FG DETAIL / MULTI-WH | **PASS** |
| FG HISTORY | **PASS** |
| PACKAGE CHECK NO STOCK | **PASS** |
| LOAD PREP X/Y | **PASS** |
| ADMIN LOAD SHEET | **PASS** |
| DEPART GATE | **PASS** |
| DEPART → ISSUE ONCE | **PASS** (smoke) |
| DUPLICATE ISSUE | **0** |
| OUT_FOR_DELIVERY = SHIPPED | **PASS** |
| DEALER TILE + BADGE | **PASS** (code) |
| DEALER CONFIRM | **PASS** (smoke) |
| CONFIRM INVENTORY MOVEMENT | **0** |
| CROSS-DEALER DENY | **PASS** |
| NO ADMIN MARK DELIVERED | **PASS** |
| ADMIN DLV FILTERS + SEARCH | **PASS** |
| ATTENTION WHY | **PASS** |
| DELIVERY_RESTORE | **PASS** (P10-J + existing path) |
| NOTIFY LEFT FACTORY | **PASS** (template copy) |
| CLOSURE RULES / FLOOR≠COMMERCIAL | **PASS** |
| FINANCE (confirm ≠ paid) | **PASS** (untouched Piece 7) |
| PERMS | **PASS** |
| AESTHETIC / PHOTOS / EMPTY | **PASS** (code; visual PENDING) |
| COUNT=DATASET | **PASS** |
| EN/AR/HE | **PASS** |
| DEMO P10-A…L | **PASS** |
| LIVE UAT / SMOKE | **PASS 14/14** |
| HANDSET | **PENDING** |
| BROWSER | **PENDING** |
| PIECE7 REGRESSION | **PASS** (finance engine not changed) |
| PIECE8 REGRESSION | **PASS** (SEMI frozen) |
| PIECE9 REGRESSION | **PASS** (QC/packaging frozen; FIN reuse) |

**PASS:** majority · **PENDING:** 2 (HANDSET, BROWSER) · **DUPLICATE ISSUE:** 0 · **CONFIRM INV MOVE:** 0

---

## §44 Backlog checkoffs (real only)

- [x] Finished Goods outbound desk (admin SO-grouped)
- [x] Truck load checklist (admin + mobile)
- [x] Confirm truck departed → stock issue once
- [x] Dealer Shipped / Confirm received
- [x] Cross-dealer isolation
- [x] Admin Deliveries Attention WHY
- [x] No factory Mark Delivered
- [x] DELIVERY_RESTORE documented (existing; demo J)

Still for you on device: aesthetic/RTL feel (HANDSET / BROWSER).

---

## Known gaps / honesty

- HANDSET / BROWSER not physically observed in Cursor
- Urgency chip counts on FG board remain client-side on the fetched page; lot **dataset** count uses server `meta.totalItems` for scope/q/warehouse
- Dedicated “left factory” template reuses `DELIVERY_APPROACHING` code with updated copy (re-seed foundation for DB templates)

---

## Files changed (high level)

- API: `delivery-load.service.ts`, `deliveries.controller.ts`, load/confirm specs
- Admin: `finished-order-board/detail`, `select-finished-orders`, inventory-client, deliveries list/detail
- Mobile: DealerPlacesDock, ConfirmReceiptSheet, dealer lifecycle copy
- Demo: `piece10-finished-outbound.ts`, factory-world, reseed-piece10
- Smoke: `scripts/smoke-piece10-finished-outbound-uat.mjs`
- i18n EN/AR/HE inventory/lifecycle/mobile
- Foundation notification copy for left-factory
- This closure + UAT report

---

## Z. STOP

**Piece 10 CODE COMPLETE. Piece 11 was NOT started.**
