# PDF compliance matrix (Technzone JO/LF/112/07072026)

Status legend: DONE | PARTIAL | TODO

| Area | Status | Notes |
|------|--------|-------|
| Auth login email/phone | DONE | |
| Refresh rotation + lockout | DONE | |
| Password reset + invite + MFA + sessions list | DONE | Dev-console email; in-memory reset tokens |
| CRM core | DONE | Contacts, addresses, communications APIs |
| RFQ multi-source + specs | DONE | Portal 6-step RFQ + API specs |
| Quotations workflow + revisions | DONE | Revise + version compare endpoints |
| Sales orders | DONE | |
| Contracts | DONE | Create/activate + list |
| Returns | DONE | Create/resolve |
| Purchasing PR/PO/GRN | DONE | Goods receipts post stock |
| Inventory multi-WH + tx | DONE | Transfer, count, barcode lookup, low-stock |
| Production configurable stages | PARTIAL | API exists; admin UI thin |
| Employee tasks | DONE | |
| Quality + rework | PARTIAL | Checklists seeded; UX thin |
| Delivery + POD | PARTIAL | API; signature/photo UX thin |
| Invoices/payments/SOA | DONE | Returns + statement PDF/HTML |
| Documents DMS | PARTIAL | Upload + expiring tokens |
| Customer portal | DONE | 6-step RFQ, SOA, quotes/orders/invoices |
| Employee portal | DONE | |
| AI/OCR/translation human review | PARTIAL | Mock providers + human approve |
| Reports suite + export | DONE | Sales/production/inventory/financial/purchasing + CSV |
| Dashboard | DONE | |
| Notifications multi-channel | PARTIAL | Templates AR/EN/HE seeded; send still stub |
| i18n AR/EN/HE RTL | DONE | |
| Users/roles UI | DONE | Users list + roles API |
| Audit UI | DONE | |
| Full seed volumes | PARTIAL | Demo data + templates |
| E2E Playwright | PARTIAL | `pnpm smoke:lifecycle` + Playwright scaffold in `e2e/` |
| Real PDF binary | PARTIAL | HTML printable |

This file tracks closure toward 100% PDF coverage.
