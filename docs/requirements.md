# Requirements Summary

Derived from Technzone proposal `JO/LF/112/07072026` and product brief.

## Functional modules

1. **Auth & IAM** — login (email/phone), invitations, refresh rotation, MFA optional, sessions, lockout.
2. **CRM** — customers, contacts, addresses, communication log, activity.
3. **RFQ** — multi-source requests, line items with furniture specs, attachments, missing-info flow.
4. **Quotations** — versions, internal approval, send, accept/reject/revise, PDF.
5. **Sales orders & contracts** — auto from accepted quote; status machine; contracts for wholesale.
6. **Purchasing** — suppliers, PR, PO, comparison, goods receipt.
7. **Inventory** — multi-warehouse, balances via transactions only, barcode/QR, counts, transfers.
8. **Production** — configurable stages, POs from SO, stage instances, progress.
9. **Tasks** — employee assignments, start/pause/block/complete, photos, blockers.
10. **Quality** — checklists, inspections, defects, rework.
11. **Delivery** — planning, proof of delivery, signatures/photos.
12. **Accounting** — invoices, payments, SOA PDFs, returns/credit notes.
13. **Documents** — centralized DMS with visibility scopes.
14. **Notifications** — in-app + email/SMS/WhatsApp abstractions.
15. **AI intake** — OCR, detect language, translate AR/EN/HE, extract fields, human review.
16. **Reports & dashboards** — sales, production, inventory, purchasing, financial, employee.
17. **Audit** — immutable event log for critical actions.
18. **Search** — global, permission-filtered.

## Non-functional

- Strict TypeScript, RBAC + granular permissions on every mutation.
- Arabic-first i18n with RTL.
- Accessibility (keyboard, contrast, labels, reduced motion).
- Pagination, indexes, background jobs for heavy work.
- Docker Compose for local; CI via GitHub Actions.
- Definition of Done per section 49 of the product brief.
