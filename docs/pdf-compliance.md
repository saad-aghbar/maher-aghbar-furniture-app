# PDF / blueprint compliance matrix

Source: Technzone proposal `docs/source-proposal.pdf` + Maher Al-Aghbar process blueprint (RFQ → quote → SO → PO stages → QC → delivery → finance).

Status legend: **DONE** | **PARTIAL** | **DEFERRED**

| Area | Status | Notes |
|------|--------|-------|
| Auth (login, refresh, lockout) | DONE | Nest auth + session cookies |
| Password reset / invite / MFA | DONE | Dev-console email; in-memory reset tokens |
| CRM (customers, contacts, addresses) | DONE | Admin CRUD + APIs |
| Admin RFQ module | DONE | List/detail/create/submit; link to quotation; attachments |
| Customer RFQ multi-channel + specs | DONE | Portal + API (PORTAL/WHATSAPP/EMAIL/PDF/PHONE) |
| Quotation lines (dims / fabric / discount / tax) | DONE | DTO + admin create + detail display |
| Multi-step internal approval | DONE | Sales Manager → GM; Finance above threshold setting |
| Customer accept + request revision | DONE | Signature accept; `request-revision` → REVISION_REQUESTED |
| Accept → SO specs + delivery date | DONE | Line specifications + parsed delivery date |
| Auto Contract on accept | DONE | Draft/Active stub from quote totals |
| Auto-confirm SO → PO on accept | DONE | Setting `auto_confirm_so_on_accept` (default true) |
| Stage pipeline (deps / unlock) | DONE | MATERIAL_PREP first; parallel carpentry/paint; QC gate |
| PO planning fields | DONE | Priority, planned dates, est. minutes on PO detail |
| Task time / notes / photos | DONE | TaskTimeEntry on start/pause/complete; notes; requiresPhotos |
| QC pass unlocks next stage | DONE | Inspection PASSED completes INSPECTION + unlocks |
| Rework complete → reinspect | DONE | `POST /quality-inspections/rework/:id/complete` |
| Delivery POD | DONE | Signature + photo |
| Delivery closes SO | DONE | DELIVERED → sales order DELIVERED |
| Driver picker | DONE | Admin delivery driver select |
| Customer contracts | DONE | Portal `/contracts` scoped API |
| Dashboard revenue / receivables / completed SOs / open POs | DONE | Extended `/reports/dashboard` |
| Invoices / payments / SOA | DONE | Existing |
| Purchasing PR/PO/GRN | DONE | Existing |
| Inventory multi-WH | DONE | Existing |
| AI / OCR (mock) | DONE | Mock extract + human review |
| Live WhatsApp / Email webhooks | DEFERRED | Keep mock + file attach |
| Real OCR / paid LLM | DEFERRED | |
| Supplier comparison + AP ledger | DEFERRED | |
| Barcode hardware / cycle-count mobile UX | DEFERRED | |
| True P&L + productivity scoring | DEFERRED | |

## Critical path (this pass)

RFQ → multi-approve quote → customer accept/revise → auto SO+Contract (+ optional auto PO) → plan/assign stages → photos/time → QC gate → delivery closes SO → invoice/SOA → dashboard $.

Smoke: `node scripts/smoke-workflow-critical-path.mjs` (API must be running).
