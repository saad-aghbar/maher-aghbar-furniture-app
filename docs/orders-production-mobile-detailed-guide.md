# Orders → Production → Mobile — Detailed System Guide

**Maher Al-Aghbar & Sons Furniture ERP**  
**Audience:** Import into another knowledge base / training / partner brief  
**Language:** English  
**Scope:** How commercial demand becomes a sales order, how production and floor inventory work, and how the **mobile app** presents that information to dealers, factory admins, and floor workers.

---

## Table of contents

1. [System map at a glance](#1-system-map-at-a-glance)
2. [Part A — How an order enters the system](#2-part-a--how-an-order-enters-the-system)
3. [Part B — Sales order → production](#3-part-b--sales-order--production)
4. [Part C — Mobile screens (what each page shows)](#4-part-c--mobile-screens-what-each-page-shows)
5. [Part D — End-to-end walkthrough](#5-part-d--end-to-end-walkthrough)
6. [Part E — Status cheatsheets](#6-part-e--status-cheatsheets)
7. [Glossary](#7-glossary)

---

## 1. System map at a glance

Canonical commercial + manufacturing pipeline:

```
Inquiry / RFQ
  → Quotation (draft → internal approve → send)
  → Dealer Accept  ★ only step that creates a Sales Order
  → Sales Order DRAFT
  → Confirm        ★ creates Production Orders + freezes workflow + reserves materials + schedules
  → Floor production (stages / tasks / WIP kits / materials)
  → QC → Packaging → Finished Goods
  → Delivery / load → Dealer receipt confirm
  → Sales Order DELIVERED (invoice ensure)
```

### Applications (who uses what)

| Application | Who | Device |
|-------------|-----|--------|
| **Admin Web** | Management, sales, purchasing, warehouse, production supervisors, QC, accounting | Desktop / tablet |
| **Mobile — Admin** | Same factory roles on the floor / away from desk | Phone / tablet |
| **Mobile — Dealer (customer)** | B2B dealers | Phone / tablet |
| **Mobile — Employee** | Floor workers, inspectors, delivery staff | Phone / tablet / shared terminals |
| **Customer Portal** | Dealers on desktop | Desktop / tablet |
| **API** | All clients | Server |

This guide focuses on **order intake → production → mobile presentation**. Invoice/payment accounting and admin-web-only authoring screens are mentioned only where they touch the order chain.

### Critical commercial invariant

| Action | Who | Creates Sales Order? |
|--------|-----|----------------------|
| Internal **Approve** quotation (AR اعتماد) | Factory staff | **No** — only unlocks Send |
| Dealer **Accept** quotation (AR قبول) | Owning dealer only | **Yes** — SO `DRAFT` |
| Admin/Sales Accept on behalf of dealer | — | **Not implemented** (HTTP 403) |

---

## 2. Part A — How an order enters the system

### 2.1 Intake channels (Request for Quotation)

Demand usually starts as a **Request for Quotation (RFQ)** (`RequestForQuotation`).

**Sources** (`RequestSource`):

| Source | Typical meaning |
|--------|-----------------|
| `PORTAL` | Dealer submitted from portal / mobile new-order |
| `SALES` | Sales person entered the request |
| `WHATSAPP` / `EMAIL` / `PHONE` / `SITE_VISIT` | Manual capture from those channels |
| `PDF` / `IMAGE` / `HANDWRITTEN` | Document-based intake (often via AI OCR) |

An RFQ holds: customer (dealer), contact, project name, required delivery date, delivery address, priority, line items (product or free-text description, quantity, measurements, wood/fabric notes), and attachments.

### 2.2 AI / OCR intake (human-in-the-loop)

Factory can upload photos/PDFs of handwritten or printed requests. AI extracts fields into a review job. **A human must approve** before an RFQ is created. AI **never** auto-creates quotations, sales orders, or confirms production.

- Mobile admin: AI intake list + review screens  
- API: `apps/api/src/modules/ai-intake/`

### 2.3 RFQ status machine

| Status | Meaning | Who moves it |
|--------|---------|--------------|
| `DRAFT` | Saved, not submitted | Creator |
| `SUBMITTED` | Dealer/sales submitted for factory review | Submit |
| `UNDER_REVIEW` | Sales/ops reviewing | Staff |
| `NEEDS_INFORMATION` | Waiting on dealer clarification | Staff → dealer edits → resubmit |
| `READY_FOR_QUOTATION` | Specs clear; ready to price | Staff |
| `QUOTED` | At least one quotation created/sent for this RFQ | Quotation create/send |
| `CLOSED` | Commercially closed (typically after dealer Accept) | Accept / staff close |
| `CANCELLED` | Abandoned | Staff |

Staff gates are HTTP actions on the requests API (under-review, needs-information, ready-for-quotation, etc.).

### 2.4 Quotation lifecycle

Quotations are the **commercial** document: priced lines, terms, totals, versioning.

```
DRAFT
  → INTERNAL_REVIEW   (sales submits for approval)
  → APPROVED          (staff approve — send gate only)
  → SENT              (sent to dealer; RFQ → QUOTED)
  → ACCEPTED          ★ dealer only — creates SO DRAFT; RFQ → CLOSED
     or REJECTED / REVISION_REQUESTED (dealer; no SO)
```

Also in the enum (less central): `VIEWED`, `EXPIRED`, `CANCELLED`.

**Revision:** Staff can open a new DRAFT version from a rejected / revision-requested quote. Same RFQ can have multiple quote versions, but **only one ACCEPTED quote (and one SO) per RFQ**.

**Visibility:** Dealers only see quotes that are `SENT` (or later commercial outcomes). Unsent drafts are not visible to dealers (404).

### 2.5 Dealer Accept → Sales Order DRAFT

When the owning dealer calls Accept on a `SENT` quotation:

1. Quotation status → `ACCEPTED` (with `acceptedById`, optional signature).
2. System creates **Sales Order** `DRAFT` with:
   - New SO number (`SO-YYYY-#####`)
   - Customer, currency, payment/delivery terms, totals copied from quote
   - Delivery address / project / external PO / required delivery date from RFQ when available
   - **Lines** copied from quotation lines (product, description, specs, qty, prices)
3. RFQ → `CLOSED` (when linked).
4. Same-RFQ concurrency is locked so two accepts cannot create two SOs.

### 2.6 Auto-confirm vs manual confirm

System setting **`auto_confirm_so_on_accept`** (default **true**):

- If **true**: after Accept, API immediately runs sales-order **confirm** (see Part B).
- If **false**: SO stays `DRAFT` until staff (or process) calls `POST /sales-orders/:id/confirm`.

Confirm is only allowed from `DRAFT`.

---

## 3. Part B — Sales order → production

### 3.1 What a Sales Order represents

A **Sales Order (SO)** is the factory’s commitment to build and deliver what the dealer accepted. It links:

- Customer (dealer)
- Optional quotation / RFQ lineage
- Commercial lines
- One or more **Production Orders (PO)** after confirm
- Later: deliveries, invoices, returns

### 3.2 Sales Order statuses (operational meaning)

| Status | Meaning |
|--------|---------|
| `DRAFT` | Accepted commercially; not yet released to factory planning |
| `CONFIRMED` | Enum value; live confirm often jumps past this to materials/ready |
| `WAITING_FOR_PAYMENT` | Commercial hold (used in some seeds / processes) |
| `WAITING_FOR_MATERIALS` | Confirm ran but inventory reserve was not ready |
| `READY_FOR_PRODUCTION` | Materials reserved; POs planned; schedule generated |
| `IN_PRODUCTION` | Floor work started on at least one linked PO |
| `READY_FOR_DELIVERY` | Production/packaging complete enough for outbound |
| `DELIVERED` | Dealer confirmed receipt (or equivalent rollup) |
| `COMPLETED` | Enum end-state (accounting/completion processes) |
| `ON_HOLD` | Explicit hold |
| `CANCELLED` | Cancelled (releases inventory; cancels open POs when allowed) |

**Holdable** examples: confirmed / ready / in production / waiting materials / waiting payment.  
**Cancellable** early statuses include draft / confirmed / ready / on hold / waiting payment / waiting materials — not deep mid-production or delivered.

### 3.3 Confirm side-effects (the factory release)

`SalesOrdersService.confirm` (only from `DRAFT`) does the following in one transaction, then scheduling:

1. **Validate**
   - At least one line with `productionRequired` (default true).
   - Active production stage definitions exist.

2. **Create Production Orders**
   - **One PO per production-required line**.
   - Status starts as `PLANNED`.
   - Linked via `salesOrderId` + `salesOrderLineId`.
   - Carries product / description / quantity / specs / required delivery date.

3. **Freeze workflow snapshot**
   - For each PO, `createSnapshotForProductionOrder` copies the product’s published workflow into a locked snapshot for that PO.
   - Creates stage instances, snapshot nodes (including semi/finished tracking flags), material inputs, and **production tasks** (except pure logistics nodes such as DELIVERY, which are tracked via Delivery entities).

4. **Inventory reserve**
   - `tryReserveForSalesOrder`.
   - If **not ready**: all new POs → `WAITING_FOR_MATERIALS`; SO → `WAITING_FOR_MATERIALS`.
   - If **ready**: SO → `READY_FOR_PRODUCTION` (POs stay `PLANNED` until start / readiness transitions).

5. **After commit — schedule**
   - For each PO: `scheduling.generateForProductionOrder`.
   - Failures can mark the schedule as needing review rather than rolling back the SO.

6. **Notify** dealer users (`ORDER_CONFIRMED`).

### 3.4 Production Order statuses

| Status | Meaning |
|--------|---------|
| `DRAFT` | Rare; normally created as `PLANNED` |
| `PLANNED` | Created at confirm; awaiting start / material readiness |
| `WAITING_FOR_MATERIALS` | Cannot proceed until materials available |
| `READY` | Ready for floor start |
| `IN_PROGRESS` | Floor work active |
| `ON_HOLD` | Held |
| `QUALITY_CHECK` | In QC emphasis |
| `READY_FOR_PACKAGING` | Moving into packaging |
| `READY_FOR_DELIVERY` | Ready to leave factory |
| `COMPLETED` | Done |
| `CANCELLED` | Cancelled |

### 3.5 Starting production on the floor

`POST /production-orders/:id/start`:

- PO → `IN_PROGRESS`
- Unlocks prerequisite-free stages (typically opening `MATERIAL_PREP`)
- Rolls up progress
- Bumps linked SO to `IN_PRODUCTION` (unless still waiting materials)

### 3.6 Workflow stages, tasks, and progress

Each published product workflow is a **graph** of stages. On confirm, that graph is snapshotted onto the PO.

**Locked chains (factory rules):**

- **Opening:** production graphs start at `MATERIAL_PREP` as root.
- **Terminal:** `INSPECTION → PACKAGING → DELIVERY` chain is required for finished goods exit.

**Stage instance statuses:** `PENDING` → `READY` → `IN_PROGRESS` → `COMPLETED` (also `SKIPPED` / `BLOCKED`).

**Tasks:** Created per executable stage node. Workers assign/start/pause/complete; can report blockers and attach photos. Completing tasks updates stage %, then PO progress, which feeds SO progress shown to dealers.

### 3.7 WIP kits and semi-finished handoffs

Floor pieces are tracked as **WIP kits** (movable work objects) backed by **inventory lots** (ledger).

Typical handoff:

```
Producing stage completes / posts semi output
  → WIP kit OPEN/READY + SEMI lot in SEMI warehouse
  → Next stage worker receives / claims kit
  → Consumes into next stage
  → Eventually FINISHED_GOOD lots in Finished Goods warehouse
```

**WIP kit statuses:** `OPEN` → `READY` → `CLAIMED` → `CONSUMED` (or `CANCELLED`).

Mobile inventory “Semi-finished” board is **order/kit-centric**, not a flat SKU list: kits grouped by production order and producing stage.

### 3.8 Finished goods and packages

When packaging/inspection path completes, **Finished Goods (FG)** lots appear for the sales order:

- Quantity and warehouse location
- Package / piece labels (e.g. “Package 1 of 3”)
- Days waiting in finished
- Linked delivery and load-check progress (packages checked for loading — **checkmarks prepare load; they do not issue stock**)

**Stock issue rule:** Only explicit Confirm load / depart posts `DELIVERY_ISSUE`. Dealer receipt confirmation must **not** re-issue FG.

### 3.9 Scheduling (touchpoints)

After confirm, scheduling allocates capacity against stage estimates, dependencies, working calendar, material readiness, and WIP readiness.

Ops actions (admin mobile/web): approve schedule, recalculate, pin dates, resolve conflicts, at-risk views, capacity optimize, dealer delivery date changes (with policy).

Dealers see **promise / delivery windows**, not internal worker assignments.

### 3.10 Delivery and dealer receipt

When production is ready and an address exists, a **Delivery** may be created/planned (`PLANNED` → `READY` → `OUT_FOR_DELIVERY` → `DELIVERED`).

Load sheet (mobile): packages listed; workers check packages for the truck; confirm load/depart issues FG.

Dealer **confirm receipt** on the delivery moves the commercial outcome to SO `DELIVERED` and ensures invoice processes as configured.

---

## 4. Part C — Mobile screens (what each page shows)

Routes live under `apps/mobile/app/(app)/…`. Feature UI lives under `apps/mobile/src/features/…`.

### 4.1 Personas and tabs

| Persona | Primary tabs |
|---------|----------------|
| **Admin** | Home · Orders · Inventory · Production · More |
| **Dealer** | Home · Catalog · Orders · Account (+ Schedule, New order) |
| **Employee** | Home · Tasks · Completed · Notifications · Profile |

---

### 4.2 Dealer — Orders

#### Orders list  
**Route:** `(customer)/(tabs)/orders`  
**Feature:** `OrdersListScreen` (dealer variant)

**Shows per card:**

- Sales order number  
- Title / product summary  
- Status badge  
- Delivery status  
- Product image  
- Progress % and current stage label (when in production)  
- Required / promised delivery date  
- Price / quantity summary (dealer-visible commercial fields)

**Does not show:** internal costs, worker names, warehouse bin codes (unless exposed deliberately elsewhere).

#### Order detail  
**Route:** `(customer)/orders/[id]`  
**Feature:** `OrderDetailScreen` (dealer)

**Shows:**

- Hero media  
- Status / priority  
- Line items and specifications  
- Production progress + link into workflow “flow” view  
- Schedule / promise card (dealer date change when allowed)  
- Delivery address and delivery documents  
- **Confirm receipt** when delivery is awaiting customer confirmation  

#### Order production flow map  
**Route:** `(customer)/orders/[id]/flow`

**Shows:** Stage graph for the order’s production: stage names, status, %, photos on completed stages — **without** admin assignee tooling.

#### Schedule / calendar  
**Routes:** `(customer)/(tabs)/schedule`, account calendar  

**Shows:** Calendar of own deliveries / committed windows (`DealerDeliveryCard`).

#### Related commercial surfaces

- Quotations list/detail (Accept / reject / revision)  
- New order / requests  
- Invoices / returns (after delivery)

---

### 4.3 Admin — Orders

#### Orders list  
**Route:** `(admin)/(tabs)/orders`  
**Feature:** `OrdersListScreen` (admin)

**Shows (richer than dealer):**

- SO number, title, status, priority  
- Dealer name  
- Product image  
- Progress %, current stage  
- Delivery date  
- Linked PO numbers  
- Optional cost fields when permissioned  
- Day grouping / filters / search (Orders filter sheet: dealer, approval, delivery presets, sort)

#### Order detail  
**Route:** `(admin)/orders/[id]`

**Shows:**

- Hero, status, priority  
- Dealer + end-customer context  
- Lines / specs  
- Costs (if `inventory.cost` / commercial permissions)  
- Production progress + workflow hit  
- Linked production orders  
- Delivery / address  
- Invoices, deliveries, returns documents  

#### Order flow map  
**Route:** `(admin)/orders/[id]/flow`

**Shows:** Full production flow map with assignees, timers, blockers, photos.

---

### 4.4 Admin — Production

#### Production overview  
**Route:** `(admin)/(tabs)/production`  
**Feature:** `ProductionOverviewScreen`

**Shows:**

- Metric buckets (in production, late, etc.)  
- Search + dealer filter  
- PO cards: number, product, image, dealer, priority, status, progress, stage label, delivery, late flag  

#### Production detail  
**Route:** `(admin)/production/[id]`  
**Feature:** `ProductionDetailScreen`

**Shows:**

- Hero + lifecycle strip  
- Schedule strip  
- Priority / delivery edits (when allowed)  
- Task list: stage name, assignee, %, elapsed/estimate, blockers  
- Materials usage board  
- WIP kits by stage (QR, location, pieces, claimer)  
- Hub jumps (workflow, inventory, scheduling)  

#### Production flow  
**Route:** `(admin)/production/[id]/flow`

Stage graph scoped to one PO.

#### Task detail (admin path)  
**Route:** `(admin)/production/tasks/[id]`  

Shares floor task UI with employees (instructions, WIP receive, materials, output).

#### Workflow authoring (brief)

- `(admin)/production/workflow/*` — stage library and workflow versions  
- Product production setup / workflow times under products  

These feed **future** snapshots; already-confirmed POs keep their frozen snapshot.

#### Scheduling  
**Route:** `(admin)/scheduling`

**Shows:** Calendar / day board; at-risk, conflicts, awaiting approval; PO cards with promise/risk and material/WIP hints; approve / recalc / pin / date actions.

---

### 4.5 Admin — Inventory desks tied to orders

#### Inventory home (signature)  
**Route:** `(admin)/(tabs)/inventory`

Lifecycle tabs: **Materials · Semi-finished · Finished**.

- **Materials:** RAW groups, SKU cards, receive/issue/transfer/count  
- **Semi-finished:** Kit board by production order (Active / History filters in Filter sheet)  
- **Finished:** Outbound desk by sales order (In warehouse / History, warehouse, leave status filters)

#### Semi order desk  
**Route:** `(admin)/inventory/semi/[orderId]`  
**Feature:** `InventorySemiOrderScreen`

**Shows:** One production order’s WIP kits grouped by producing stage; floor status; QR label actions; Active/History filter.

#### Finished order desk  
**Route:** `(admin)/inventory/finished/[salesOrderId]`  
**Feature:** `InventoryFinishedOrderScreen`

**Shows:**

- Hero (product image, dealer, leave-by urgency)  
- Order facts (SO, POs, days in finished, entered/left, delivery, load progress)  
- **Packages list** — each package/piece with checked vs waiting indicator (load prepare; not stock issue)  
- Warehouse locations / on-hand  
- Actions: view order, view production, view delivery/load, transfer, stock count  

---

### 4.6 Employee — Floor tasks

#### Worker home  
**Route:** `(employee)/(tabs)/index`  
**Feature:** `WorkerHomeScreen`

Current task hero, upcoming list, today progress.

#### Tasks list / completed  
**Routes:** `(employee)/(tabs)/tasks`, `completed`  
**Feature:** `TasksListScreen`

Industrial cards: stage/department, product, order number, image, priority, deadline, scheduled-today stamp. **No progress % on list cards** (keeps floor focus).

#### Task detail  
**Route:** `(employee)/tasks/[id]`  
**Feature:** `TaskDetailScreen`

**Shows / actions:**

- Instructions, status, timer, notes, photos  
- **Incoming WIP** — receive kits required before start  
- **Materials** — usage recording  
- **Semi output** — pieces / photos / QR when stage produces semi  
- Start gated on WIP receive when required  

#### Delivery load (employee)  
**Route:** `(employee)/deliveries/[id]`  

Load sheet: packages to check; confirm load/depart for stock issue.

---

### 4.7 How mobile maps to backend statuses (quick)

| Backend | Dealer mobile emphasis | Admin mobile emphasis | Worker mobile emphasis |
|---------|------------------------|------------------------|------------------------|
| Quotation `SENT` | Accept / reject | Quote detail / send history | — |
| SO `DRAFT` | “Accepted, preparing” | Confirm if auto-confirm off | — |
| SO `WAITING_FOR_MATERIALS` | Waiting materials | Materials / purchasing / inventory | — |
| SO `READY_FOR_PRODUCTION` | Queued | Start PO / schedule | Upcoming tasks after start |
| SO `IN_PRODUCTION` | Progress % + stage | PO hub + tasks + WIP | Active tasks |
| SO `READY_FOR_DELIVERY` | Almost shipping | FG desk + delivery plan | Load sheet |
| Delivery `OUT_FOR_DELIVERY` | Track / await | Delivery ops | Driver/load |
| Delivery/SO delivered | Confirm receipt done | History / invoice | — |

---

## 5. Part D — End-to-end walkthrough

### Story: Dealer needs banquettes

1. **Inquiry**  
   Dealer submits RFQ from mobile New Order / portal (or sales enters from WhatsApp). Status `SUBMITTED`.

2. **Factory review**  
   Staff moves RFQ `UNDER_REVIEW` → maybe `NEEDS_INFORMATION` → `READY_FOR_QUOTATION`.

3. **Quote**  
   Sales creates quotation `DRAFT` → submit `INTERNAL_REVIEW` → manager **Approve** → **Send**. Dealer sees quote as `SENT`. RFQ → `QUOTED`.

4. **Accept**  
   Dealer taps **Accept**. Quotation `ACCEPTED`. SO `DRAFT` created. RFQ `CLOSED`.  
   If auto-confirm on: confirm runs immediately.

5. **Confirm (factory release)**  
   One PO per production line (`PLANNED`). Workflow snapshot frozen. Materials reserved.  
   - Ready → SO `READY_FOR_PRODUCTION`  
   - Short → SO/PO `WAITING_FOR_MATERIALS` until retry succeeds  
   Schedule generated for each PO.

6. **Where to look on mobile**  
   - Dealer Orders: new SO card  
   - Admin Orders: SO detail with linked POs  
   - Admin Scheduling: new allocations  

7. **Start production**  
   Supervisor starts PO → `IN_PROGRESS`, SO `IN_PRODUCTION`. Opening stage unlocks.

8. **Floor work**  
   Worker opens Tasks → Task detail → receive WIP if needed → start → record materials → complete / post semi pieces.  
   Admin Production detail shows task % and WIP kits.  
   Inventory Semi desk shows kits for that PO.

9. **Terminal path**  
   Inspection → Packaging → Finished lots appear on Finished desk for the SO. Packages listed; leave-by urgency from delivery date.

10. **Load and ship**  
    Delivery planned. Load sheet: check packages (prepare only). Confirm load/depart issues FG. Delivery `OUT_FOR_DELIVERY`.

11. **Receipt**  
    Dealer confirms receipt on order/delivery UI. SO → `DELIVERED`. Invoice ensure runs. Package checks never substitute for this.

---

## 6. Part E — Status cheatsheets

### RFQ (`RequestStatus`)

| Status | One-liner |
|--------|-----------|
| `DRAFT` | Not submitted |
| `SUBMITTED` | Waiting factory review |
| `UNDER_REVIEW` | Being reviewed |
| `NEEDS_INFORMATION` | Dealer must clarify |
| `READY_FOR_QUOTATION` | Ready to price |
| `QUOTED` | Quote exists / sent |
| `CLOSED` | Closed (accepted path) |
| `CANCELLED` | Cancelled |

### Quotation (`QuotationStatus`)

| Status | One-liner |
|--------|-----------|
| `DRAFT` | Pricing in progress |
| `INTERNAL_REVIEW` | Waiting internal approve |
| `APPROVED` | Approved to send (not accepted) |
| `SENT` | With dealer |
| `VIEWED` | Dealer opened (if tracked) |
| `ACCEPTED` | Dealer accepted → SO exists |
| `REJECTED` | Rejected |
| `REVISION_REQUESTED` | Dealer wants changes |
| `EXPIRED` / `CANCELLED` | Terminal commercial |

### Sales Order (`SalesOrderStatus`)

| Status | One-liner |
|--------|-----------|
| `DRAFT` | Accepted; not released |
| `CONFIRMED` | Confirmed (enum) |
| `WAITING_FOR_PAYMENT` | Payment gate |
| `WAITING_FOR_MATERIALS` | Stock not ready |
| `READY_FOR_PRODUCTION` | Released; materials OK |
| `IN_PRODUCTION` | Floor active |
| `READY_FOR_DELIVERY` | Ready to ship |
| `DELIVERED` | Dealer received |
| `COMPLETED` | Closed out |
| `ON_HOLD` / `CANCELLED` | Hold / cancel |

### Production Order (`ProductionOrderStatus`)

| Status | One-liner |
|--------|-----------|
| `PLANNED` | Created at confirm |
| `WAITING_FOR_MATERIALS` | Blocked on stock |
| `READY` | Ready to start |
| `IN_PROGRESS` | Running |
| `QUALITY_CHECK` | QC emphasis |
| `READY_FOR_PACKAGING` | Pack path |
| `READY_FOR_DELIVERY` | Outbound ready |
| `COMPLETED` / `ON_HOLD` / `CANCELLED` | End / hold / cancel |

### Delivery (`DeliveryStatus`)

| Status | One-liner |
|--------|-----------|
| `PLANNED` | Planned |
| `READY` | Ready to load |
| `OUT_FOR_DELIVERY` | On the road |
| `DELIVERED` | Delivered |
| `FAILED` / `RESCHEDULED` / `CANCELLED` | Exception paths |

### WIP kit (`WipKitStatus`)

| Status | One-liner |
|--------|-----------|
| `OPEN` | Created / collecting pieces |
| `READY` | Available for next stage |
| `CLAIMED` | Held by consuming task/worker |
| `CONSUMED` | Used by next stage |
| `CANCELLED` | Voided |

---

## 7. Glossary

| Term | Meaning |
|------|---------|
| **RFQ** | Request for Quotation — demand intake |
| **Quotation** | Priced commercial offer |
| **SO** | Sales Order — factory commitment |
| **PO** | Production Order — one build unit per SO line |
| **Workflow snapshot** | Frozen stage graph for a PO |
| **WIP kit** | Physical semi-finished work object on the floor |
| **FG** | Finished Goods lot in finished warehouse |
| **Load check** | Prepare packages for truck; does not issue stock |
| **Confirm load/depart** | Posts delivery issue from FG |
| **Dealer Accept** | Only commercial acceptance that creates SO |
| **Internal Approve** | Factory send-gate for quotations |

---

## Appendix — Key code modules (for engineers)

| Area | Path |
|------|------|
| RFQ API | `apps/api/src/modules/requests/` |
| AI intake | `apps/api/src/modules/ai-intake/` |
| Quotations | `apps/api/src/modules/quotations/` |
| Sales orders | `apps/api/src/modules/sales-orders/` |
| Production | `apps/api/src/modules/production/` |
| Workflow domain | `apps/api/src/modules/production/workflow/` |
| Tasks | `apps/api/src/modules/tasks/` |
| Scheduling | `apps/api/src/modules/scheduling/` |
| Inventory / FG / WIP | `apps/api/src/modules/inventory/`, `production/wip-kit.*` |
| Deliveries | `apps/api/src/modules/deliveries/` |
| Mobile orders | `apps/mobile/src/features/sales-orders/` |
| Mobile production | `apps/mobile/src/features/production/` |
| Mobile tasks | `apps/mobile/src/features/tasks/` |
| Mobile inventory desks | `apps/mobile/src/features/inventory/` |
| Schema enums | `packages/database/prisma/schema.prisma` |

---

*Document generated for import. Companion PDF: `docs/orders-production-mobile-detailed-guide.pdf`.*
