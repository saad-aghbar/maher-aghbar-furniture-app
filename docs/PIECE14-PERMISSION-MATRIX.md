# Piece 14 — Permission matrix

Roles vs capabilities for full-system UAT. Source of truth: `packages/permissions/src/catalog.ts` (`ROLE_PERMISSIONS`) plus API `@RequirePermissions` / customer-scope guards.

| Capability | SYSTEM_ADMIN (`SYSTEM_ADMINISTRATOR`) | Dealer (`CUSTOMER`, e.g. oasis) | Carpenter / worker (`PRODUCTION_WORKER`) |
|---|---|---|---|
| **Management summary** `GET /reports/management-summary` (`report.sales.read`) | Yes | No (403) | No (403) |
| **Production-setup edit** (`production.setup.edit` on `/sales-orders/:id/production-setup`) | Yes | No | No |
| **Purchasing** (`purchase-request.*` / `purchase-order.*`) | Yes | No | No |
| **Invoices** (`invoice.read` / create-update for staff) | Yes (full staff invoice perms) | Read own customer invoices only (`invoice.read` + row scope) | No invoice create/update; no commercial staff invoice write |
| **Cross-dealer sales order** (GET another dealer’s SO) | Yes (all customers) | No — own `customerId` only (403/404 IDOR) | Limited `sales-order.read` for floor context; not cross-dealer commercial browse |
| **Task complete** (`production-task.complete`) | Yes | No | Yes (own / assigned floor tasks; with `production-task.update-own`) |

## Notes

- Dealer commercial acceptance (`quotation.accept`) is **CUSTOMER-only**; SYSTEM_ADMIN is intentionally excluded.
- Worker may complete tasks and record material usage; they must not open the management dashboard or edit production setup.
- Smoke evidence: `scripts/smoke-piece14-full-system-uat.mjs` steps for oasis/carpenter `management-summary` → 403 and oasis GET foreign SO → 403/404.
