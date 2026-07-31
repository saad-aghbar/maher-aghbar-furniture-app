# Known limitations (post-launch foundation)

The platform is **launchable locally** with live API + three web apps + seeded Postgres.

## Working now

- Auth (cookie JWT + refresh + lockout), RBAC permissions
- CRM, RFQ, quotations → sales orders → production/tasks
- Inventory transactions, invoices/payments, quality, deliveries, suppliers
- AI intake mock with human approval → draft RFQ
- File uploads to local disk with expiring tokens
- Quotation/invoice printable HTML documents
- Admin / customer / employee portals (built + running)
- CI workflow, Dockerfiles, launch compose file

## Deferred (not blocking local launch)

- Native PDF binary generation (HTML printable docs ship now)
- Live WhatsApp / SMS / OCR vendor credentials
- Full purchasing comparison UI polish
- Playwright 16-step E2E suite in CI
- MFA enrollment UI
- MinIO in local Homebrew path (local `uploads/` used instead)

See also [launch-checklist.md](./launch-checklist.md).
