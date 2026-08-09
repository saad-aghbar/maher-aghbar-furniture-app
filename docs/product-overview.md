# Product Overview — Maher Al-Aghbar & Sons Furniture ERP

## Interpretation

**Maher Al-Aghbar & Sons Furniture ERP** (`مفروشات ماهر الأغبر وأولاده`) is a production-ready enterprise resource planning platform for a furniture manufacturing and furnishing business operating primarily in Jordan.

It is the central system of record for the full commercial and manufacturing lifecycle:

```
Inquiry → RFQ → Quotation → Acceptance → Sales Order → Production
→ Materials → Carpentry → Painting → Upholstery → Assembly
→ QC → Packaging → Delivery → Invoice → Payment → Statement
```

The platform replaces fragmented WhatsApp threads, handwritten notes, Excel sheets, verbal task assignment, and manual translation with one permissioned, audited, multilingual system.

## Applications

| Application | Audience | Primary device |
|-------------|----------|----------------|
| **Admin Web** | Management, sales, purchasing, warehouse, production supervisors, QC, accounting, system admins | Desktop / laptop / tablet |
| **Customer Portal** | B2B and retail customers | Desktop / tablet / mobile |
| **Employee Production Interface** | Floor workers, inspectors, delivery staff | Tablet / phone / shared terminals |
| **API** | All clients | Server |
| **Worker** | Background jobs (PDF, AI/OCR, notifications, reports) | Server |

## Core value propositions

1. **Specification accuracy** — structured RFQs with measurements, fabrics, materials, and attachments.
2. **Quotation integrity** — versioned quotes, internal approval, customer acceptance evidence.
3. **Production traceability** — configurable stages, employee tasks, photos, blockers, QC gates.
4. **Inventory accuracy** — multi-warehouse balances changed only via transactions.
5. **Financial visibility** — invoices, payments, statements with role-gated access.
6. **Customer transparency** — portal tracking without exposing internal costs or employee metrics.
7. **Arabic-first multilingual UX** — Arabic, English, Hebrew with full RTL.
8. **Human-in-the-loop AI** — OCR/translation/extraction drafts only; never auto-confirms orders.

## Brand direction

- Army Camo (`#776245`) primary on Apple White / white surfaces; Liquorice dark theme
- Clean enterprise layouts (not ecommerce chrome); dense tables and forms
- Multilingual typography: Gendy (Latin target) / KO Sans (Arabic target) / Heebo — interim Outfit + Noto Sans Arabic until licensed files land
- Full token, logo, and type guidance: [brand.md](./brand.md)

## Out of scope (v1)

Documented in `assumptions.md`: hosting licenses, Meta WhatsApp Business fees, marketing content production, and real-time online payment gateway (abstracted; enabled only when configured).
