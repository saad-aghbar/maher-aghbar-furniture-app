# Phase 6 — Variant CRUD API + UI

**Date:** 2026-09-12

Admins can create, edit, duplicate, and deactivate product variants. Every spec detail has its own control — measurements with units, composition rows, orientation, library-backed options, included items, and a clearly separated factory-notes field.

## API

- `GET/POST /products/:productId/variants`
- `GET/PATCH/DELETE /products/:productId/variants/:id`
- `POST .../duplicate`, `activate`, `deactivate`
- Optional `?variantId=` on production-setup, workflow-configuration, production-profile, and stage-estimates
- Dealers never receive `manufacturingCost`, `bomDefaults`, `adminNotes`, or factory notes

## UI

- Admin web: Variants section on `products/[id]`, nested editor at `products/[id]/variants/[variantId]`
- Mobile: variants board on the admin product, editor route `products/[id]/variants/[variantId]`

Creating a product still creates the `${sku}-STD` default variant. Editing the product syncs that default row.
