# Raw-material images — closure report

**Date:** 2026-08-22 (Asia/Amman)  
**DB:** `maher_erp` after `pnpm demo:reset`  
**Live UAT:** `pnpm smoke:raw-material-images-uat` → **56/56 PASS**  
**Evidence:** `tmp-raw-material-images-uat.json`

Canonical photo = `InventoryItem.imageUrl` for every `RAW_MATERIAL` SKU (including accessories, packaging, paint, adhesive). Same SKU, same URL on inventory, purchasing demand, PO lines (via `inventoryItem`), BOM, and production setup. No second column. No copy onto `PurchaseOrderLine` / GRN / BOM JSON / snapshots.

---

## Scoreboard

| Check | Result |
|---|---|
| Curated demo RAW SKUs with images | **42/42** |
| Remaining RAW SKUs without images | **none** |
| A fabric/velvet Cedar `MAT-ITAL-VEL` | **PASS** — Unsplash `photo-1576566588028-4147f3842f27` (dark/emerald velvet) |
| A fabric/velvet other `MAT-VEL-NAVY` | **PASS** — distinct from Cedar |
| B foam `MAT-FOAM-HD` | **PASS** |
| C timber `MAT-BEECH` | **PASS** |
| D springs/hardware `MAT-SPRING` | **PASS** |
| E glue `MAT-GLUE` | **PASS** |
| Inventory list thumb = detail URL | **PASS** (all six families) |
| PATCH replace + restore | **PASS** on foam; dealer **403**; on-hand **198 → 198** |
| Purchasing picker / PO line | **PASS** — URL from `inventoryItem.imageUrl`; PO line has no `imageUrl` field |
| Material demand DTO | **PASS** — `GET /material-demand` 200; includes `imageUrl` when rows exist. After this reset: **0 open required SKUs** (empty list is expected, not a missing field) |
| Product BOM | **PASS** — same URL, not persisted on `bomDefaults` |
| Production setup `bomLines` + `materialInputs` | **PASS** — same URL |
| Accessories still render | **PASS** — `MAT-HW-KIT` has a family photo |
| Cedar qty / ETA / scheduling / at-risk | **Unchanged** (visual-only UAT) |

---

## What shipped

- Helper `canonicalInventoryImageUrl` — trim or `null`; used on demand, setup, production material activity, catalog BOM.
- Mobile: accessory-only photo gates lifted to all `RAW_MATERIAL`; compact thumbs on pickers, BOM, stage setup, production materials. WIP/FG still use **product** photos.
- Admin Web: inventory list thumb, create/edit upload–preview–replace–remove (`INVENTORY_IMAGE`), thumbs on BOM picker, materials list, product BOM, production setup, purchasing demand, PO lines, GRN receive.
- Demo: SKU-keyed Unsplash pool in `packages/database/prisma/demo/material-photo-pool.ts`; `seedDemoCatalog` assigns all 42 `MATERIALS` rows; `demo:validate` asserts HTTP URLs, uniqueness, and Cedar velvet.
- i18n: accessory camera copy genericized to item/material photo (EN/AR/HE); Admin `inventory.itemPhoto*` keys.

Permissions unchanged: read `inventory.read`; mutate `inventory.adjust`; upload any of `document.manage` / `catalog.manage` / `inventory.adjust`.

---

## Tests

- API: `inventory-image.spec.ts`, `inventory.cost-visibility.spec.ts` (GET keeps `imageUrl` without `cost.read`; PATCH set/clear), `staff-permissions.spec.ts` (warehouse can read, cannot adjust).
- Mobile: `selectInventory.test.ts` — non-accessory RAW shows photo slot; empty → `null`; WIP/FG do not use SKU photos; accessory still round-trips `imageUrl`.
- Demo: `pnpm demo:reset` ran `demo:validate` (42 raw SKUs). Jest pool uniqueness: 42 distinct Unsplash photo IDs including `MAT-ITAL-VEL`.

Jest is not the live PASS. Live UAT is.

---

## Out of scope (still)

Scheduling, Sync, Optimize, MRP quantities, BOM qty, stock qty, WIP/QC, Cedar dates/at-risk. No `rawMaterialImage` column, no blob on inventory rows, no base64 in API payloads.
