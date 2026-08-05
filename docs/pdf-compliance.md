# PDF / blueprint compliance matrix

Source: Technzone proposal `docs/source-proposal.pdf` + Maher Al-Aghbar process blueprint (RFQ → quote → SO → PO stages → QC → delivery → finance).

Status legend: **DONE** | **PARTIAL** | **DEFERRED**

| Area | Status | Notes |
|------|--------|-------|
| Auth (login, refresh, lockout) | DONE | Nest auth + session cookies |
| Password reset / invite / MFA | DONE | TOTP setup + confirm + login gate; Settings UI |
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
| Delivery maps | DONE | Leaflet + Nominatim; admin pin + `Delivery.lat/lng`; `/geo` proxy |
| Customer contracts | DONE | Portal `/contracts` list + scoped API + contract PDF |
| Dealer production photos | DONE | Task complete → `CUSTOMER_VISIBLE`; SO detail embeds stage photos |
| Production stage definitions CRUD | DONE | Admin `/production-stages` MasterCrud + nested nav |
| Sales report filters | DONE | Period / dealer / product / sales rep on `/reports/sales` |
| Open & late work orders | DONE | Production report `openOrders` + `daysLate` |
| Order profit report | DONE | `/reports/order-profit` + CSV export |
| Period P&L + cash flow | DONE | Proxy P&L + cash inflow/outflow + CSV |
| Dashboard revenue / receivables / completed SOs / open POs | DONE | Extended `/reports/dashboard` |
| Invoices / payments / SOA | DONE | Customer + supplier statement PDFs |
| Purchasing PR/PO/GRN | DONE | PO PDF + supplier comparison |
| Inventory multi-WH | DONE | Existing + camera cycle-count |
| Binary PDFs | DONE | pdfkit: quote, invoice, SOA, label, contract, PO, supplier SOA |
| AI / OCR | PARTIAL | Mock + local + OpenAI/HTTP when keys set |
| Live WhatsApp / Email webhooks | PARTIAL | Email IMAP/webhook DONE; WhatsApp inbound + Meta/Twilio when keyed |
| Supplier AP + ledger | DONE | PR compare/select + AP aging/ledger + cash flow |
| Barcode / cycle-count | PARTIAL | Inventory scan API + typed fallback (no dedicated hardware gun) |
| True statutory GL | DEFERRED | No CoA / journals — operational AR/AP + management reports only |

## Critical path (this pass)

RFQ → multi-approve quote → customer accept/revise → auto SO+Contract (+ optional auto PO) → plan/assign stages → photos/time → QC gate → delivery closes SO → invoice/SOA → dashboard $.

Smoke: `node scripts/smoke-workflow-critical-path.mjs` (API must be running).
