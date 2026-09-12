# Phase 5 — ProductVariant model, resolver, default backfill

**Date:** 2026-09-12

Every catalog product now has a first-class `ProductVariant`. The default row (`${sku}-STD`) holds today's dims, price, and BOM so `variantId = null` stays byte-identical to current behavior.

## Data

- `ProductVariant` — identity, commercials, measurements-with-units, composition, `orientation` (`NONE | LEFT | RIGHT`), `includedItems`, Arabic-first factory notes, optional `workflowId`.
- `ProductVariantOption` join to `SpecOptionValue` (reportable, not a JSON bag).
- Nullable `variantId` on `DealerPrice` and the six product config tables. Existing `@@unique` keys gained `variantId`.

## Resolver

`packages/types/src/product-variant.ts`

- `resolveEffectiveVariant({ product, variant })` — variant overrides win; missing fields fall through; `null` variant equals the auto default.
- `resolveVariantStageConfig` — variant-scoped stage rows with product fallback.
- `renderVariantSpecLine(variant, locale)` — dense floor spec (كرينا / أوكرانيه).
- `compositionToPiecePlan` — `2+1+بف` → `expectedPieceCount` 3 with piece labels.
- `persistMeasurementsRoundTrip` — `1.15 m` and `85 cm` survive as entered.

## Backfill

`packages/database/prisma/seed/backfill-default-variants.ts` (idempotent) plus `prisma/scripts/backfill-default-variants.ts`. Seed catalog and demo catalog call it after products exist.

## Tests

Resolver override/fallback, unit round-trip, spec-line snapshot in en/ar/he, composition piece plan, backfill skip-if-default-exists.
