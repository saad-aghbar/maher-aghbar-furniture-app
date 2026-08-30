# PIECE 6 — PURCHASING, RECEIVING & INVENTORY COST CLOSURE

> Status: **CODE COMPLETE** — Handset **PENDING HANDSET**. Browser **PENDING**. **STOP** after Piece 6 — do not start Piece 7.

## A. Pre-implementation audit

### WHAT EXISTS

| Layer | Assets |
|---|---|
| DB | `Supplier`, `PurchaseRequest`, `PurchaseOrder`/`Line`, `GoodsReceipt`/`Line`, `InventoryTransaction`, warehouses |
| API | PR→offer→convert→PO approve/send→GRN; `GET /material-demand`; suppliers; PO PDF |
| Mobile | Purchasing hub, PO detail, create, receive |
| Admin | Purchasing hub, PO detail receive modal, material demand tab, suppliers |
| Piece 5 | `buildMaterialCostMap`: standardCost + latest costed `PURCHASE_RECEIPT` (**not** WA) |

### WHAT WORKS

- Happy path PR → PO → GRN qty → balance increase
- RAW_MATERIALS warehouse validation on GRN
- Per-line ledger idempotency key `grn:${grnId}:${itemId}`
- PO status → PARTIALLY_RECEIVED / RECEIVED from accepted qtys

### WHAT WAS MISLEADING (pre-fix)

- Mobile create labeled “unitCost” but posted PO `unitPrice` only
- GRN did **not** pass `unitCost` to `applyMovement` → Piece 5 map never saw receipt price

### WHAT PIECE 6 FIXED

- GRN line `unitCost` / `extendedCost` + costed `PURCHASE_RECEIPT`
- Over-receive block; request-level idempotency
- Partial receive UX; purchase variance; inbound `stillNeeded`
- Status classifier; permission packs; Needs → Add to purchase; date/category filters
- Attachments list; supplier last-purchase from GRNs; EN/AR/HE

### SOURCE OF TRUTH — VALUATION

**Piece 5:** `standardCost (>0)` + latest costed `PURCHASE_RECEIPT` via `buildMaterialCostMap`. **No weighted average.**

### Freeze

| System | Frozen |
|---|---|
| Piece 1–5 | YES |
| Workflow / scheduling / QC / Delivery | YES |
| Invoices / payables / dealer balance | YES (out of scope) |

---

## B. Lifecycle classifier

`purchase-order-presentation.ts` → `{ phase, labelKey, tone, progress, attentionReason, primaryAction }`.

Wired on list + detail. UI prefers phase labels (not raw enums). Attention only when overdue ETA + remaining.

---

## C. GRN cost + inventory + valuation

| Rule | Status |
|---|---|
| Line `unitCost` / `extendedCost` | DONE |
| Movement posts `unitCost` | DONE |
| Over-receipt blocked | DONE |
| Request + line idempotency | DONE |
| Accepted = received − rejected | DONE |
| `reservedQty` untouched on receipt | DONE |
| RAW warehouse only | DONE |
| `purchasingCosting` expected/actual/variance | DONE |
| Rejected qty in receive UX (mobile + admin) | DONE |

---

## D. Shortage + inbound + create-from-need

`materialDemand`: available/reserved/incoming/stillNeeded + `affected` origin + `category`/`standardCost`.

Filters: `?q=` + `?category=`.

UX: Needs → Add to purchase (cart) → Create PO with qty = stillNeeded; combine by item; general replenishment still OK.

---

## E. Search / filters

PO search: number, supplier, SKU, GRN. Filters: status, supplierId, **dateFrom/dateTo**. Count = filtered dataset.

---

## F. Edit / delete

- Draft: `PATCH /purchase-orders/:id/draft`
- Ordered: ETA `PATCH /purchase-orders/:id`
- Cancel blocked after any GRN; no hard-delete routes

---

## G. Permissions

PURCHASING + `inventory.receive`; WAREHOUSE_MANAGEMENT + `purchase-order.read`; dealers/workers deny (tests).

---

## H–I. Mobile + admin

- Home Needs cart, phase chips, date filters, elevated boards
- ReceiveGoodsSheet: partial, unit cost, rejected, RAW warehouse, review, scan-to-focus, idempotencyKey
- Supplier sheet: contact + lastPurchase from GRN history
- Admin: demand → Add to purchase, variance, attachments, receive costs

---

## J. Attachments + PDF + i18n

| Item | Status |
|---|---|
| Attachments | Upload categories `PURCHASE_ORDER:{id}` / `GOODS_RECEIPT:{id}` … listed on PO detail |
| PO PDF | Expected (`unitPrice`) |
| GRN PDF | **N/A** `GRN_PDF_NOT_AVAILABLE` |
| i18n | EN/AR/HE phases + receive/needs/variance |

---

## K. Readiness

After GRN: `retryWaitingMaterialOrders`; clients invalidate purchasing, material-demand, inventory, **production lists/summary**.

---

## L. Demo + smoke + tests

Seed `PO-P6-A…J` in `piece6-purchasing-receiving.ts` (after Piece 5).

`pnpm smoke:piece6-purchasing-receiving-uat` — 22 live asserts.

Automated: presentation, goods-receipt-cost, privacy, staff packs, permission-meta, material-demand.

---

## M. WHERE TO TEST (manual routes)

| Surface | Verify |
|---|---|
| Mobile Purchasing hub | Needs → Add to purchase → create; date filters; phase chips |
| Mobile PO-P6-C / E | Partial remaining; variance; receive sheet + rejected |
| Mobile supplier pick | Contact + last purchase |
| Admin `/purchasing` | Demand add-to-PO; dateFrom/To; phase labels |
| Admin PO detail | Attachments; receive unitCost/rejected; variance |
| Inventory after GRN | Balance + costed PURCHASE_RECEIPT |
| Piece 5 SO-P5-A | Stored costs stable after later receipts |
| PDF | PO expected; GRN N/A |

---

## Scoreboard (§51)

| Gate | Result |
|---|---|
| CODE COMPLETE | **YES** |
| AUTO TESTS | **PASS** |
| LIVE UAT smoke | **PASS 22/22** (`tmp/piece6-purchasing-receiving-uat.json`) |
| BROWSER | **PENDING** |
| HANDSET | **PENDING HANDSET** |

### Backlog (§52)

| Eligible | Not eligible |
|---|---|
| Purchasing / receiving / suppliers / inventory cost foundation | Invoices, payables, dealer statements |

---

## Z. STOP

**Piece 6 closed for code.** Do **not** start Piece 7.

### Known gaps (honest)

- Supplier returns / reverse GRN incomplete (rejectedQty only)
- No casual over-receipt override (blocked by design)
- GRN PDF not produced (explicit N/A)
- Document model has no FK to PO — category tagging only
- Domain may have a single RAW warehouse (P6-I notes this)
