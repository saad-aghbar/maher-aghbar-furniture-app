# Dealer Mobile Aesthetic Audit

**Date:** 2026-08-09  
**Scope:** Customer Expo surface (`(customer)` / dealer UX) only.  
**Do not touch:** Admin mobile, Worker mobile, Admin CRM `features/dealers/`, Employee industrial theme.

## Surface naming

| Layer | Term |
|-------|------|
| Expo routes / `AppSurface` | `customer` |
| Product copy / features | Dealer (`dealer-home`, “Dealer account”) |
| User model | `customerId` |

## Current tab chrome

- Admin + Employee: floating glass pill + icons + drag-scrub (`PersistentSurfaceTabBar`).
- **Customer/dealer: docked text-only bar** (`floating = admin \|\| employee` only).
- Tabs today: Home · Catalog · New Order · Orders · Account (5 equal tabs).

## Screen inventory

| Area | Status | Notes |
|------|--------|-------|
| Login | Shared premium brand intro | All personas; no email required |
| Home | Implemented ERP-ish | Balance + metrics; not commerce-first |
| Catalog | Implemented | Store chrome; dealer prices |
| Product detail | Implemented | Skips wishlist; CTA → new-order |
| New Order | 6-step RFQ | Needs collapse to 4 steps |
| Orders list | Dealer variant | `DealerOrderCard` |
| Order detail + flow | Dealer-safe strips | Costs/workers hidden |
| Invoices | Shared screens, no adminControls | Under Account stack |
| Statement | Payments-centric | Ledger entries underused |
| Returns | List/create/detail | Under Account |
| Notifications | Shared inbox | Deep-links skewed to `(admin)` |
| Account tab | Link dump + logout | No real profile hub |
| AI chat | Linked from Account | Optional |
| Payments screen | Missing | Only via statement/invoice |

## Admin financial language to mirror (read-only)

- Invoice floor boards: accent rail, `orderBoardShadow`, coffee status badges.
- Sticky floating actions, `MoreBoard`-style surfaces, parchment/liquorice tokens.

## Gaps vs premium commerce goal

1. Docked vs floating tab hierarchy.
2. New Order as tab vs center FAB.
3. Home is ops dashboard, not furniture-first.
4. Account is not a designed hub.
5. Notification deep-links wrong for dealers.
6. No GLB/3D assets — use 2.5D hero only.
7. Recent invoices on home not tappable.
8. Six-step RFQ feels government-form, not mobile commerce.

## API / permissions (no business-rule changes)

- Dealer prices via `catalog/browse` + `DealerPrice`.
- Costs stripped for dealers.
- Progress coarse-mapped for dealers.
- RFQ edit: 3-day window / fabric lock unchanged.

## Out of scope (hard)

- Admin / Worker redesign.
- CUSTOMER permission grant changes.
- Cart/checkout inventing.
- Placeholder 3D couches.
