# Inventory QR identity — closure report

**Date:** 2026-08-24 (Asia/Amman)  
**API:** `http://localhost:4000` · DEV DB `maher_erp`  
**Live UAT:** `pnpm smoke:inventory-qr-uat` → **57/57 PASS**  
**Evidence:** `tmp-inventory-qr-uat.json`

Scan is identify-only. Printed payload, API `scanCode`, and Mobile QR encode the same helper. Mutations stay on existing receive (PO → GRN, else explicit manual), issue, transfer, and count. No second stock engine. No lots/rolls. No new permission keys.

Audit: [raw-material-qr-warehouse-audit.md](./raw-material-qr-warehouse-audit.md).

---

## Scoreboard

| Check | Result |
|---|---|
| RAW MATERIAL CANONICAL ENTITY | `InventoryItem` / `inventory_items` |
| RAW / ACCESSORY SHARED MODEL | **YES** — same item, same `scanCode` |
| INVENTORY TRACKING LEVEL | **SKU** (raw). Lots stay WIP/FG |
| ONE AUTHORITATIVE PAYLOAD | **PASS** — `inventoryScanPayload` in `@maher/types` |
| Label PDF QR = API `scanCode` = Mobile QR | **PASS** — all three use the helper / `item.scanCode` |
| Demo `qrCode = sku` | **PASS** — seed + live Cedar `MAT-ITAL-VEL` |
| Demo `barcode = sku` | **NO** — barcode stays `null` unless a real barcode exists |
| `findByCode` keys | **sku \| barcode \| qrCode** (three lookups, not three copies) |
| Archived labels still identify | **PASS** — `findByCode` / `getItem` include archived; mutations `ITEM_INACTIVE` |
| Open receipts (warehouse) | **PASS** — `GET /inventory/items/:id/open-receipts` gated by `inventory.receive` |
| Open receipts leak cost / demand | **NO** — no unit price, tax, other SKUs, demand |
| Warehouse `purchase-order.read` | **NO** — `WAREHOUSE_MANAGEMENT` unchanged; PO detail **403** |
| PO-aware receive | **PASS** — eligible PO → GRN; explicit Manual → `POST /inventory/receipts` |
| Canonical GRN path | **PASS** — live throwaway GRN `GRN-2026-00019`; ledger `referenceType = GoodsReceipt` |
| Manual receipt separate | **PASS** — ad-hoc receipt is not `GoodsReceipt` |
| KNOWN ITEM RECEIVE NEEDS SCAN | **NO** — confirm scan optional |
| PRODUCTION ISSUE LINKAGE | **N/A** — floor issue stays `POST /inventory/issues`; BOM consume stays task-complete |
| Cedar identify (read-only) | **PASS** — `scanCode`/`qrCode` = `MAT-ITAL-VEL`; barcode `null`; on-hand **0 → 0** |
| Cedar inbound fabric PO | **PASS** — `PORD-2026-00019` remaining **24 m** (not production `PO-2026-00056`) |
| Accessory `MAT-HW-KIT` | **PASS** — by-code + `imageUrl` + `scanCode` |
| Dealer identify / open-receipts | **403** |
| Throwaway cleanup | **PASS** — `MAT-QR-UAT-*` count **0** after run |
| Scheduler / MRP / BOM qty / Sync / Optimize | **Unchanged** — scheduling Jest **28/28 suites, 335 tests PASS** |

---

## What shipped

- Shared helper [`packages/types/src/scan-code.ts`](../packages/types/src/scan-code.ts): `printableScanCode`, `inventoryScanPayload({ sku, qrCode })`. PDF util re-exports the former.
- Item DTO always includes **`scanCode`**. Label PDF `qr.payload = inventoryScanPayload(item)`. Mobile QR sheet encodes **`item.scanCode` only**.
- `createItem` / demo RAW seed / `syncFromMaterials`: `qrCode = sku`. Do not copy SKU into `barcode`. PATCH does not accept `sku` or `qrCode`.
- `GET /inventory/items/:id/open-receipts` (`inventory.receive`): receivable POs for this SKU, remainder = ordered − GRN received.
- Mobile: header Scan → by-code → result sheet (incoming from open-receipts; demand only with `purchase-order.read`) → existing receive / issue / transfer / count / detail / QR.
- Admin inventory move modal: same GRN vs explicit Manual split; known-item scan optional.
- Demo validate asserts `qrCode === sku` for curated RAW SKUs. Father walkthrough Cedar path: Scan → identify → stop **before** Confirm receive.
- Demo GRN numbers now use the `grn` sequence (`nextDoc`) so they no longer collide with API `GRN-YYYY-NNNNN`. Live UAT aligned `sequence_counters.grn` on the current DB (max 18) so warehouse GRN could allocate.

Permissions unchanged. No migration. No `purchase-order.read` on warehouse.

---

## Tests

Jest is not the live PASS. Live UAT is.

| Suite | Result |
|---|---|
| `@maher/types` `scan-code.spec.ts` | **6/6 PASS** |
| API `inventory-scan.spec.ts` | **11/11 PASS** |
| API cost visibility + staff-permissions | **17 PASS** |
| Mobile `inventoryScanIdentity` + chrome layout | **12 PASS** |
| `@maher/permissions` `permission-meta` (warehouse lacks `purchase-order.read`) | **8/8 PASS** |
| API scheduling (material-arrival / readiness / replan / floor / optimize) | **Unchanged this pass — those suites still PASS in the API Jest run** |
| Live `pnpm smoke:inventory-qr-uat` | **57/57 PASS** |

Live throwaway: SKU `MAT-QR-UAT-1787563057829`, PO `PORD-2026-00026`, GRN `e56e60c9-…` / `GRN-2026-00020`. Create-identity throwaway `QR-CREATE-UAT` (`652e3da3-…`). All deleted in cleanup. Cedar stock untouched.

This live pass did **not** re-run `pnpm demo:reset`. RAW `qrCode = sku` was already on `maher_erp` (UAT backfill count **0**). Seed still writes that on reset.

---

## Out of scope (still)

- Production-aware issue (scan-to-stage). **N/A**.
- Roll / lot / serial QR.
- Offline mutations.
- New permission keys.
- SKU photos inside Label PDF.
- Scheduler / MRP / BOM quantities / Sync / Optimize.

Mobile camera + on-device QR sheet were not exercised on a handset; encoding is locked in Jest (`item.scanCode` only). Admin receive modal was not click-tested in a browser this pass; the same GRN vs manual contract was live-posted against the API as `warehouse`.

---

## CREATE ITEM UX CLEANUP

**Date:** 2026-08-24 (Asia/Amman)

Creating an inventory item and scanning a physical label are different jobs. The create form must not ask the user to scan the QR the system itself creates.

### Audit (create flow, before this cleanup)

Create never wrote `qrCode`.

| Surface | What “Scan” actually did |
|---|---|
| Mobile `CreateInventoryItemSheet` / `EditInventoryItemSheet` | `CodeField` bound to **`barcode`**. Camera used generic `mobile.scan.enterOrScan` plus a QR icon, so it **looked** like “Scan QR”. Submit sent `barcode` only. `CreateInventoryItemInput` has **no `qrCode` field**. |
| Admin `inventory-client` create/edit | Typed barcode `Input`. No camera. POST/PATCH **omit `qrCode`**. |
| API `CreateInventoryItemDto.qrCode` | Optional. `createItem`: `qrCode = provided.trim() \|\| sku`. PATCH does not accept `sku` or `qrCode`. |

Decision (task §5 option B): **keep** the camera on the barcode field, relabel it as **supplier barcode**, and make sure it only populates `barcode`.

### What changed

- Mobile create/edit: labels `Supplier barcode` / `Scan supplier barcode` (AR/HE equivalents). Camera icon is `barcode-outline`. Copy no longer uses the global inventory Scan / QR strings.
- Admin create/edit: same `supplierBarcode` label. Still no `qrCode` field.
- Mobile post-create: after the create Modal unmounts, an ActionSheet offers **Done / View QR / Print label / View details**. View QR uses existing `InventoryQrSheet` with `item.scanCode`. QR is **not** auto-opened.
- Admin post-create: existing success banner (admin has no `InventoryQrSheet`).
- Backend QR identity, Label PDF, global Inventory Scan, known-item Receive, and scan-first Receive were **not** redesigned.

### Scoreboard

| Check | Result |
|---|---|
| CREATE QR SCANNER REMOVED | **PASS** — create/edit no longer use inventory Scan/QR copy; camera on the form is supplier-barcode only |
| QR AUTO-CREATED | **PASS** — `createItem` sets `qrCode` on the same write; no Generate-QR call |
| QR CODE = SKU BY DEFAULT | **PASS** — omitted `qrCode` → `qrCode = sku` |
| BARCODE SEPARATE | **PASS** — not copied from SKU; optional supplier barcode only |
| POST-CREATE VIEW QR | **PASS** (mobile ActionSheet → `InventoryQrSheet` / `scanCode`) |
| POST-CREATE PRINT LABEL | **PASS** (mobile ActionSheet → existing label PDF) |
| GLOBAL SCANNER UNCHANGED | **PASS** — Inventory chrome Scan still identifies existing items |
| KNOWN RECEIVE UNCHANGED | **PASS** — `AddStockSheet` confirm scan still optional |
| PO/GRN UNCHANGED | **PASS** — open-receipts / GRN / manual receipt not touched |
| ACCESSORY REGRESSION | **PASS** — same `InventoryItem` create path (`MAT-HW-UAT` Jest + live `MAT-HW-KIT`) |
| REAL API TESTED | **YES** — `pnpm smoke:inventory-qr-uat` **57/57 PASS** |

Live create (no `qrCode`, no `barcode`):

- `sku` = `QR-CREATE-UAT`
- `qrCode` = `QR-CREATE-UAT`
- `scanCode` = `QR-CREATE-UAT`
- `barcode` = `null`
- `GET /inventory/items/by-code/QR-CREATE-UAT` resolved the same id
- Label PDF 200 (`application/pdf`)
- Row deleted in cleanup (leftover count **0**). Cedar/demo inventory not mutated.

---

## MOBILE SCANNER UX CLOSURE

**Date:** 2026-08-24 (Asia/Amman)

### Original failure

Dismissing the scan-result RN `Modal` and presenting the next Modal / navigation in the **same tick** (e.g. `setScanResult(null)` + `setMove(...)` together). On iOS the second present no-ops → sheet disappears, nothing opens, app feels frozen.

### Exact fix

One canonical handoff in [`InventorySignatureHome.tsx`](../apps/mobile/src/features/inventory/components/InventorySignatureHome.tsx):

1. Queue semantic action on `pendingAfterScanRef`
2. Dismiss scan result only (`setScanResult(null)`)
3. Flush after [`BottomSheet.onClosed`](../apps/mobile/src/components/sheets/BottomSheet.tsx) → open Receive / Issue / Transfer / Count / Details / QR / Scan again / PO

No arbitrary `setTimeout` handoffs. QR→Print Label keeps the existing `pendingPrintRef` pattern.

### Scan-to-select (warehouse)

Reusable [`ScanInventoryItemAction`](../apps/mobile/src/features/inventory/components/ScanInventoryItemAction.tsx) + [`ScannedInventoryItemConfirm`](../apps/mobile/src/features/inventory/components/ScannedInventoryItemConfirm.tsx) on:

- Receive / Issue (`AddStockSheet`) when no `initialItem`
- Transfer / Count sheets + `InventoryItemPickPanel`

Confirm required before selection. Wrong type / inactive blocked. Never auto-submits stock. BOM / product setup / purchasing-office pickers **not** wired this pass.

### Scoreboard

| Check | Result |
|---|---|
| SCAN RESULT AESTHETIC | **PASS** (code) — hero, value-dominant stats, warehouse section, action hierarchy |
| CONTENT-AWARE SHEET | **PASS** (code) — shorter default height; expands with extra sections |
| RECEIVE ACTION | **PASS** (handoff source test) — awaits handset |
| ISSUE ACTION | **PASS** (handoff source test) — awaits handset |
| TRANSFER ACTION | **PASS** (handoff source test) — awaits handset |
| COUNT ACTION | **PASS** (handoff source test) — awaits handset |
| VIEW DETAILS | **PASS** (handoff source test) — awaits handset |
| QR CODE | **PASS** (handoff source test) — awaits handset |
| SCAN AGAIN | **PASS** (handoff source test) — awaits handset |
| CANCEL | **PASS** (code) — clears pending + closes |
| NO INVISIBLE OVERLAY | **FAIL** until real handset proves touchable after every dismiss |
| NO APP FREEZE | **FAIL** until real handset proves all action chains |
| RECEIVE SCAN-TO-SELECT | **PASS** (code) — awaits handset |
| ISSUE SCAN-TO-SELECT | **PASS** (code) — awaits handset |
| TRANSFER SCAN-TO-SELECT | **PASS** (code) — awaits handset |
| COUNT SCAN-TO-SELECT | **PASS** (code) — awaits handset |
| SCAN CONFIRMATION | **PASS** (code) |
| WRONG TYPE GUARD | **PASS** (code) |
| ARCHIVED GUARD | **PASS** (code) |
| CAMERA PERMISSION | **FAIL** until handset |
| EN | **PASS** |
| AR | **PASS** |
| HE | **PASS** |
| REAL HANDSET TESTED | **NO** |
| BUSINESS LOGIC CHANGED | **NO** |

Jest: `inventoryScanIdentity` + chrome layout **15 PASS** (includes pendingAfterScan / Scan QR wiring assertions).

**Scanner UX is not fully PASS** until a physical iPhone/Android run verifies every action chain and that no invisible Modal/backdrop remains after dismiss.

---

## KNOWN-ITEM LABEL CONFIRMATION

**Date:** 2026-08-24 (Asia/Amman)

### Problem

Receive / Issue (and Transfer / Count when an item is already selected) exposed “Scan label to confirm” as a `CodeField` / scan-to-select lookup. Scanning another material’s QR could **silently replace** `selectedItem`, and Modal handoff races could freeze the sheet.

### Semantics (Mode A vs Mode B)

| Mode | When | After scan |
|---|---|---|
| **A — Label confirm** | Item already selected (`initialItem` / picked) | Match → confirm inline; mismatch → warn; swap **only** via explicit “Use scanned material” |
| **B — Scan-to-select** | No item selected | Identify → “Use this material?” → populate |

### What changed

- [`KnownItemLabelConfirm`](../apps/mobile/src/features/inventory/components/KnownItemLabelConfirm.tsx) is **presentation only** (no `openScanner`).
- Parent sheets own VERIFY via [`useLabelVerifyScan`](../apps/mobile/src/features/inventory/useLabelVerifyScan.ts) + [`runInventoryLabelVerify`](../apps/mobile/src/features/inventory/runInventoryLabelVerify.ts) → [`InventoryScanMatchResult`](../apps/mobile/src/features/inventory/components/InventoryScanMatchResult.tsx) (`MATCH` / `MISMATCH` / `UNKNOWN` / `ARCHIVED` / `DISALLOWED` / `ERROR`)
- Known-item Receive / Issue: no `CodeField` confirm path; optional scan; receive still works with no scan
- Transfer / Count: Mode A when `item` set; Mode B when empty
- Results are **inline** (no second RN Modal for match UI)
- [`CodeScannerProvider`](../apps/mobile/src/components/scan/CodeScannerProvider.tsx): resolve after Modal dismiss (`onDismiss` / Android `InteractionManager`) — **do not change further unless handset proves regression**
- EN / AR / HE copy for confirm + mismatch + a11y

### Scoreboard

| Check | Result |
|---|---|
| MATCH CASE | **FAIL** until handset shows “Label confirmed” |
| MISMATCH CASE | **FAIL** until handset shows warn + selected item unchanged |
| NO SILENT ITEM SWAP | **PASS** (code invariant: `onUseScanned` only) — awaits handset |
| USE SCANNED ITEM EXPLICIT | **PASS** (Receive/Issue/Transfer/Count allow change) |
| KEEP CURRENT | **PASS** (code) |
| UNKNOWN QR | **PASS** (code) |
| ARCHIVED QR | **PASS** (code) |
| NO SCAN STILL WORKS | **PASS** (submit does not require scan) |
| RECEIVE | **FAIL** until handset |
| ISSUE | **FAIL** until handset |
| TRANSFER | **FAIL** until handset |
| COUNT | **FAIL** until handset |
| NO APP FREEZE | **FAIL** until real handset proves touchable after match/mismatch/cancel/scan-again |
| NO INVISIBLE OVERLAY | **FAIL** until real handset |
| CAMERA | **FAIL** until handset |
| AR | **PASS** (copy) |
| HE | **PASS** (copy) |
| REAL HANDSET TESTED | **NO** |
| BUSINESS LOGIC CHANGED | **NO** |

Jest: `labelConfirmClassify` + `inventoryScanIdentity` parent-owned VERIFY assertions.

**Label confirmation / VERIFY is not PASS** until handset shows MATCH/MISMATCH UI after scan (Metro: `VERIFY consumer resumed` → `VERIFY result MATCH|MISMATCH` → `VERIFY inline result state committed`).

---

## INVENTORY QR COMPLETE INTERACTION MATRIX

**Date:** 2026-08-24 (Asia/Amman)

### Entry-point audit (Mobile)

| Screen / component | Purpose | Mode | Callback / result |
|---|---|---|---|
| `InventorySignatureHome` chrome Scan | Identify item | IDENTIFY | `resolveInventoryScan` → `InventoryScanResultSheet` |
| Scan result → Scan again | Re-identify | IDENTIFY | `pendingAfterScan` → `runIdentifyScan` |
| `AddStockSheet` unknown item + `ScanInventoryItemAction` / `CodeField` | Select material | SELECT | confirm → set item |
| `AddStockSheet` known `initialItem` | Verify label | VERIFY | sheet `useLabelVerifyScan` → `KnownItemLabelConfirm` + `InventoryScanMatchResult` |
| `CreateTransferSheet` no item + pick panel | Select material | SELECT | `ScanInventoryItemAction` |
| `CreateTransferSheet` item selected | Verify label | VERIFY | sheet `useLabelVerifyScan` → presentational confirm |
| `CreateStockCountSheet` (same) | SELECT / VERIFY | same | same |
| `InventoryItemPickPanel` | Select in picker | SELECT | `ScanInventoryItemAction` → `onPick` |
| Create/Edit item `CodeField` | Supplier barcode | N/A | fills `barcode` only — not inventory identify |
| BOM / product setup / SO / purchasing | — | — | **not wired** (audit: no `ScanInventoryItemAction`) |

### Root causes (proven)

**TRANSFER ROOT CAUSE:**  
`CodeScannerProvider.openScanner()` was changed to resolve **only** on iOS Modal `onDismiss`. That callback often never fires for controlled `visible={false}` Modals in Expo/RN. After the camera UI showed a captured code and the user confirmed, the Promise never resolved → no by-code lookup → no confirmation → **“scan succeeds, nothing happens.”** Same hang affected Count and VERIFY. Stale `CodeScannerScreen` session (lock + last code) could also persist across opens.

**COUNT ROOT CAUSE:**  
Identical shared provider hang (not a separate Count-sheet bug). Pick-panel SELECT never received the code Promise.

**KNOWN-ITEM VERIFY ROOT CAUSE (evolved):**  
1. Earlier: same `openScanner` hang (fixed + proven on handset).  
2. Then: child `KnownItemLabelConfirm` owned `await openScanner()` and unmounted when BottomSheet hid the host during camera → Promise resolved with nowhere to commit UI.  
3. Fix: BottomSheet stays mounted (inert); **parent sheet** owns VERIFY via `useLabelVerifyScan` + `runInventoryLabelVerify`; `KnownItemLabelConfirm` is presentation-only.

**GLOBAL SCAN REGRESSION:**  
Same provider hang would block IDENTIFY after camera confirm. Action handoff (`pendingAfterScan`) unchanged.

**SHARED FIX:**  
1. `CodeScannerProvider` always flushes via `InteractionManager` + 80ms handoff (same cadence as `BottomSheet.onClosed`), plus idempotent `onDismiss`; remount camera with `key={session}` to reset lock.  
2. Central `resolveInventoryScan` → FOUND / NOT_FOUND / ERROR.  
3. One SELECT orchestrator (`ScanInventoryItemAction`) and parent-owned VERIFY (`useLabelVerifyScan` + presentational `KnownItemLabelConfirm`) for Receive / Issue / Transfer / Count.

### Scoreboard

| Check | Result |
|---|---|
| GLOBAL IDENTIFY | **PASS** (code) — awaits handset |
| GLOBAL ACTION HANDOFF | **PASS** (code) — awaits handset |
| RECEIVE SELECT | **PASS** (code) |
| RECEIVE VERIFY | **FAIL** until handset |
| ISSUE SELECT | **PASS** (code) |
| ISSUE VERIFY | **FAIL** until handset |
| TRANSFER SELECT | **PASS** (code — hang fixed) — awaits handset |
| COUNT SELECT | **PASS** (code — hang fixed) — awaits handset |
| MATCH | **FAIL** until handset UI |
| MISMATCH | **FAIL** until handset UI |
| UNKNOWN QR | **PASS** (confirm / inline — not toast-only) |
| ARCHIVED | **PASS** (code) |
| WRONG TYPE | **PASS** (code) |
| API ERROR | **PASS** (distinct ERROR UI) |
| CAMERA CANCEL | **PASS** (code — form state preserved) |
| SCAN AGAIN | **PASS** (code — session remount) |
| SCANNER LOCK RESET | **PASS** (code — `key={session}`) |
| NO SILENT ITEM SWAP | **PASS** (VERIFY invariant) |
| NO SCAN-BASED STOCK MUTATION | **PASS** |
| NO INVISIBLE OVERLAY | **FAIL** until handset |
| NO APP FREEZE | **FAIL** until handset |
| AR | **PASS** (copy) |
| HE | **PASS** (copy) |
| REAL HANDSET | **NO** |
| REAL API | **YES** (by-code used; handset pending) |
| BUSINESS LOGIC CHANGED | **NO** |

Jest: `resolveInventoryScan`, `inventoryQrMatrix`, `labelConfirmClassify`, `inventoryScanIdentity`.

**OVERALL QR UX = FAIL** until handset UAT proves Transfer/Count/Receive/Issue/Global no longer end in “scan → nothing.”

---

## FLATTENED INLINE SELECT (2026-08-24 follow-up)

### ORIGINAL ROOT CAUSE
`openScanner` Promise could hang when flush relied on unreliable Modal `onDismiss` alone.

### WHY PREVIOUS FIX WAS INSUFFICIENT
Even with InteractionManager flush, SELECT confirmation used a **second RN Modal** (`ScannedInventoryItemConfirm` → `BottomSheet overlay`) stacked on the operation sheet Modal that yields during camera. Result ownership also lived inside pick-panel trees that disappear when the camera takes over. Handset still saw: camera closes → nothing.

### ACTUAL FINAL ROOT CAUSE (architecture)
Nested Modal stack + confirm state not owned by the surviving operation sheet:

`Operation Modal` → (yield) → `Camera Modal` → `Confirm overlay Modal`

iOS does not reliably present that stack. Delays do not fix it.

### HANDSET UPDATE (scanner proven; consumer next)

**PREVIOUS ROOT CAUSE (scanner Promise hang):** FIXED AND PROVEN ON HANDSET  
Sessions show: code detected → Promise resolved MAT-BEECH via InteractionManager.  
**Do not change CodeScannerProvider further.**

**CURRENT ROOT CAUSE:** Nested Modals — Receive/Issue sheet stayed `visible` (inert/opacity 0) while camera Modal opened. On iOS that yields a dimmed/frozen screen (“camera modal visible” in Metro, no usable camera). Earlier, child-owned `await openScanner()` also lost UI when the host remounted.

**Consumer fix (this pass):**  
1. BottomSheet **yields** host Modal while `isScanning` (and accessory/map/overlay) so the camera Modal can present.  
2. VERIFY state stays on the sheet **component** via `useLabelVerifyScan` / `runInventoryLabelVerify` (outside Modal children); `KnownItemLabelConfirm` is presentation-only.  
3. CodeScannerProvider **untouched**.

### FINAL SHARED ARCHITECTURE
| Layer | Implementation |
|---|---|
| Scanner | `CodeScannerProvider` — Promise flush via InteractionManager + onDismiss; session remount; `__DEV__` session logs + watchdog |
| Resolver | `resolveInventoryScan` → FOUND / NOT_FOUND / ERROR |
| SELECT confirm | **`InventoryScanSelectInline` inside the operation sheet** — **no confirm Modal** |
| VERIFY | Parent `useLabelVerifyScan` → `runInventoryLabelVerify` → presentational `KnownItemLabelConfirm` + `InventoryScanMatchResult` |
| Transfer / Count | Form always mounted under pick overlay; `ScanInventoryItemAction` stays mounted; pick `onRequestScan` closes overlay and starts parent scan |
| Isolation | Metro `[QR session N]` + VERIFY consumer logs |

### Scoreboard (honest)

| Check | Result |
|---|---|
| GLOBAL IDENTIFY | **FAIL** until handset |
| GLOBAL → RECEIVE/ISSUE/TRANSFER/COUNT/DETAILS/QR | **FAIL** until handset |
| TRANSFER SELECT | **FAIL** until handset (code flattened; not proven on device) |
| COUNT SELECT | **FAIL** until handset |
| RECEIVE SELECT | **FAIL** until handset |
| RECEIVE VERIFY | **FAIL** until handset (parent-owned; not proven) |
| ISSUE SELECT | **FAIL** until handset |
| ISSUE VERIFY | **FAIL** until handset (parent-owned; not proven) |
| NO FREEZE | **FAIL** until handset |
| NO INVISIBLE OVERLAY | **FAIL** until handset |
| REAL HANDSET | **NO** |
| REAL API | **YES** (by-code path) |
| BUSINESS LOGIC CHANGED | **NO** |

**OVERALL QR UX = FAIL**

Handset retest order: Beech Receive scan MAT-BEECH (MATCH) → Beech scan MAT-ITAL-VEL (MISMATCH, Beech stays) → Issue same → Transfer/Count known-item VERIFY → Global Identify + actions. Watch Metro for `VERIFY consumer resumed` / `VERIFY result` / `VERIFY inline result state committed`.

