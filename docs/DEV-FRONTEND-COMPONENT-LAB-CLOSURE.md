# DEV FRONTEND COMPONENT LAB — CLOSURE

> Status: **SHOWROOM CODE COMPLETE** (HANDSET **PENDING DEVICE**)  
> Piece 15 was **NOT** started. Business logic unchanged.

## Audit (H1)

| Metric | Count |
|--------|------:|
| TOTAL VISUAL FILES AUDITED | 634 |
| TOTAL VISUAL EXPORTS/CANDIDATES | 724 |
| REGISTERED | 74 |
| REPRESENTED BY PARENT | 378 |
| SCREEN-LINK | 176 |
| EXCLUDED NON-VISUAL | 6 |
| UNCLASSIFIED | **0** |

Source: `pnpm dev:component-lab:audit` → [`dev-component-lab-audit-report.md`](./dev-component-lab-audit-report.md)

## Architecture (Showroom-first)

| Route | Screen |
|-------|--------|
| `/dev/tests` | **Showroom** — `DevTestsShowroomScreen` (default visual gallery) |
| `/dev/tests/coverage` | **Coverage / Registry** — audit stats + technical list |
| `/dev/tests/<id>` | Inspector deep-link (from Coverage) |

- Lab: `src/dev/component-lab/` (showroom catalog, fixtures, registry, harness, work-queue)
- Entry: `DevTestsEntryRow` above Sign out (`__DEV__` only)
- Existing `/dev/*` galleries under Full Screens → Open preview
- Scroll memory: module store + overlays keep list mounted; Coverage / full-screen restore via `useFocusEffect`

## Hard requirements

| ID | Requirement | Status |
|----|-------------|--------|
| H1 | Source-file audit UNCLASSIFIED=0 | PASS |
| H4 | Density (compact where natural; full-width cards) + scroll preserve | PASS (code) |
| Showroom | Zero empty preview placeholders in catalog | PASS |
| Coverage secondary | Audit hub not default UX | PASS |

## Tests / smoke

- Jest: `src/dev/component-lab/registry/__tests__/registry.test.ts`
- `pnpm smoke:dev-component-lab` — 10/10 PASS

## Handset checklist

- [ ] Button directly above Sign out
- [ ] Dev Tests opens **Showroom** (not metadata list)
- [ ] Search `ProductThumb` / `FloatingActionDock` / `NotificationBoardCard` / `AdminOrderCard` → see real UI
- [ ] Buttons / Orders / Production / Worker / Inventory / Sheets sections with inline previews
- [ ] ⓘ info sheet; Open sheet; Open full screen; Coverage — **scroll position restored**
- [ ] Compact badges/chips; full-width order cards
- [ ] RTL AR/HE via app locale
- [ ] Theme via app theme switcher

**HANDSET:** PENDING DEVICE

## Known limitations

- Showroom catalog is a curated visual set — not every of ~600 files mounts inline; parent `contains` / represented aliases keep names searchable.
- Theme/locale preview uses the live app settings.
- Web portals out of scope.

## How I test it

More → Dev tests → scroll Showroom → search component → ⓘ / Open sheet / Coverage → return (scroll preserved).
