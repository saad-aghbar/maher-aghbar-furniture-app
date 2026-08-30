# Inventory Item Report PDF — closure report

**Date:** 2026-08-24 (Asia/Amman)  
**Live UAT:** `pnpm smoke:inventory-item-report-uat` → **18/18 PASS**  
**Artifacts:** `tmp-inventory-item-report-uat/` · `tmp-inventory-item-report-uat.json`

## Audit (before change)

**CURRENT ITEM PDF:** UI “Label PDF” → `GET /api/v1/inventory/items/:id/label` → `buildSimplePdf` (statement: photo + warehouses + small QR) · `inventory.read`

**CURRENT QR/LABEL PDF:** UI “Print label” / View QR → `GET /api/v1/inventory/items/:id/qr-label` → `buildInventoryLabelPdf` (warehouse print sheet) · `inventory.read`

These remain **separate**. Only `/label` became the management Item Report.

## What shipped

| Layer | Change |
|---|---|
| Data | `InventoryItemReportService.getReportData(itemId, permissions, locale)` |
| DTO | `inventory-item-report.ts` |
| PDF map | `inventory-item-report-pdf.ts` → `buildInventoryItemReportPdf` |
| Endpoint | `/inventory/items/:id/label` now loads report + renders Item Report |
| QR print | `/qr-label` unchanged |
| UI copy | EN “Item Report” · AR “تقرير الصنف” · HE “דוח פריט” (`labelPdf` / `itemReport`) |
| Smoke | `pnpm smoke:inventory-item-report-uat` |
| Demo | `docs/father-demo-walkthrough.md` Cedar → Item Report |

### Permissions

| Section | Gate |
|---|---|
| Base report | `inventory.read` |
| Incoming POs | `inventory.receive` **or** `purchase-order.read` |
| Material demand | `purchase-order.read` |
| Cost / value | `inventory.cost.read` |
| Dealer | no `inventory.read` → **403** (verified live) |

### Layout

1. Company + **Inventory Item Report** + generated timestamp (Asia/Amman)  
2. **Item image** (soft-fail if missing)  
3. Name + SKU + identity  
4. Stock / warehouses / status / incoming / movements / counts / demand / products / supplier / cost (permission-aware)  
5. **Scan this item** + large QR (`scanCode`) + hint  

## Scoreboard

| Check | Result |
|---|---|
| ITEM REPORT | **PASS** |
| SEPARATE FROM PRINT LABEL | **PASS** |
| IMAGE AT TOP | **PASS** |
| IDENTITY | **PASS** |
| CURRENT STOCK | **PASS** |
| WAREHOUSE BREAKDOWN | **PASS** |
| INCOMING PURCHASE ORDERS | **PASS** (Cedar `PORD-2026-00019`) |
| GRN HISTORY | **PASS** (via recent movements typed RECEIPT) |
| MANUAL RECEIPTS | **PARTIAL** (shown in movement ledger when present; no separate GRN vs manual split beyond tx type) |
| ISSUES | **PASS** (movement type ISSUE) |
| TRANSFERS | **PASS** (movement type TRANSFER) |
| ADJUSTMENTS | **PASS** (filtered adjustment section + ledger; no invented before/after) |
| STOCK COUNTS | **PASS** (when count lines exist) |
| RESERVATIONS | **PARTIAL** (aggregate reserved qty only — no per-order rows in schema) |
| PRODUCTION DEMAND | **PASS** (canonical `materialDemand`) |
| STAGE MAPPING | **PASS** (`ProductStageMaterialInput` → Used by products) |
| MATERIAL REQUIRED-BY | **PASS** |
| SUPPLIERS | **PASS** (preferred supplier when set) |
| COST PERMISSION | **PASS** (`inventory.cost.read`) |
| MOVEMENT HISTORY | **PASS** (latest 40 + total count) |
| QR AT END | **PASS** |
| QR PAYLOAD = SCANCODE | **PASS** |
| EN | **PASS** |
| AR | **PASS** |
| HE | **PASS** |
| DEALER SECURITY | **PASS** (403) |
| REAL API | **YES** |
| REAL DEV DB | **YES** |
| CEDAR REPORT | **PASS** (`MAT-ITAL-VEL`, 0 on hand, incoming PO, EN/AR/HE PDFs) |

## Live samples

- `MAT-ITAL-VEL` (Cedar) — EN/AR/HE  
- `MAT-BEECH` (stocked)  
- `MAT-FOAM-MD`  
- `MAT-HW-KIT` (accessory)  
- `/qr-label` still 200 for Cedar  

## Tests

- `inventory-item-report.spec.ts` — identity, permissions filtering, AR title, QR payload  
- `inventory-scan.spec.ts` — `/label` uses report builder; `/qr-label` uses label builder  
- `pdf.util.test.ts` — `buildInventoryItemReportPdf` emits PDF + QR  

## Notes / intentional limits

- Adjustment before/after quantities are **not invented** when the ledger only stores delta.  
- Reservations are **aggregate** only.  
- Movement history capped at **40** recent rows with total count.  
- Page chrome keeps company footer; “Page X of Y” drawn above it.
