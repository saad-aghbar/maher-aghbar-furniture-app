# Phase 4 — Spec option libraries

**Date:** 2026-09-12

Factory pick-lists now exist for the details that used to have no home: foam density, paint colour, wood type, fabric finish, piping, leg/ring, and cushion size.

## Data

- `SpecOptionGroup` / `SpecOptionValue` with `inputType` `SELECT | SELECT_WITH_QTY | DIMENSION | COLOR`.
- Optional `inventoryItemId` and `colorReferenceId` per value. Choosing foam 35 can point at `MAT-FOAM-MD`.
- Seed vocabulary is the factory sheet (`كرينا / أوكرانيه`): gold paint, matte fabric, ring 9 cm, 47×47 / 55×35 / football cushions.

## API

- `GET/POST /spec-option-groups`, `PATCH`, activate/deactivate
- `GET/POST /spec-option-values`, `GET /spec-option-values/:id`, activate/deactivate
- Mutations: `catalog.manage`. Lists: `catalog.manage | catalog.read | request.create`
- Default lists hide inactive rows. `includeInactive=true` for admin CRUD. GET-by-id still returns a deactivated value so historical orders stay readable.

## UI

- Admin web: `/spec-options` and `/spec-option-values` (`MasterCrudPage`), nested under Products.
- Mobile: `SpecOptionPickerSheet` + `SpecOptionChips`. Inactive values never appear in new pickers.

## Tests

- API: CRUD, duplicate code, permission denial, deactivate-keeps-GET.
- Selector + sheet geometry (short and long lists).
- i18n en / ar / he.
- Playwright per-locale screenshots.
- Maestro: `e2e/mobile/spec-options.yaml`.
