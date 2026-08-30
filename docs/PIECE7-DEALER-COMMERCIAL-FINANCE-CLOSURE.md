# PIECE 7 — DEALER COMMERCIAL FINANCE CLOSURE

> Status: **CODE COMPLETE** — Handset **PENDING HANDSET**. Browser **PENDING**. **STOP** after Piece 7 — do not start Piece 8.

**TAX POLICY: SNAPSHOT FROM ORDER (NOT RECONFIGURED)**

---

## A. Pre-implementation audit

### WHAT EXISTS

| Layer | Assets |
|---|---|
| DB | `DealerPrice`, `SalesOrder`/`Line` (unitPrice snapshot), `Invoice`/`InvoiceLine`, `Payment` (optional single `invoiceId`), `StatementEntry` (seed-only) |
| API | `POST /invoices` from SO; `POST /payments`; `GET /statements/:customerId` (+ PDF); JoFotara on create |
| Mobile | Invoice floor UI, RecordPaymentSheet, dealer statement, dealer account |
| Admin | Invoices list/detail; customer SOA; `/payments` redirects to invoices |
| Piece 5 | `manufacturingCosting` stripped for dealers |

### WHAT WORKS

- Quote → SO copies commercial `unitPrice`
- 1 invoice per SO via `ensureFromSalesOrder`
- Payment with optional single invoice apply + idempotencyKey
- Dealer-scoped invoice/payment/statement reads
- Delivery confirm-receipt auto-ensures invoice (does not pay)

### WHAT IS DUPLICATED / MISLEADING (pre-fix)

- Statement opening balance hardcoded `0.000`
- `StatementEntry` unused by live API
- Payment rejects overpay when invoice selected (`PAYMENT_EXCEEDS_OUTSTANDING`) — blocks advance credit
- No commercial price gate for MODIFIED/CUSTOM

### WHAT WAS MISSING (Piece 7 scope)

- `PaymentAllocation` + unallocated advance credit
- Explicit Apply credit (no silent auto-apply)
- Canonical due vs credit finance service
- Commercial price status on SO lines
- Real admin payments list; SO commercial summary; full smoke/demo P7-A…L

### SOURCES OF TRUTH

| Concept | Source |
|---|---|
| Sale price | SO line `unitPrice` snapshot (from DealerPrice at quote) |
| Invoice total | Copied from SO at issue (immutable thereafter) |
| Invoice paid/remaining | Derived from `PaymentAllocation` sums → `paidAmount` / `outstandingAmount` |
| Available credit | `Σ(payment.amount − Σ allocations)` |
| Amount due | `Σ invoice.outstandingAmount` (open, non-void) |
| Statement | Live from invoices + payments (not `StatementEntry`) |
| Tax | **TAX POLICY: SNAPSHOT FROM ORDER (NOT RECONFIGURED)** |

### Advance-credit SoT

Unallocated credit = payment amount minus sum of its allocations. No `Customer.balance` field.

### Freeze

| System | Frozen |
|---|---|
| Piece 1–6 | YES |
| Workflow / scheduling / QC / delivery UX | YES |
| Purchasing / Piece 5 costing engine | YES |

---

## B. Schema decisions

| Change | Decision |
|---|---|
| `SalesOrderLine.commercialPriceStatus` | `CATALOG` \| `REQUIRED` \| `CONFIRMED` (+ `commercialPriceSource`, `commercialPriceNote`) |
| `PaymentAllocation` | `paymentId`, `invoiceId`, `amount`, audit; SoT for paid/remaining |
| Legacy `Payment.invoiceId` | Kept as convenience/primary hint; demo + runtime dual-write allocations |
| `StatementEntry` | Remains seed/legacy only — live statement does not read it |
| No `Customer.balance` | Credit = unallocated payments only |

---

## C. Commercial sale price

| Class | Status at SO | Invoice |
|---|---|---|
| STANDARD | `CATALOG` (DealerPrice → basePrice snapshot) | Allowed if `unitPrice > 0` |
| MODIFIED | `REQUIRED` until staff confirm | Blocked (`COMMERCIAL_PRICE_REQUIRED`) |
| CUSTOM | `REQUIRED` until staff confirm | Blocked until `CONFIRMED` |

- Missing / zero price ≠ free — blocked.
- Staff: `POST /sales-orders/:id/confirm-commercial-prices`.
- Later DealerPrice edits do not rewrite accepted SO line snapshots.
- Issued invoice lines are commercial snapshots — not rewritten from SO edits.

---

## D. Finance SoT (`dealer-finance.ts`)

Canonical helpers (frontends must not recompute):

| Metric | Formula |
|---|---|
| `amountDue` | Σ open invoice `outstandingAmount` |
| `availableCredit` | Σ `paymentUnallocated` |
| `netPosition` | due − credit (internal; UI shows two heroes) |
| Conservation | `payment.amount = Σ(alloc) + unallocated` |
| Invoice paid/remaining | `recomputeInvoicePaidFromAllocations` (never negative) |
| Apply credit plan | `planFifoCreditApplication` (oldest payments first) |
| Statement | `buildStatementLedger` opening / running / closing |

Wired on invoice detail, payment enrich, dealer summary, statements, customer admin header.

---

## E. Invoice lifecycle

| Rule | Status |
|---|---|
| Create when commercial complete | DONE (`commercialLinesReady`) |
| 1 invoice per SO (`ensureFromSalesOrder` / create) | DONE |
| Snapshot totals + tax from SO | DONE — **TAX POLICY: SNAPSHOT FROM ORDER** |
| Phase classifier ISSUED / PARTIAL / PAID / OVERDUE | DONE |
| Idempotency on create | DONE |
| Search + status/dealer/date filters | DONE (list APIs) |
| Overdue filter count = dataset | DONE (`overdue=true` in Prisma where, not post-page filter) |
| Home chips All/Draft/Open/Partial/Overdue/Paid | DONE (mobile) |
| Void / hard-delete | **GAP** — not shipped; document only |

---

## F. Payment + allocation + overpay

| Rule | Status |
|---|---|
| Multi-invoice allocations | DONE |
| Overpay → unallocated advance credit | DONE |
| Σ alloc ≤ payment; alloc ≤ open | DONE |
| Cross-dealer alloc blocked | DONE |
| IdempotencyKey | DONE |
| Hard-delete / void payment | **GAP** — no casual delete |

Record UX shows: Payment / Allocated / Added to account credit.

---

## G. Apply credit (HARD GATE)

| Rule | Status |
|---|---|
| Explicit preview + confirm | DONE (`previewApplyCredit` + `POST …/apply-credit`) |
| FIFO oldest unallocated payments | DONE |
| No new Payment row | DONE |
| Caps at invoice outstanding | DONE (never negative) |
| No silent auto-apply | DONE |
| Dealer read-only (no `payment.record`) | DONE |

---

## H. Statement

| Rule | Status |
|---|---|
| Real opening balance before `from` | DONE |
| Chronology invoices + payments | DONE |
| Payments credit once (no double-count alloc) | DONE |
| Amount due vs Account credit language | DONE |
| Live from Invoice + Payment (not StatementEntry) | DONE |
| Statement PDF | DONE (`GET /statements/:customerId/pdf`) |

---

## I. Manufacturing separation

| Rule | Status |
|---|---|
| Sale price ≠ Piece 5 manufacturing cost | DONE |
| Dealer APIs strip `manufacturingCosting` | DONE (Piece 5 + P7) |
| Admin gross difference only if cost FINAL | DONE (else unavailable) |
| P7-J: commercial OK + null mfg cost still invoices | DONE |

---

## J. Delivery separation

| Rule | Status |
|---|---|
| Confirm-receipt ≠ paid | DONE (ensure invoice only; no payment / apply credit) |
| Payment ≠ delivered | DONE |
| Auto-invoice never auto-pays / auto-applies credit | DONE |

---

## K. Privacy

| Actor | Invoice / payment / statement / credit |
|---|---|
| Dealer | Own only (`assertCustomerOwns` + scope filter) |
| Cross-dealer | 0 list / FORBIDDEN detail |
| Worker (`PRODUCTION_WORKER`) | Deny `invoice.*` / `payment.*` / `statement.read` |
| Staff with packs | Full finance per permission packs |

---

## L. PDF + i18n

| Item | Status |
|---|---|
| Invoice PDF | Sale lines only: description / qty / unitPrice / lineTotal + total/outstanding |
| Payment PDF | Receipt amounts; no mfg/supplier cost |
| Statement PDF | Opening + ledger; commercial |
| Cost leakage | **0** on dealer commercial PDFs |
| i18n | EN/AR/HE phases, amount due, account credit, apply credit, payment strings |

---

## M. Demo P7-A…L map

Seed: `packages/database/prisma/demo/piece7-dealer-finance.ts` (after Piece 6).

| ID | Dealer | Story | Key numbers |
|---|---|---|---|
| P7-A | Oasis | STANDARD `CATALOG` + invoice | `SO/INV-P7-A` |
| P7-B | Oasis | MODIFIED `REQUIRED` — **no invoice** | `SO-P7-B` |
| P7-C | Oasis | CUSTOM `CONFIRMED` + invoice | `SO/INV-P7-C` |
| P7-D | Oasis | Open unpaid | `INV-P7-D` |
| P7-E | Oasis | Partial payment | `INV/PAY-P7-E` |
| P7-F | Oasis | Fully paid (two payments) | `PAY-P7-F1/F2` |
| P7-G | Oasis | One payment → two invoices | `PAY-P7-G` → `INV-P7-G1/G2` |
| P7-H | Nile | Overdue (privacy vs Oasis) | `INV-P7-H` |
| P7-I | Nile | Statement opening / running | `INV-P7-I1/I2`, `PAY-P7-I` |
| P7-J | Oasis | Commercial OK; mfg cost null | `SO/INV-P7-J` |
| P7-K | Oasis | Multi-line STD+MOD+CUSTOM confirmed | `SO/INV-P7-K` |
| P7-L | Balqis | Advance: inv 5k + pay 20k → 15k credit → apply 8k → 7k | `INV/PAY-P7-L`, `INV-P7-L2` |

---

## N. Smoke results

`pnpm smoke:piece7-dealer-finance-uat` — **PASS 24/24** (`tmp/piece7-dealer-finance-uat.json`, 2026-08-29).

Covers: commercial gate, unpaid/partial/full/multi/split, overdue, statement opening, advance conservation + apply-credit, Oasis↛Nile privacy, worker 403, presentation enrich.

---

## O. Automated test matrix

| Spec | Coverage |
|---|---|
| `dealer-finance.spec.ts` | Conservation basics, statement opening, commercial gate, overdue, classifiers |
| `dealer-finance-advance.spec.ts` | Advance conservation, FIFO apply, never-negative invoice, P7-L math |
| `invoices-commercial-privacy.spec.ts` | REQUIRED/CONFIRMED gate, cross-dealer scope, worker deny, PDF sale-only fields |
| `deliveries-confirm-receipt.spec.ts` | Confirm calls `ensureFromSalesOrder`; not payment |
| Live smoke | P7-A…L end-to-end API |

---

## P–Q. WHERE TO TEST — admin-web routes (locale `en` or `ar` / `he`)

| Demo | Admin route / action |
|---|---|
| P7-A | `/sales-orders` search `SO-P7-A` → commercial `CATALOG`; `/invoices` → `INV-P7-A` |
| P7-B | `/sales-orders` → `SO-P7-B` → commercial REQUIRED; create invoice → blocked; confirm prices → then invoice |
| P7-C | `SO-P7-C` / `INV-P7-C` CONFIRMED custom price |
| P7-D | `INV-P7-D` open unpaid; Amount due on Oasis customer |
| P7-E | `INV-P7-E` partial; `/payments` → `PAY-P7-E` |
| P7-F | `INV-P7-F` PAID; payments F1+F2 |
| P7-G | `PAY-P7-G` allocations to G1+G2 |
| P7-H | Nile customer → `INV-P7-H` OVERDUE; Oasis must not see |
| P7-I | Nile customer → statement date window (opening 6000) |
| P7-J | `SO-P7-J` invoice works; mfg margin unavailable |
| P7-K | `SO-P7-K` multi-line commercial statuses |
| P7-L | Balqis customer: Amount due / Account credit; `INV-P7-L2` → Apply credit 8000 → credit ≈ 7000 |
| Hub | `/invoices`, `/payments`, `/customers/:id` due+credit header, SOA |

---

## R. WHERE TO TEST — dealer mobile / portal

| Demo | Dealer login | Route |
|---|---|---|
| A–G, J, K | `oasis` | Account → Invoices / Payments / Statement; order commercial summary (read-only finance) |
| H, I | `nile` | Invoices (`INV-P7-H`); Payments list; Statement opening/running; must not see Oasis docs |
| L | `balqis` | Account credit hero on Payments + Statement; invoice L2 remaining after staff apply |
| All dealers | — | No payment.record / apply credit / invoice.create; no mfg cost on invoice PDF |

Dealer mobile routes: `/(customer)/invoices`, `/(customer)/account/payments`, `/(customer)/account/statement`.

Admin mobile: `/(admin)/invoices`, `/(admin)/orders/[id]` commercial panel, `/(admin)/dealers/[id]` due/credit + SOA.

---

## S. Handset checklist

| Check | Result |
|---|---|
| Commercial summary + price confirm sticky | **PENDING HANDSET** |
| Invoice home chips / detail / Record payment overpay | **PENDING HANDSET** |
| Apply credit preview → confirm | **PENDING HANDSET** |
| Statement Amount due vs Account credit + opening | **PENDING HANDSET** |
| RTL AR/HE currency + phases | **PENDING HANDSET** |
| Dealer isolation on device | **PENDING HANDSET** |

---

## T–U. Browser checklist

| Check | Result |
|---|---|
| Admin-web invoices / payments / SOA / apply credit | **PENDING** |
| Commercial confirm on SO detail | **PENDING** |
| PDF open invoice/statement (sale-only) | **PENDING** |

---

## V. Known gaps (honest)

| Gap | Notes |
|---|---|
| Credit **refund** (bank/cash out of advance) | Not built — future |
| Returns → **CreditNote** financial system | Not built — out of scope |
| Payment **void** / hard-delete | Not built — no casual delete |
| `StatementEntry` model | Seeded but **unused** by live statement API |
| Invoice void UX | Domain may allow status; no full Piece 7 void flow shipped |

---

## Scoreboard (§67 commercial + advance gates)

| Gate | Result |
|---|---|
| PRICE SOURCE (DealerPrice → SO) | **PASS** |
| SNAPSHOT immutable on accepted SO | **PASS** |
| STANDARD / MODIFIED / CUSTOM statuses | **PASS** |
| MISSING ≠ 0 | **PASS** |
| MFG SEPARATE (dealer strip) | **PASS** |
| INVOICE LIFECYCLE | **PASS** |
| INVOICE SNAPSHOT / STABILITY | **PASS** |
| PARTIAL / FULL / MULTI PAYMENT | **PASS** |
| OVER-ALLOC blocked | **PASS** |
| PAYMENT IDEMPOTENCY | **PASS** |
| DEALER BALANCE (due vs credit) | **PASS** |
| STATEMENT OPENING / RUNNING / CLOSING | **PASS** |
| OVERDUE derived | **PASS** |
| DEALER OWN DOCS | **PASS** |
| CROSS-DEALER DENY | **PASS** |
| COST LEAK 0 (PDF/API) | **PASS** |
| WORKER DENY | **PASS** |
| DELIVERY SEPARATION | **PASS** |
| COST-INCOMPLETE MARGIN SAFE (P7-J) | **PASS** |
| SEARCH / FILTER COUNT | **PASS** (API) |
| PDFs commercial-only | **PASS** (code + unit) |
| i18n EN/AR/HE | **PASS** (keys shipped) |
| ADVANCE PAYMENT / OVERPAY | **PASS** |
| UNALLOCATED CREDIT SoT | **PASS** |
| CREDIT VISIBLE ADMIN + DEALER | **PASS** |
| APPLY CREDIT FIFO | **PASS** |
| PARTIAL / MULTI CREDIT | **PASS** |
| INVOICE NEVER NEGATIVE | **PASS** |
| CROSS-DEALER CREDIT 0 | **PASS** |
| MONEY CONSERVATION | **PASS** |
| STATEMENT CREDIT LANGUAGE | **PASS** |
| AUTO TESTS | **PASS** |
| LIVE UAT smoke | **PASS 24/24** |
| CODE COMPLETE | **YES** |
| BROWSER | **PENDING** |
| HANDSET | **PENDING HANDSET** |
| P1–6 regressions | **PASS** (frozen; smoke privacy/worker) |

### Counts

- **PASS:** 34  
- **PENDING:** 2 (BROWSER, HANDSET)  
- **YES (meta):** 1 CODE COMPLETE  

---

## Backlog (§68)

| COMPLETE (Piece 7) | NOT eligible (stop) |
|---|---|
| Dealer sale price / commercial confirm | General ledger / CoA |
| Invoices (AR issue + phases) | Tax engine reconfiguration |
| Payments + allocations + advance credit | Supplier payables |
| Statement + outstanding (amount due) | Bank recon / payment providers |
| Apply credit explicit | Piece 8+ |

---

## Z. STOP

**Piece 7 closed for code.** Do **not** start Piece 8.

Handset and browser remain **PENDING** until observed. Advance credit + Apply credit + money conservation are hard gates and are **PASS** (unit + live smoke).
