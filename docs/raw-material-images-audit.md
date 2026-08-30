# Raw-material images — architecture audit

**Date:** 2026-08-22  
**Scope:** How Accessories photos work today, and what must change so every RAW MATERIAL SKU uses the same canonical image.

No implementation in this document. Findings drove [`raw-material-images-closure-report.md`](./raw-material-images-closure-report.md).

---

## Verdict

Accessories do **not** have a private image model. Photos are a generic optional string on `InventoryItem.imageUrl`. Upload is the existing `INVENTORY_IMAGE` document pipeline. Raw materials already share that column and the same create/PATCH endpoints; **UI gates** and **nested DTO selects** hide the field.

Do **not** add `rawMaterialImage` / `accessoryImage`. Reuse `imageUrl`.

---

## 1. How an Accessory stores its image

| Layer | Fact |
|---|---|
| Model | `InventoryItem.imageUrl String?` in [`packages/database/prisma/schema.prisma`](../packages/database/prisma/schema.prisma) |
| Comment (before this work) | “Optional photo URL (accessories) — durable /uploads download link” |
| Accessory-specific table | **None** |
| `Material` | **No** image fields |
| `Product.imageUrl` / `galleryUrls` | Catalog finished goods only — not inventory SKUs |
| `Document` | Created on upload (`category: INVENTORY_IMAGE`); inventory stores the **download URL string**, not `documentId` |

Accessories are still `itemClass: RAW_MATERIAL` with `materialGroup: ACCESSORIES` and/or categories `METAL_ACCESSORY` / `DECORATIVE_ACCESSORY` / `PACKAGING`.

---

## 2. Ownership

The image belongs to the **inventory SKU identity** (`InventoryItem`), not:

- a stock movement
- warehouse balance
- purchase order line
- BOM line
- production order / workflow snapshot

Warehouse quantities can differ; image identity cannot.

---

## 3. Upload / replace / delete

| Action | How |
|---|---|
| Upload bytes | `POST /api/v1/uploads?category=INVENTORY_IMAGE` |
| Upload from URL | `POST /api/v1/uploads/from-url?category=INVENTORY_IMAGE` |
| Attach | `POST` / `PATCH /api/v1/inventory/items/:id` with `imageUrl` |
| Replace | New upload + PATCH new URL. Old `Document`/blob is **not** garbage-collected (same as accessories today) |
| Remove | `PATCH { imageUrl: null }` |
| Dedicated `…/items/:id/image` route | **None** |

TTL for `INVENTORY_IMAGE` (and product/catalog images): 10 years (`LONG_LIVED_TTL_SECONDS` in `uploads.controller.ts`).

---

## 4. File storage

- Default: local disk under `LOCAL_UPLOAD_DIR` or `./uploads` (`YYYY-MM-DD/<uuid>.ext`)
- Optional: MinIO/S3 when `STORAGE_PROVIDER=s3`
- Stored DB value: URL string, typically `{apiBase}/api/v1/uploads/download?token=…` or a seed Unsplash HTTPS URL
- List/get **do not** regenerate tokens; they return the stored string

---

## 5. Fallback

| Layer | No image |
|---|---|
| DB | `null` |
| Create omit / blank | omitted → `null` |
| Update `""` | stored as `null` |
| Mobile select | `item.imageUrl?.trim() \|\| null` |
| Mobile accessory list | empty photo well + `mobile.inventory.noPhoto` |
| WIP / FG rows | use **`product.imageUrl`**, not inventory-item photo |

---

## 6. API endpoints that expose the image

| Surface | Exposes `InventoryItem.imageUrl`? |
|---|---|
| `GET/POST/PATCH /inventory/items` | **Yes** — generic; not stripped by cost helper |
| `GET /purchasing/material-demand` | **No** (select omitted `imageUrl`) |
| Production setup `materialInputs` | **No** (`sku` / `unit` only) |
| BOM defaults JSON | **No** (sku + qty) |
| PR/PO/GRN `include: { inventoryItem: true }` | **Yes, incidentally** — full Prisma item includes `imageUrl` if the UI reads it |

Permissions:

| Operation | Key |
|---|---|
| Read items (incl. `imageUrl`) | `inventory.read` |
| Create/update item (incl. image) | `inventory.adjust` |
| Upload | any of `document.manage`, `catalog.manage`, `inventory.adjust` |
| Download by token | Public (valid token) |

No `inventory.image.*` permission.

---

## 7. Accessories UI that renders it (before this work)

**Mobile only, accessory-gated:**

- `InventoryMaterialRow` — `showPhoto = item.isAccessory`
- `InventoryItemDetailScreen` — hero if `detail.isAccessory`
- `CreateInventoryItemSheet` / `EditInventoryItemSheet` — `materialGroup === 'accessories'`
- `AccessoryPhotoField` / camera / `accessoryPhotoUpload.ts`

**Does not render inventory SKU photos (even for accessories):**

- Admin Web inventory list/create/edit
- Admin Web / mobile BOM pickers, production setup, purchasing demand, PO lines, GRN
- Material readiness / shortage copy on scheduling (order-level, not SKU thumbs)

WIP/FG inventory rows already show **product** photos — out of scope.

---

## 8. Demo / seed

| Source | Images |
|---|---|
| `pnpm demo:reset` → `demo/catalog.ts` `MATERIALS` (42 SKUs) | **0** `imageUrl` |
| Legacy `seed/inventory.ts` | Only `MAT-HW-KIT` Unsplash URL |

Cedar story SKU: `MAT-ITAL-VEL` (Italian velvet reserved) — no image in factory demo.

---

## 9. What this work must change

1. Lift accessory-only **UI gates** so every `RAW_MATERIAL` can show/edit the same field.
2. Pass `imageUrl` through material-demand and production-setup nested DTOs (shared helper; do not copy onto PO lines).
3. Add Admin Web upload/preview/replace/remove (product-photo pattern, `INVENTORY_IMAGE`).
4. Seed a SKU-keyed curated photo for all 42 factory-demo RAW SKUs via `pnpm demo:reset`.
5. Keep WIP/FG on product photos. Do not change MRP, reservations, scheduling, or BOM quantities.
