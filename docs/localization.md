# Localization

Internationalization strategy for **Maher Al-Aghbar & Sons Furniture ERP** — Arabic-first with English and Hebrew support for staff, customers, and documents in Jordan and cross-border accounts.

---

## Supported locales

| Code | Language | Script | Direction | Default |
|------|----------|--------|-----------|---------|
| `ar` | Arabic | Arabic | **RTL** | **Yes** (UI + factory floor) |
| `en` | English | Latin | LTR | Secondary |
| `he` | Hebrew | Hebrew | **RTL** | Customer/staff option |

User preference stored on **User.locale** and **Customer.preferredLocale**. Portal respects customer preference; staff can override in profile.

---

## RTL layout

- Next.js apps use logical CSS properties (`margin-inline-start`, `padding-inline-end`).
- `dir` attribute set on `<html>` from active locale: `rtl` for `ar` and `he`, `ltr` for `en`.
- Icons with direction (chevrons, back arrows) flip in RTL via `[dir=rtl]` rules.
- Tables: numeric columns remain LTR (`dir="ltr"` on cell) for amounts and phone numbers.
- Modals and drawers anchor from logical start/end.

Brand typography (from brand guidelines; see `docs/brand.md`):

- **Arabic:** KO Sans (interim: Noto Sans Arabic)
- **Latin:** Gendy (interim: Outfit)
- **Hebrew:** Heebo

---

## Translation namespaces

Shared package: `packages/i18n`

```
packages/i18n/locales/
  ar/
    common.json
    auth.json
    crm.json
    quotation.json
    sales.json
    production.json
    inventory.json
    finance.json
    portal.json
    employee.json
    errors.json
    validation.json
  en/  (same structure)
  he/  (same structure)
```

| Namespace | Used by | Content |
|-----------|---------|---------|
| `common` | All apps | Nav, buttons, dates, pagination |
| `auth` | All | Login, MFA, password reset |
| `crm` | Admin | Customers, contacts, activities |
| `quotation` | Admin, Customer | RFQ, quote statuses, PDF labels |
| `sales` | Admin | Sales orders, contracts |
| `production` | Admin, Employee | Stages, tasks, blockers |
| `inventory` | Admin | SKUs, warehouses, transactions |
| `finance` | Admin, Customer | Invoices, payments, statements |
| `portal` | Customer | Dashboard, tracking copy |
| `employee` | Employee | Task UI, simplified labels |
| `errors` | API + clients | Mapped from API `error` codes |
| `validation` | Forms | Zod message keys |

### Key naming

```
{namespace}.{section}.{key}
quotation.status.sent
finance.invoice.dueDate
errors.CONFLICT.insufficientStock
```

---

## API localization

- `Accept-Language` header selects message catalog for errors and validation.
- Entity **display names** (product names, stage names) stored with optional translations JSON:

```json
{ "ar": "نجارة", "en": "Carpentry", "he": "נגרות" }
```

- PDF generation uses locale from quotation/customer preference.
- Document numbers and SKUs are locale-invariant (Latin).

---

## Date, number, and currency

| Type | Format |
|------|--------|
| Currency | JOD — `1,250.500 JD` (3 decimals); `Intl.NumberFormat` per locale |
| Dates | Display in Asia/Amman; storage UTC ISO-8601 |
| Relative time | `next-intl` / `Intl.RelativeTimeFormat` |
| Phone | E.164 storage; national format on display |

Arabic-Indic numerals: optional user setting; default Western digits for financial clarity in ERP context.

---

## AI / OCR multilingual flow

1. Detect source language (AR/EN/HE).
2. Preserve original OCR text in job record.
3. Extract using canonical Arabic or English prompt per settings.
4. Review UI shows original + translated side-by-side when languages differ.

See `ai-ocr.md`.

---

## PDF and print

- RTL PDFs for Arabic/Hebrew quotes and invoices (mirrored header layout).
- Bilingual PDF option: Arabic primary block + English secondary (Phase 6+).
- Font embedding for Arabic/Hebrew glyphs in PDF worker.

---

## Testing localization

- CI: pseudo-locale or snapshot tests for key screens in `ar` and `en`.
- Manual: Hebrew RTL regression on customer portal quotation accept flow.
- No hardcoded user-facing strings in components — ESLint rule `i18n/no-literal-string` (admin apps).

---

## Fallback chain

```
requested locale → user.locale → customer.preferredLocale → ar (default)
```

Missing key logs warning in development; falls back to English string in production if Arabic missing.
