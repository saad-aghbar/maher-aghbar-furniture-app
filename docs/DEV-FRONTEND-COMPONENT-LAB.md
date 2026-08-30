# Dev Frontend Component Lab

**Date:** 2026-08-29  
**Scope:** Mobile Expo only (`apps/mobile`)  
**Gate:** `__DEV__` — production builds hide the entry and `/dev/*` redirects home.

## How to open

1. Run a **development** mobile build (`pnpm mobile:start`).
2. Sign in (e.g. `admin` / `123`).
3. Open **More** (admin), **Account** (dealer), or **Profile** (worker).
4. Above **Sign out**, tap **Dev tests**.

### Routes

| Route | Purpose |
|-------|---------|
| `/dev/tests` | **Showroom** (default) — visual gallery of real components |
| `/dev/tests/coverage` | Coverage / Registry — audit stats, search-by-file, work queue |
| `/dev/tests/<stable-id>` | Optional inspector deep-link from Coverage |

## Showroom (default)

- Search filters by component name, tags, source, and parent `contains` aliases.
- Role chips: All | Admin | Dealer | Worker (Shared always visible).
- Category rail jumps to Foundations, Buttons, Cards, Forms, Status, Headers, Sheets, Orders, Production, Worker, Inventory, Purchasing, Finance, Dealer, Management, Notifications, Full Screens, etc.
- Each row: small name + ⓘ + **inline real component** (or Open sheet / Open preview).
- Compact / horizontal layout for badges and icon buttons; **full-width** for order/production/inventory cards.
- ⓘ opens metadata BottomSheet (list stays mounted — scroll preserved).
- Sheets open as overlays; full screens navigate to existing `/dev/*` galleries and restore scroll on return.
- Coverage / Registry is a subtle secondary link — not the main UX.
- **Zero empty preview placeholders** in the showroom catalog.

## Coverage / Registry (secondary)

Audit stats, review filters, technical file registry. Use for H1 inventory work — not for day-to-day visual comparison.

## Aesthetic work queue (local only)

Needs work · Review later · Approved + optional note (from ⓘ or Coverage).  
Stored in AsyncStorage — never sent to the API.

## Cursor prompt example

> Update `NotificationBoardCard`.  
> Dev Tests → search `NotificationBoardCard`.  
> Keep behavior unchanged; improve visual hierarchy…

## Coverage audit

```bash
pnpm dev:component-lab:audit
pnpm smoke:dev-component-lab
```

H1: every visual `.tsx` under `app/`, `src/components/`, `src/features/`, `src/motion/` has exactly one file classification. **UNCLASSIFIED must be 0.**

## Architecture

Code lives under `apps/mobile/src/dev/component-lab/` — fixtures never imported by production routes.

- `showroom/` — catalog, scroll memory, types  
- `sections/showroomShared.tsx` / `showroomFeatures.tsx` — fixture demos  
- `screens/DevTestsShowroomScreen.tsx` — default UX  
- `screens/DevTestsCoverageScreen.tsx` — secondary audit UX  
