# Purchasing overhaul visual QA

**Apps:** Expo `@maher/mobile`, Next `@maher/admin-web`  
**Date opened:** 2026-09-06  
**Status:** Automated floor, state, and i18n gates passed 2026-09-07. Device screenshots and a live browser pass are still **blocked** (no attached phone, no browser tools in this session). Use this matrix for the next device/desktop session.

Related screenshot notes: [`docs/mobile-screenshots/purchasing/`](./mobile-screenshots/purchasing/).

Marks: `P` pass · `F` fail · `-` N/A · `B` blocked.

Locales: `ar` RTL · `he` RTL · `en` LTR. Themes: `L` light · `D` dark.

---

## Mobile

| Screen | Route | Loading | Empty | Error | ar+L | ar+D | he+L | he+D | en+L | en+D | Notes |
|--------|-------|---------|-------|-------|------|------|------|------|------|------|-------|
| Purchasing hub | `/purchasing` | | | | | | | | | | Three hero tiles, merged orders tab |
| Order builder | `/purchasing/new` | | | | | | | | | | Per-line warehouse / fabric holding |
| Low stock review | `/purchasing/low-stock` | | | | | | | | | | WhatsApp preview per supplier |
| Order detail | `/purchasing/[id]` | | | | | | | | | | Approve → editable send, WhatsApp board |
| Legacy request detail | `/purchasing/requests/[id]` | | | | | | | | | | Read-only, no approve/send |
| Supplier list | `/purchasing/suppliers` | | | | | | | | | | |
| Supplier detail | `/purchasing/suppliers/[id]` | | | | | | | | | | Outstanding / paid never netted |
| Receive queue | `/inventory/receive` | | | | | | | | | | Entry from inventory Add item row |
| Receive goods | `/inventory/receive/[id]` | | | | | | | | | | Steppers + per-line destination |

### Desktop / admin-web

| Screen | Route | Loading | Empty | Error | ar | he | en | Notes |
|--------|-------|---------|-------|-------|----|----|----|-------|
| Purchasing hub | `/purchasing` | | | | | | | New order / Low stock / Suppliers |
| Order builder | `/purchasing/new` | | | | | | | Two-column layout |
| Low stock | `/purchasing/low-stock` | | | | | | | Preview then send-all |
| Order detail | `/purchasing/[id]` | | | | | | | WhatsApp modal + per-line receive |
| Suppliers | `/suppliers` | | | | | | | Details action |
| Supplier history | `/suppliers/[id]` | | | | | | | AP money + history tabs |
| Settings WhatsApp | `/settings` | | | | | | | Template + live preview |
| Inventory receive | `/inventory` materials | | | | | | | Receive orders queue modal |

### Cross-cutting

| Check | Mobile | Admin-web |
|-------|--------|-----------|
| 44px min touch / stepper wells | | |
| RTL row + rail flip | | |
| `dir="ltr"` on SKU, phone, money, order numbers | | |
| Mutation buttons disable while pending | | |
| No `DeskCard` / `SurfaceCard` / `colors.info` on mobile floor | P (source sweep) | n/a |
| NumberStepper + DateRangeField on web | n/a | P (packages/ui + purchasing pages) |

### Automated record (2026-09-07)

- Mobile: `purchasingFloorSweep`, `purchasingStates` (light + dark Arabic), catalog parity, purchasing i18n keys in en/ar/he. Full `pnpm --filter @maher/mobile test`: 260 suites / 1716 tests.
- Admin-web: `purchase-order-payload` + `low-stock-review` helpers; typecheck and `next lint` clean; every new page ships `Skeleton` / `EmptyState` / `ErrorState`.
- API: `pnpm --filter @maher/api test` 222 + 17 PDF suites green. `pnpm typecheck` 29/29. `pnpm check:boundaries` passed.
- Live API: `pnpm smoke:purchasing-overhaul-uat` 17/17 (create → WhatsApp edit → multi-warehouse receive → low-stock batch → dealer deny). `pnpm smoke:piece6-purchasing-receiving-uat` 22/22. `pnpm smoke:workflow` 32/32. `pnpm smoke:dev-component-lab` 9/9.
- Screenshots: names listed in [`docs/mobile-screenshots/purchasing/README.md`](./mobile-screenshots/purchasing/README.md); files land when a device session runs. Device and live browser cells remain blocked.
