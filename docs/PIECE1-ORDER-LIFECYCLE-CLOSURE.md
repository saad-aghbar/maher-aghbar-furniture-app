# PIECE 1 — ORDER LIFECYCLE CLOSURE

## A. What existed before

Dealer “orders” were `RequestForQuotation` records mixed into the mobile Orders hub with sales orders. Draft/submit/needs-info statuses already existed on RFQs, but:

- Dealer chips omitted **Drafts / Waiting / Needs info** (only production lifecycle).
- Orphan **Approved / Not approved** filter semantics treated SO `DRAFT` and pre-SO RFQs as “not approved,” conflating drafts, factory review, and post-accept setup.
- Admin RFQ workspace used **“Unapproved order”** language.
- Needs-info reasons were written only to **internalNotes** (dealer-invisible).
- Quote accept defaulted **`auto_confirm_so_on_accept=true`**, jumping straight into PO creation / materials / scheduling.

## B. Final lifecycle

| Dealer-facing | Backend |
|---|---|
| Draft | RFQ `DRAFT` |
| Waiting for review | RFQ `SUBMITTED` \| `UNDER_REVIEW` |
| Needs information | RFQ `NEEDS_INFORMATION` + `informationRequestReason` |
| Quotation | RFQ `READY_FOR_QUOTATION` / `QUOTED` when quote applies |
| Production setup | SO `DRAFT` after accept, no POs (`productionSetupRequired`) |
| Ready / In production / Ready to ship / Shipped / Delivered | Existing SO + delivery mapping |

Shared mappers: `@maher/types` `mapOrderPresentation`, extended `classifyDealerLifecycle`.

## C. Database/domain changes

- `RequestForQuotation.informationRequestReason`, `reviewHistory`
- `RequestItem` / `QuotationLine` / `SalesOrderLine.manufacturingComplexity`
- `SalesOrderLine.orderSpec` (commercial snapshot JSON)
- Seed default `auto_confirm_so_on_accept` → **false**
- No new WAITING_FOR_REVIEW / PRODUCTION_SETUP_REQUIRED enums

## D. API changes

- Requests: `statusGroup`, submit validation, discard draft `DELETE`, needs-info **requires reason**, reviewHistory, dealer notify, staff-only factory actions, presentation fields on list/detail
- Quotations accept: builds `orderSpec` + complexity; default no auto-confirm; dealer `ORDER_PRODUCTION_SETUP` notify
- Sales orders: `productionSetupRequired` on detail; confirm remains **Prepare production**

## E. Mobile changes

- Dealer Orders chips: Drafts / Waiting / Needs info / In production / Ready / Shipped / Delivered
- Empty states + search empty copy
- New order submit confirmation sheet
- EditRequest: needs-info banner, discard draft, resubmit
- Admin RFQ: factory review sections, required reason, complexity badges
- Admin SO: Production setup required + Prepare production
- Admin RFQ desk: `statusGroup=waiting_review`
- Eyebrow: Factory review (not Unapproved)

Routes: `/(app)/(customer)/(tabs)/orders`, `new-order`, `requests/[id]`; admin `orders`, `requests/[id]`, `orders/[id]`

## F. Admin changes

- `/[locale]/requests` waiting/needs/drafts filters + richer cards
- `/[locale]/requests/[id]` reason + complexity + factory review copy
- `/[locale]/sales-orders/[id]` setup banner + Prepare production
- `/[locale]/orders` hub label: Ready for quotation (not vague Approve)

## G. Dealer changes

Draft → Save → Submit (confirm sheet) → Waiting → Admin needs-info (visible reason) → Fix → Resubmit → Quote path → Accept → **Production setup required** (not active production) → Admin Prepare production (confirm).

## H. Custom-order foundation

- Classifier `STANDARD` / `MODIFIED` (Customized) / `CUSTOM` — pure function, does not write Product
- Persisted on RFQ/quote/SO lines; `orderSpec` frozen at SO create
- Catalog Product/BOM never updated from order flows

## I. Permissions

- Dealer scoped by `customerId`; cannot factory-review
- Workers lack `request.update` (no RFQ review)
- Cross-dealer access denied (tested)
- Edit locks enforced server-side (`ORDER_LOCKED` / `FABRIC_LOCKED`)

## J. Tests

```
pnpm --filter @maher/types test
→ 3 suites, 23 tests PASS

pnpm --filter @maher/api exec jest …piece1… …commercial-integrity… …dealer-edit-policy…
→ 3 suites, 26 tests PASS

pnpm --filter mobile test -- --testPathPattern='ordersCompositionHelpers|matchOrdersSearch'
→ 2 suites, 11 tests PASS
```

## K. Runtime proof

- `prisma db push` — PASS (schema synced)
- `pnpm demo:reset` — PASS (`demo:validate` 69 SOs; Piece 1 RFQs/SOs seeded)
- Seeded examples verified: `RFQ-P1-DRAFT`, `RFQ-P1-WAITING`, `RFQ-P1-NEEDSINFO`, `SO-P1-SETUP-STD` / `SO-P1-SETUP-MOD` (DRAFT, 0 POs), `auto_confirm_so_on_accept=false`
- `@maher/types` / mobile / API / customer-portal typecheck — PASS
- admin-web typecheck — FAIL on **pre-existing** scheduling/workflow files (not Piece 1 order files)
- API Piece 1 unit tests — PASS
- Physical handset UI — **PENDING HANDSET**
- Browser visual walkthrough — **PENDING BROWSER**

## L. WHAT I SHOULD TEST MYSELF

Password for all: **`123`**

### 1. Draft
ROLE: Dealer · ACCOUNT: `oasis` · APP: Mobile  
NAVIGATION: Orders → Drafts · EXAMPLE: `RFQ-P1-DRAFT`  
PRESS: Continue order  
SEE: Draft / Not submitted / last edited  
HAPPEN: Opens edit · MUST NOT: appear in admin waiting queue

### 2. Continue/edit Draft
ROLE: Dealer · `oasis` · Mobile · Open draft → edit qty/notes → Save  
SEE: Updated draft · MUST NOT: admin NEW_ORDER / production

### 3. Submit
ROLE: Dealer · New order or draft → Submit → confirm sheet “Send to factory?”  
SEE: Waiting for review · MUST NOT: POs / materials reserved

### 4. Admin Waiting for review
ROLE: Admin · `admin` · Mobile Orders → Customer requests / waiting · or Admin-web `/en/requests` filter Waiting  
EXAMPLE: `RFQ-P1-WAITING`  
SEE: dealer, products, attachments indicators · MUST NOT: Approved/Not approved labels

### 5. Needs information
ROLE: Admin · Open waiting RFQ → Request information → enter reason  
SEE: status Needs information · dealer notified  
MUST NOT: reset to Draft / lose history

### 6. Dealer fixes/resubmits
ROLE: Dealer · `nile` · EXAMPLE: `RFQ-P1-NEEDSINFO`  
SEE: reason prominent → edit → Submit  
HAPPEN: back to Waiting · MUST NOT: lose attachments

### 7. Standard accepted order
ROLE: Admin · `SO-P1-SETUP-STD` · Admin-web or mobile SO detail  
SEE: Production setup required · Prepare production  
MUST NOT: already have active POs until confirm

### 8. Customized accepted order
ROLE: Admin · `SO-P1-SETUP-MOD`  
SEE: MODIFIED/Customized + orderSpec dims/fabric · catalog product unchanged

### 9. 3-day edit
ROLE: Dealer · submitted RFQ within window → Editable until…; after lock → Editing locked + API reject

### 10. Search/filter
ROLE: Dealer · search `RFQ-P1` / chips Drafts/Waiting/Needs info  
SEE: debounce, clear, empty “No orders match…”

### 11. Attachments
ROLE: Dealer draft with photo → submit → needs-info → resubmit · Admin can open attachment

### 12–14. EN / AR RTL / HE RTL
Switch locale on Orders + New order + Admin review · check start/end alignment, chips, sheets

## M. VISUAL CHECKLIST

**Dealer → Orders → Drafts:** header, DealerSearchBar, chips incl. Drafts, draft card (image, Draft badge, Not submitted, last edited, Continue), empty “No draft orders”

**Submit sheet:** title Send to factory?, summary, primary Send for review

**Admin → Waiting:** Factory review eyebrow, product rows with Standard/Customized/Custom, attachments, Request information / Ready for quotation

**SO setup:** banner Order accepted · Production setup required, Prepare production button

## N. Screenshots / evidence

- Demo seed + validate: PASS (CLI)
- Handset screens: **PENDING HANDSET** (Metro may be running; not visually asserted here)
- Admin-web browser: **PENDING BROWSER**

## O. Anything not verified

| Item | Status |
|---|---|
| Domain/API unit tests | PASS |
| Demo seed A–G examples | PASS |
| Mobile typecheck | PASS |
| Mobile visual UX | PENDING HANDSET |
| Admin-web visual | PENDING BROWSER |
| Admin-web full typecheck | FAIL (pre-existing unrelated) |
| Notification delivery to real devices | PENDING HANDSET |
| Cross-dealer live API smoke logged-in | PENDING BROWSER |

## P. Files changed (grouped)

**Database:** schema.prisma, foundation seed, demo/piece1-lifecycle.ts, factory-world.ts, seed-demo-world.ts  
**API:** requests.* , request-line-classify.ts, quotations.service + commercial-integrity spec, sales-orders.service, piece1 lifecycle specs  
**Types:** manufacturing-complexity.ts, order-presentation.ts, dealer-lifecycle.ts, tests  
**Mobile:** Orders chips/list/home, NewOrder submit sheet, EditRequest, AdminRequestDetail, OrderDetail setup CTA, stageCounts, api/requests, i18n mobile en/ar/he  
**Admin-web:** requests list/detail, sales-orders detail, orders hub, confirm-dialog, i18n catalog/sales  
**Portal:** dealer-order-ui, orders pages, lifecycle i18n  
**Tests:** as above  

## Q. Frozen systems confirmation

**Not changed:** Workflow DAG/domain package, SEMI/FIN movement, QC, Inspection→Packaging→Delivery terminal rule, dealer receipt confirmation semantics, inventory transaction core, worker material usage, scheduling algorithms, purchasing, invoices.

**Compatibility only:** `auto_confirm_so_on_accept` default false; SO line snapshot fields; RFQ reason/history fields; presentation mapping.
