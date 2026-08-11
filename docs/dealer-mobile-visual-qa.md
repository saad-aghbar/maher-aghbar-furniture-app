# Dealer Mobile Visual QA

**Date:** 2026-08-09  
**Scope:** Customer/Dealer Expo surface only  
**Themes:** Light (parchment) + Dark (liquorice)  
**Locales:** EN (LTR), AR (RTL), HE (RTL)

## Matrix (every major screen)

For each screen below, verify:

| Check | Login | Home | Catalog | PDP | New Order ×4 | Orders | Order detail | Progress | Invoices | Statement | Returns | Notifs | Account |
|-------|:-----:|:----:|:-------:|:---:|:------------:|:------:|:------------:|:--------:|:--------:|:---------:|:-------:|:------:|:-------:|
| Light | ✅ code | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dark | ✅ code | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| EN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AR RTL | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| HE RTL | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Loading skeleton | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Empty | — | ✅ | ✅ | — | — | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | — |
| Error + retry | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Offline banner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Long names | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | — | ✅ |
| Missing image | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | — | — | — | ✅ | — | — |
| Large amounts | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | — | ✅ | ✅ | — | — | — |
| FAB / tab clearance | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Legend:** ✅ = implemented in code with dealer tokens / OfflineBanner / DealerEmptyState / skeletons / RTL helpers. Device capture still recommended before release (see Screenshots).

## Screens

1. **Login** — shared commerce tagline; username/password; locale + theme; offline/error paths (`LoginScreenContent`).
2. **Home** — `DealerHero` 2.5D, carousels, balance, tappable invoices, featured models (`DealerHomeScreen`).
3. **Catalog** — media-first 2-col `DealerProductCard`, debounced search, chips (`CatalogScreen` `variant="dealer"`).
4. **Product detail** — gallery/zoom, sticky Create Order, related rail; dealerPrice only.
5. **New Order** — 4 steps: Product → Order details → Customer & delivery → Attachments & review.
6. **Orders list** — `DealerOrdersHome` + `DealerOrderCard`.
7. **Order detail** — dealer-safe fields; invoice/returns links on customer routes.
8. **Production flow** — `DealerProgressMap` (`role="dealer"`).
9. **Invoices** — `DealerInvoiceCard` boards; no admin-only actions without permission.
10. **Statement** — `DealerStatementScreen` banking layout + payment methods.
11. **Returns** — create/list/detail with photo + Pending/Approved/Rejected.
12. **Notifications** — day grouping, unread accent, customer `linkHref` paths.
13. **Account hub** — identity, locale, theme, finance links, security, logout.

## Microdetail / a11y pass (Phase 8)

| Item | Status |
|------|--------|
| Min touch ~44pt on FAB, search clear, account rows, filter options | ✅ |
| VoiceOver labels on FAB (`mobile.tabs.newOrder`), cards, search | ✅ |
| Contrast via semantic brand/success/warning/error (no traffic red) | ✅ |
| Reduced motion: hero parallax amp 0, progress timing skip | ✅ |
| Status not color-only (badge label text) | ✅ |
| No raw API error strings on dealer home/catalog (human copy + retry) | ✅ |

## Screenshots

Store under `docs/mobile-screenshots/dealer-*`.

| Asset | Status |
|-------|--------|
| Existing `docs/mobile-screenshots/dealer-home/` samples | Reference |
| Full matrix device captures (iOS/Android × themes × locales) | **Pending device lab** — code QA matrix above is green; capture before App Store / Play release |

## Pass criteria

- [x] No admin/worker chrome on dealer routes
- [x] No manufacturing cost / worker names on dealer mappers (unit leak guards)
- [x] FAB reachable; tabs floating with icons; New Order not equal-width tab
- [x] New Order ≤ 4 steps
- [x] Dealer-related unit/integration suites green (57+ targeted)
- [x] No dealer-scoped TypeScript errors
- [ ] Full device screenshot pack (lab)

## Status

| Phase | Status |
|-------|--------|
| Docs baseline | Complete |
| Implementation (phases 1–7) | Complete |
| Microdetail / a11y / states | Complete (code) |
| Final device capture | Pending lab |
| DoD report | See `docs/dealer-mobile-completion-report.md` |
