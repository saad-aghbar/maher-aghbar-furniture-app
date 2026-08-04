# Known limitations (post-launch foundation)

The platform is **launchable locally** with live API + three web apps + seeded Postgres.

## Working now

- Auth (cookie JWT + refresh + lockout + optional TOTP MFA), RBAC permissions
- CRM, RFQ, quotations → sales orders → production/tasks
- Inventory transactions, invoices/payments, quality, deliveries (map pins)
- AI intake (mock / local OCR / OpenAI when keyed) with human approval → draft RFQ
- File uploads to local disk (or MinIO/S3 when `STORAGE_PROVIDER=s3`)
- Binary PDFs via pdfkit: quotations, invoices, SOA, labels, contracts, POs, supplier statements
- Admin / customer / employee portals (+ mobile)
- CI workflow, Dockerfiles, launch compose file
- Reports: sales, production, order profit, productivity, AP ledger, period P&L proxy, cash flow

## Deferred / credential-gated (not blocking local launch)

- Live WhatsApp / SMS / OCR / Google Maps vendor credentials (providers wired; need keys)
- Full statutory general ledger (chart of accounts / journal entries)
- Playwright full 16-step E2E suite in CI (smoke specs exist locally)
- Dedicated barcode hardware (phone camera scan ships)

See also [launch-checklist.md](./launch-checklist.md) and [pdf-compliance.md](./pdf-compliance.md).
