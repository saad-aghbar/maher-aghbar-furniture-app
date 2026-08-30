# PIECE 4 — CUSTOM / MODIFIED MANUFACTURING SPECIFICATION CLOSURE

> Status: **CODE COMPLETE** — Handset **PENDING HANDSET**. **STOP** — do not start Piece 5.

## 0. Audit (WHAT EXISTED / WRONG / REUSED / MUST CHANGE)

### WHAT EXISTED

| Area | Behavior |
|---|---|
| Piece 2 models | `SalesOrderProductionSetup`, `SalesOrderLineSetup`, `SalesOrderLineMaterialRequirement` |
| Dims | Fixed W/H/D/seatHeight in `catalogDimensions` / `orderDimensions` JSON |
| Changes | Shallow `buildChanges` — MODIFIED-only dim + fabric (`from: null` for fabric) |
| Fabric | FABRIC material row + `requestedFabricLabel`; basic `fabric` block on GET |
| Cost | `buildMaterialCostMap`; missing → treated unavailable; no Estimated vs Actual labels |
| Attachments | `referenceDocumentIds` raw string[]; not resolved to Document metadata |
| Sticky docks | Opaque `JourneyStickyDock` on setup home/line |
| Release | Locks setup; PO + snapshot + tasks; scheduling skipped |

### WHAT WAS WRONG

- Flat form UX on line setup (not a manufacturing dossier)
- No extensible named measurements
- Weak catalog difference summary
- No estimated vs actual cost distinction
- Attachments not openable from setup
- STANDARD / MODIFIED / CUSTOM under-communicated in UI
- Opaque sticky trays vs Piece 3 floating CTAs

### WHAT IS REUSED

- Setup APIs, seed-from-catalog, release, material requirements
- `BomMaterialPickerSheet`, `BomFloorRow`, Desk / OrderBoard, `JourneyStickyDock floating`
- Cost map via `order-costing.util.ts`
- Permissions `production.setup.view|edit|release`
- Classification helpers in `@maher/types` manufacturing-complexity

### WHAT CHANGED (Piece 4)

- `SalesOrderLineSetup.measurements` JSON + `OrderMeasurement` / `buildCatalogDiff`
- `getSetup` enrich: `changesFromCatalog`, fabric stock/cost, `estimateIncomplete`, `actualCostSummary`, `attachments[]`
- Mobile home line cards + floating dock; line dossier (hero, changes, fabric, BomFloorRow materials, cost, attachments)
- Demo P4-A–H; tests; this closure

### Freeze confirmation

| System | Frozen |
|---|---|
| Piece 1 order lifecycle | YES |
| Piece 2 setup / release mechanics | YES (extend only) |
| Piece 3 worker assign / dates / start | YES |
| `@maher/workflow-domain` / workflow editor | YES |
| SEMI / FIN / material usage write path | YES (read rollup only) |
| QC / Packaging / Delivery / dealer receipt | YES |
| Scheduling hub | YES |
| Purchasing / invoice finalization | YES |

---

## A. Permissions mapping

| Capability | Permission |
|---|---|
| View setup | `production.setup.view` |
| Edit line / materials / measurements | `production.setup.edit` |
| Mark ready / release | `production.setup.release` |

**Who can edit manufacturing spec**
- `SYSTEM_ADMIN` / production management staff with setup perms
- `CUSTOMER` / dealers: **cannot** (`assertStaff` → Forbidden)
- `PRODUCTION_WORKER`: **cannot** edit setup (no setup.edit in worker pack)

---

## B. Schema / types

| Item | Location |
|---|---|
| `measurements Json?` | `SalesOrderLineSetup` in `packages/database/prisma/schema.prisma` |
| `OrderMeasurement`, `CatalogDiffRow`, `buildCatalogDiff`, `normalizeOrderMeasurements` | `packages/types/src/manufacturing-complexity.ts` |
| `customMeasurements` on `OrderLineSpecSnapshot` | same |
| Patch DTO: measurements, manufacturingComplexity, requestedFabricLabel | `order-production-setup.dto.ts` |

---

## C. Classification + catalog diff

| Complexity | Behavior |
|---|---|
| STANDARD | Product + no manufacturing-relevant delta; empty `changesFromCatalog` (unless measurement diffs) |
| MODIFIED | Dim / fabric / measurement deltas → human rows with `from` / `to` / `delta` |
| CUSTOM | No product or explicit CUSTOM; **no fake catalog compare**; optional `basedOnProduct` |

Catalog Product / BOM never mutated by setup edits or seed.

---

## D. Cost rules

| Rule | Behavior |
|---|---|
| Valuation | `buildMaterialCostMap` (standardCost + purchase txs) |
| Missing | `unitCost: null`, `costAvailable: false` — **never `0.00`** |
| Estimate incomplete | `estimateIncomplete` / `incomplete` when any row lacks cost |
| Estimated | Planned expectedQty × valuation × line qty |
| Actual | Finalized `ProductionTaskMaterialUsage` × valuation (read-only when POs exist) |

---

## E. Attachments

- Seed merges SO `documents` + `orderSpec.attachmentIds` into `referenceDocumentIds` (link, not duplicate binary)
- GET hydrates `{ id, fileName, mimeType, url: /uploads/documents/:id/link }`
- Mobile opens via `resolveDocumentUrl(id)`

---

## F. Seed / release paths

| Path | Behavior |
|---|---|
| STANDARD | “Use catalog specification” → `seedFromCatalog` |
| MODIFIED | Seed + highlight diffs; **no** auto material scale by dim % |
| CUSTOM | Manual materials; skip fake compare |
| Post-release | `requireEditableSetup` blocks edits; `postReleaseEditing.revisionSystem: false` documented |

---

## G. Mobile UX (ship gate)

| Screen | Route | Components | API |
|---|---|---|---|
| Setup home | `/(app)/(admin)/orders/[id]/production-setup` | `OrderProductionSetupHomeScreen`, `SetupLineCard`, floating `JourneyStickyDock` | `GET …/production-setup` |
| Line dossier | `…/production-setup/lines/[lineId]` | Hero, spec, changes, `SetupFabricSection`, `BomFloorRow`, cost, attachments | GET + PATCH + PUT materials + seed |
| Fabric pick | sheet | `BomMaterialPickerSheet` | PUT materials |
| Release | home sheet | `ReleaseReviewSheet` | `POST …/release` |

Admin-web: shared API only — no aesthetic redesign.

---

## H. Demo P4-A–H

| ID | Story | How to open |
|---|---|---|
| SO-P4-A | STANDARD — costs available | admin → Orders → Preparing → SO-P4-A → Production setup |
| SO-P4-B | MODIFIED dims (width +20) | … → SO-P4-B → line → Changes from catalog |
| SO-P4-C | MODIFIED fabric | … → fabric section ≠ catalog |
| SO-P4-D | CUSTOM + measurements | … → Custom chip · measurements |
| SO-P4-E | Cost unavailable | … → Cost unavailable / incomplete |
| SO-P4-F | Material shortage | … → shortage tone |
| SO-P4-G | Multi-line S+M+C | … → three line cards |
| SO-P4-H | RELEASED freeze | … → read-only; catalog width bumped after release |

Seed: `packages/database/prisma/demo/piece4-manufacturing-spec.ts` via `factory-world.ts` after Piece 3.

Accounts: `admin` / `123`; dealers `oasis` / `nile`.

---

## I. Automated tests

| Suite | Coverage |
|---|---|
| `packages/types/src/__tests__/catalog-diff.test.ts` | normalize + buildCatalogDiff |
| `order-production-setup.spec.ts` Piece 2 | dealer deny, seed, release, schedulingSkipped |
| `order-production-setup.spec.ts` Piece 4 | changesFromCatalog, incomplete cost, attachments, CUSTOM empty diffs, patch measurements |

Regression retained: Piece 1 lifecycle, Piece 2/3, terminal, inventory suites (unchanged by this piece).

---

## J. Route proof (manual)

```
LOGIN: admin / 123

TEST P4-A (STANDARD home):
  NAV → Orders → Preparing → SO-P4-A → Production setup
  ROUTE → /(app)/(admin)/orders/{id}/production-setup
  SCREEN → OrderProductionSetupHomeScreen
  COMPONENT → SetupLineCard + FactoryReadinessSummary + JourneyStickyDock floating
  API → GET /sales-orders/:id/production-setup
CHECK: Standard chip · estimated cost · floating Mark ready / Review & release

TEST P4-B (MODIFIED line):
  NAV → SO-P4-B → Production setup → Open setup
  ROUTE → …/production-setup/lines/{lineId}
  SCREEN → OrderProductionSetupLineScreen
  COMPONENT → Changes card + DimCompare + floating Save
  API → GET /sales-orders/:id/production-setup
CHECK: Modified badge · width catalog→order · catalog product unchanged

TEST P4-C (fabric):
  NAV → SO-P4-C → line → Fabric
  COMPONENT → SetupFabricSection + BomMaterialPickerSheet
  API → PUT …/lines/:lineId/materials
CHECK: requested ≠ catalog · Change fabric picker (search name/SKU/category)

TEST P4-D (CUSTOM):
  NAV → SO-P4-D → line
CHECK: Custom chip · no fake catalog compare · measurements · no Use catalog CTA

TEST P4-E (cost unavailable):
  NAV → SO-P4-E → Cost summary
CHECK: “Cost unavailable” / estimate incomplete — never 0.00

TEST P4-F (shortage):
  NAV → SO-P4-F → home + line
CHECK: shortage tone on card + readiness shortage count

TEST P4-G (multi-line):
  NAV → SO-P4-G
CHECK: Standard + Modified + Custom cards on one home

TEST P4-H (release lock):
  NAV → SO-P4-H → production-setup
  API → GET (postReleaseEditing.locked=true); PATCH blocked SETUP_LOCKED
CHECK: read-only · setup dims frozen · Product.width may differ after seed bump
```

---

## K. Aesthetic / sticky / i18n

- Floating sticky CTAs on setup home + line (`JourneyStickyDock floating`)
- EN / AR / HE keys under `mobile.productionSetup.*` including cost estimated/actual, changes, fabric available, openSetup
- L/E/E: existing EmptyState / ErrorState / loading captions; shortage + cost unavailable tones

---

## L. HANDSET / ADMIN BROWSER scores

| Surface | Score |
|---|---|
| Mobile handset P4-A–H | **PENDING HANDSET** |
| Admin browser aesthetic | N/A (API-only for Piece 4) |

---

## M. Master-list checkoff

| § | Item | Status |
|---|---|---|
| 1 | STANDARD/MODIFIED/CUSTOM lock | DONE |
| 2 | Order-specific dossier | DONE |
| 3 | Product difference summary | DONE |
| 4 | Fabric order-specific | DONE |
| 5 | Materials + inventory cost | DONE |
| 6 | Estimated ≠ actual | DONE |
| 7 | Design system match | DONE (Desk/OrderBoard/BomFloor) |
| 8 | Setup home redesign | DONE |
| 9 | Line dossier | DONE |
| 10 | Attachments RFQ→factory | DONE |
| 11–13 | STANDARD/MODIFIED/CUSTOM paths | DONE |
| 14–15 | Release snapshot / post-release lock | DONE |
| 16 | Material picker UX | DONE |
| 17–18 | Sticky / L/E/E | DONE |
| 19 | EN/AR/HE RTL | DONE (strings + RTL layouts) |
| 20 | Demo P4-A–H | DONE |
| 21 | Automated tests | DONE |
| 22 | Freeze | DONE |
| 23 | Aesthetic ship gate | CODE COMPLETE — PENDING HANDSET |
| 24–26 | Closure + where to test + STOP | DONE |

---

## N–V. Final

**CODE COMPLETE.** Distinguish from **HANDSET PENDING**.

**STOP — Piece 5 not started.**
