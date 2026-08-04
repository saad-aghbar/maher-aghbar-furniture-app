# Mobile launch QA

Persona scripts, device matrix, and phase gates for the unified Expo app (`apps/mobile`).

Demo password (local only): **`Admin@12345!`**

## Persona scripts

### Admin (`admin`)

1. Sign in → home shows management / admin quick actions (reports, orders).
2. Open **More** → Customers, Products, Inventory, Settings (permission-gated).
3. Open a sales order → confirm if DRAFT; check related production / invoices / deliveries.
4. Notifications tab → mark one read; mark all read.
5. Switch language EN ↔ AR; confirm RTL layout on lists and detail screens.

### Cedar dealer (`cedar`)

1. Sign in → home promotes catalog / create order / statement / returns.
2. **Catalog** → browse products; **Create order** → submit RFQ with dealer fields if shown.
3. **Orders / Quotations / Sales orders** → open a record; verify dealer fields when present (`externalOrderNumber`, end customer, delivery address, notes).
4. **Statement** and **Invoices** → amounts readable with Latin digits.
5. Profile → customer name / contact; language switch EN ↔ AR.

### Worker (`worker`)

1. Sign in → home promotes **Tasks** (and production if permitted).
2. Open an assigned task → start / note / photo / complete flow as available.
3. Production list (if visible) → open `PO-DEMO-001` stage context.
4. Notifications → unread badge / mark read.
5. Confirm compact layout on a small phone; AR RTL on task detail.

## Device matrix

| Device | EN (LTR) | AR (RTL) |
|--------|----------|----------|
| iPhone SE (compact, width &lt; 375) | Login, home, list scroll, footer actions | Same; text alignment / chevrons mirror |
| Standard iPhone (e.g. 14/15) | Full persona smoke | Full persona smoke |
| Large Android (e.g. Pixel / Galaxy) | Full persona smoke; edge-to-edge safe areas | Full persona smoke; RTL + safe areas |

Check: content gutters (12 compact / 16 standard), footer above home indicator, font scaling capped (~1.3×), lists not clipped under notch/status bar.

## Phase gates (P0–P5)

- [x] **P0** — Design system + motion (PageHero, PressableScale, GlassHeader, BrandMark)
- [x] **P1** — Dealer portal: catalog, create order, statement, returns, profile, order detail fields
- [x] **P2** — Ops gaps: orders hub, PR detail, supplier invoices, inventory movements, CRM tabs, POD, admin return resolve
- [x] **P3** — Admin masters: products, warehouses, suppliers, employees, settings, documents, audit, roles, contracts, payments, departments, production-stages
- [x] **P4** — Device harden (`useLayout`, safe areas, FlatList perf, fontScale cap, RTL)
- [x] **P5** — EAS scaffolding (`eas.json`, notifications plugin, `DevicePushToken` API); replace `eas.projectId` before `eas build`

Manual device matrix (SE / large Android × EN / AR) still required before store submit.

## Visual polish checklist (web parity)

- [x] Login: dark espresso hero, animated BrandMark, IBM Plex / Arabic / Heebo fonts
- [x] Home: dark hero RTL identity row; bento metrics; quick-action tiles
- [x] Workspace: slim groups matching admin-web sidebar (masters under More → tools)
- [x] ProgressBar: integer % only (fixes iOS invoices crash)
- [x] Lists: soft wash + PageHero on invoices/tasks
- [ ] AR RTL smoke on login + home + Workspace + Invoices
- [ ] Reload Expo Go after UI changes (`pnpm mobile:start` — one Metro port only)

## Commands

```bash
# Typecheck
pnpm --filter @maher/mobile typecheck

# Unit tests
pnpm --filter @maher/mobile test

# Expo health
cd apps/mobile && npx expo-doctor

# Internal preview build (replace EAS projectId first)
cd apps/mobile && eas build --profile preview
```

Also see [launch-checklist.md](./launch-checklist.md) for one-command launch and demo accounts.
