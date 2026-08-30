# Quotation commercial integrity — closure report

**As of:** 2026-08-22 (Asia/Amman) · API `http://localhost:4000` · DEV DB `maher_erp` · `DEMO_AS_OF=2026-08-16`.

Dealer **Accept** (`SENT` → `ACCEPTED`) is the only commercial acceptance. Internal **Approve** (`INTERNAL_REVIEW` → `APPROVED`, AR **اعتماد**) is a send gate only. On-behalf Admin/Sales Accept is **not implemented**.

Walkthrough talking orders: [father-demo-walkthrough.md](./father-demo-walkthrough.md). Earlier gap list: [quotation-dealer-approval-audit.md](./quotation-dealer-approval-audit.md).

Live script: `pnpm smoke:quotation-commercial-uat` (`scripts/quotation-commercial-integrity-live-uat.mjs`).

---

## Scorecard

| # | Invariant | Result |
|---|---|---|
| 1 | Internal Approve never writes `ACCEPTED`, never creates an SO | **PASS** (throwaway `QCIRACE-APPROVE-*` → `APPROVED`, 0 SO) |
| 2 | Dealer Accept is the only commercial acceptance (`acceptedById` + SO) | **PASS** |
| 3 | Admin / Sales HTTP accept is 403 | **PASS** (`Missing permission: quotation.accept`) |
| 4 | Leftover `quotation.accept` grant still 403 without `user.customerId` | **PASS** (`Only the owning dealer can perform this action.`) |
| 5 | Unsent quotes (`DRAFT` / `INTERNAL_REVIEW` / `APPROVED`) are 404 to dealers | **PASS** |
| 6 | Dealer isolation (Oasis cannot GET/PDF Noor quote) | **PASS** (404) |
| 7 | Same-RFQ concurrent accept: exactly one `ACCEPTED` + one SO | **PASS** (live `Promise.all`) |
| 8 | Retry accept does not create a second SO | **PASS** (HTTP 400, SO count stays 1) |
| 9 | Partial unique index `quotations_one_accepted_per_request` exists | **PASS** |
| 10 | RFQ `SELECT … FOR UPDATE` + quote CAS on real PostgreSQL | **PASS** (after text-id fix; see below) |
| 11 | `auto_confirm_so_on_accept` still default true; seed SO progressed | **PASS** (`SO-2026-00001` **DELIVERED**) |
| 12 | Dealer reject / request-revision on `SENT` create no SO | **PASS** |
| 13 | Noor hold stays `SENT` with no SO | **PASS** (`Q-2026-00065`) |
| 14 | Schedule / الجدول tab, layout, and calendar tile untouched | **PASS** (quotes live under Orders + Account Places) |
| 15 | On-behalf Admin/Sales Accept | **NOT IMPLEMENTED** |

**Overall: PASS** on implemented dealer-owned acceptance. Live HTTP **36/36**. On-behalf remains out of scope.

Jest (not used as PASS by itself): API commercial/visibility/PDF **12/12**; staff-permissions **4/4**; mobile nav/UI **13/13**; permissions meta **8/8**.

---

## Live IDs (`maher_erp`)

### Noor club chair hold (dealer accept still pending)

| Field | Value |
|---|---|
| Quotation | **Q-2026-00065** `a8582231-95b0-4f3f-a884-6ee0ac275b1c` |
| Status | `SENT` |
| RFQ | **RFQ-2026-00065** |
| Sales orders | **0** |
| After UAT | still `SENT`, 0 SO |

Log in as `noor` to Accept (AR **قبول**). Internal Approve (AR **اعتماد**) already happened at the factory.

### Nile seed ACCEPTED (honest dealer stamp + auto-confirm)

| Field | Value |
|---|---|
| Quotation | **Q-2026-00001** `be811217-d6ae-4c32-a50a-7224ef0a7ec1` |
| Status | `ACCEPTED` |
| `acceptedBy` | `nile` `a795f04c-7566-4d88-9b86-e2d6a3627382` |
| `sentAt` / `acceptedAt` | 2026-06-19T09:00Z → 2026-06-20T09:00Z |
| Sales order | **SO-2026-00001** `4ee25632-e1a2-40dd-b80b-0141db584c39` **DELIVERED** |
| Production | **PO-2026-00001** COMPLETED |

### Staff accept (removed)

| Actor | HTTP | Body |
|---|---|---|
| `admin` on Noor | **403** | `FORBIDDEN` / `Missing permission: quotation.accept` |
| `sales1` on Noor | **403** | same |
| `admin` with leftover `quotation.accept` RolePermission | **403** | `FORBIDDEN` / `Only the owning dealer can perform this action.` · `requestId` `11fbea4c-5836-4c53-ae1c-65782b88f206` |

The leftover-grant row is deleted after the check. Catalog: `SYSTEM_ADMINISTRATOR` excludes `quotation.accept`; SALES preset does not include it; meta is `restricted` / `assignableToStaff: false`.

### Concurrent same-RFQ accept (Oasis, 2026-08-22T09:52:50Z)

Throwaway pair on one RFQ, both `SENT`, `Promise.all` two `POST /api/v1/quotations/:id/accept` as `oasis`. Setting `auto_confirm_so_on_accept` temporarily **false** so the winner SO stays `DRAFT` and can be deleted without touching planner/WIP. Restored to **true** after.

| | ID / number | HTTP |
|---|---|---|
| RFQ | `839db7b6-bd28-4cb3-915e-91938e04cba6` | — |
| Quote A | `QCIRACE-1787392370870-A` `2ded2f93-c328-41c7-86fa-20a9df1eab57` | **201** winner |
| Quote B | `QCIRACE-1787392370870-B` `d90ce1a5-1912-457d-93c7-ddf7857bda91` | **400** |
| Winner `acceptedById` | `oasis` `91a9484b-ac16-47cf-8f68-85fcb9e26133` | — |
| Sales order | **SO-2026-00067** (DRAFT during race; **deleted** in cleanup) | 1 row |
| Loser body | `QUOTE_ALREADY_ACCEPTED` · `requestId` `bb6c84bd-2d59-4bb4-b8f3-c7610dacbd15` | — |
| Retry winner accept | **400** | SO count stayed **1** |

DB after HTTP: **1** `ACCEPTED` quote on that RFQ, **1** SO. Unique index + RFQ `FOR UPDATE` + `updateMany` CAS `SENT` → `ACCEPTED` all held. Throwaway QCI rows were deleted; leftover `QCI*` quotes/RFQs = **0**.

### Internal Approve is not Accept

Throwaway Oasis `INTERNAL_REVIEW` quote approved by `admin`: status **APPROVED**, **0** SO. Then deleted.

### Unsent isolation

Oasis DRAFT **Q-2026-00066** `41e19869-6950-4475-8895-168a3da59492` — dealer GET is **404** for owner and for Nile. Nile list shows only `ACCEPTED` rows (no `DRAFT` / `INTERNAL_REVIEW` / `APPROVED` / `CANCELLED`).

---

## PostgreSQL lock fix (did not weaken the invariant)

First live concurrent run failed **500** on both accepts (`INTERNAL_ERROR`). Nest log:

```
PrismaClientKnownRequestError P2010
Raw query failed. Code: 42883
ERROR: operator does not exist: text = uuid
at quotations.service.ts accept → $queryRaw FOR UPDATE
```

Prisma `String @id @default(uuid())` maps to PostgreSQL **text**, not `uuid`. The lock SQL used `${id}::uuid`, so `text = uuid` had no operator.

**Fix:** compare as text (`WHERE id = ${id}`) and keep:

- RFQ `SELECT … FOR UPDATE`
- quotation row `SELECT … FOR UPDATE`
- `updateMany` CAS `status = SENT`
- partial unique index `quotations_one_accepted_per_request`

The index definition on live DB:

```sql
CREATE UNIQUE INDEX quotations_one_accepted_per_request
ON public.quotations USING btree ("requestId")
WHERE ((status = 'ACCEPTED'::"QuotationStatus")
  AND ("requestId" IS NOT NULL)
  AND ("archivedAt" IS NULL))
```

Applied by `packages/database/prisma/demo/quotation-accepted-index.ts` during `pnpm demo:reset` (Prisma cannot express this `WHERE`). Repo uses `prisma db push`, not migrations.

After the cast fix, concurrent accept is **1 winner + 1 SO + loser `QUOTE_ALREADY_ACCEPTED`**.

---

## What shipped

### Commercial rules

- Dealer Accept: `SENT` only, requires `user.customerId`, stamps `acceptedAt` + `acceptedById`, creates SO `DRAFT`, then existing `auto_confirm_so_on_accept` (default **true**) may confirm → POs / scheduling.
- Staff Approve: `INTERNAL_REVIEW` → `APPROVED`. Never `ACCEPTED`. Never SO.
- Dealer reject: `SENT` only. Staff reject: `INTERNAL_REVIEW | APPROVED` only (staff cannot reject `SENT`).
- Dealer request-revision: `SENT | VIEWED`.
- Unsent quotes are **404** to dealers, not 403.
- Same RFQ: at most one non-archived `ACCEPTED` quote and one SO.

### Surfaces (Schedule frozen)

- Admin web / admin mobile: Accept button **removed**. Approve label `quotations.approveQuotation` (AR **اعتماد العرض**). Send copy is “to dealer”.
- Customer portal: `/quotations` after My orders. `/deliveries` (Schedule) unchanged. Decisions only when status is `SENT`.
- Dealer mobile: list + detail under `apps/mobile/app/(app)/(customer)/quotations/`. Entry from **Orders** (`DealerQuotationsEntry`) and Account **Places** tile. Calendar tile unchanged.
- `activeTabFromPath`: customer `/quotations` → **orders**. `/schedule` and Account calendar still → **account**.
- Git diff is empty for `customerScheduleTab`, `(tabs)/_layout.tsx` schedule registration, and schedule screens.

### Copy

EN / AR / HE: `approveQuotation`, dealer accept/reject/revision, PDF commercial labels. AR split is **اعتماد** (internal) vs **قبول** (dealer).

---

## Tests and UAT

| Suite | Result |
|---|---|
| `quotation-visibility.spec.ts` + `quotations.commercial-integrity.spec.ts` + `pdf.quotation-isolation.spec.ts` | 12 passed |
| `staff-permissions.spec.ts` (admin lacks dealer accept) | 4 passed |
| Mobile `dealerQuotationUi` + `activeTabFromPath` + `linkHref` | 13 passed |
| `@maher/permissions` `permission-meta` (dealer-only accept) | 8 passed |
| Live `pnpm smoke:quotation-commercial-uat` | **36/36** |

Commercial-integrity unit tests cover: 403 without dealer principal even with leftover `quotation.accept`; dealer isolation 404; unsent 404; CAS win stamps `acceptedById` and creates one SO; CAS lose creates zero SO; `salesOrders.confirm` is called only when `auto_confirm_so_on_accept` is true.

Live race UAT does **not** exercise auto-confirm (setting forced false for cleanup). Auto-confirm on the normal path is proven by seed **SO-2026-00001 DELIVERED** / **PO-2026-00001 COMPLETED** plus the unit test that `confirm()` is invoked after commit when the setting is true. Setting restored to `true` after the race.

---

## Limitations / debt (honest)

- **On-behalf is NOT IMPLEMENTED.** No Admin/Sales Accept, no acting-as-dealer flag, no factory “accept for this dealer” UI.
- `SequenceService.next('SO')` runs inside the interactive transaction callback but on the sequence service’s **own** Prisma connection (not `tx`). Live race still produced one SO; the unique index and RFQ lock are the DB backstop. A failed winner after `next()` could skip a number.
- `getApprovalChain` is still one-step `SYSTEM_ADMINISTRATOR`. Unused setting `quotation_approval.financeThreshold` is future debt.
- `actorHoldsPermission` still treats `SYSTEM_ADMINISTRATOR` as holding every code (role-assignment UI). HTTP accept uses `hasPermission` (DB ∪ catalog) **and** `assertDealerPrincipal`. Do not switch accept to `actorHoldsPermission`.
- Rebuild `@maher/permissions` dist after catalog changes, or seed will re-grant `quotation.accept` to admin from a stale `ROLE_PERMISSIONS`.
- `VIEWED` is dealer-visible but not decidable (Accept/Reject require `SENT`).
- No scheduling / planner / inventory / WIP / QC / delivery / invoice-trigger / calendar product changes in this freeze.

---

## How to re-prove

1. API listening on `:4000`, DB `maher_erp` after `pnpm demo:reset`.
2. `pnpm smoke:quotation-commercial-uat`
3. Expect 36/36, unique index present, Noor still `SENT` / 0 SO, concurrent 1×201 + 1×`QUOTE_ALREADY_ACCEPTED`, retry 400 and still one SO.
4. Do not treat Jest/typecheck alone as PASS.
