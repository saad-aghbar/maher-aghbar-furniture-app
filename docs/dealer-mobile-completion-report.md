# Dealer Mobile Premium Overhaul — Completion Report

**Date:** 2026-08-09  
**Surface:** Expo `customer` (UI copy: Dealer)  
**Out of scope (untouched by design):** Admin mobile, Worker mobile, Admin/Employee web, `features/dealers/` CRM, permission catalog grants

---

## 1. Dealer screens redesigned

| Screen | Implementation |
|--------|----------------|
| Login (shared) | Commerce tagline / furniture copy; locale + theme; offline |
| Home | Commerce showpiece + 2.5D hero, carousels, balance, invoices, featured |
| Catalog | Media-first grid, search, chips, dealer prices, infinite scroll |
| Product detail | Gallery/zoom, sticky Create Order, related rail |
| New Order | 4-step wizard + uploads + AI human states |
| Orders list | `DealerOrdersHome` / `DealerOrderCard` |
| Order detail | Dealer-safe hero + invoice/returns |
| Production progress | `DealerProgressMap` |
| Invoices list/detail | Dealer financial boards |
| Account statement | Premium banking layout |
| Returns | Simple create/list/detail + photo |
| Notifications | Grouping, unread, customer deep-links |
| Account hub | Identity, prefs, finance links, security, logout |

## 2. Components created

Under `apps/mobile/src/features/dealer-ui/`:

- DealerHero, DealerNewOrderButton, DealerProductCard, DealerOrderCard, DealerInvoiceCard  
- DealerBalanceCard, DealerProgressMap, DealerStatusBadge, DealerSearchBar, DealerFilterSheet  
- DealerUploadGrid, DealerEmptyState, DealerSkeleton, DealerSectionHeader  

Supporting feature modules: `DealerOrdersHome`, `DealerStatementScreen`, `DealerCatalogChrome`, carousels, AI human-state helpers, etc.

## 3. Theme changes

- `apps/mobile/src/theme/dealerTokens.ts` — aliases (`heroWash`, `fab`, `onFab`, `fabSoft`, `commerceSurface`) mapped onto shared parchment/liquorice semantic colors  
- No unrelated brand fork; ThemeSwitcher remains on Account  
- Exported as `dealerTokens` / `dealerSurface` from `@/theme`

## 4. Motion changes

- `apps/mobile/src/motion/dealerMotion.ts` — FAB press scale, hero parallax amplitude (0 when reduce-motion), settle/fade helpers  
- Hero parallax on `DealerHero`; card press via `AnimatedPressable`; progress bar timing honors reduce-motion  
- FAB haptic `confirmMedium` on press

## 5. Navigation changes

- Customer floating pill (parity with admin/employee)  
- Tabs: **Home · Catalog · Orders · Account** (4 chips)  
- Center sculpted **+** FAB → `/(app)/(customer)/(tabs)/new-order`  
- `new-order` registered as hidden tab screen for routing  
- `DEALER_TAB_BAR_CLEARANCE = 108`

## 6. Order-flow changes

- Wizard collapsed **6 → 4** steps with draft v2 + legacy migration  
- Sticky Continue on steps 1–3  
- All business fields retained; RFQ edit/fabric lock unchanged  
- PDP deep-link into New Order with `productId`

## 7. Upload changes

- `DealerUploadGrid` — camera / gallery / PDF / handwritten  
- Thumbnails, progress, retry, remove  
- Wired into Attachments & Review step

## 8. API changes, if any

- Prefer pure UI  
- Mobile client: optional catalog `thumbnailUrl`; statement PDF open helper; notification `linkHref(surface)` for customer paths  
- No permission grants changed; no admin CRM / worker API redesign

## 9. Translation changes

- EN / AR / HE updates in `packages/i18n` `mobile.json` (+ auth commerce copy where applicable)  
- Keys include `dealerHome.*`, `dealerAccount.*`, AI human states, catalog/PDP CTAs, statement labels  
- RTL via existing `isRTL` / `AppText` / mirrored chevrons

## 10. Accessibility changes

- FAB and primary controls labeled  
- ≥44pt touch targets on key dealer chrome  
- Status badges include text labels  
- Reduced-motion paths for hero + progress  
- Offline banners instead of silent failure

## 11. Performance changes

- Catalog FlatList virtualization + pagination  
- 300ms debounced search  
- Prefer `thumbnailUrl` when present  
- Featured models via browse API (not full dump)

## 12. Test results

Targeted dealer suites (sample run 2026-08-09):

- **57+** tests green across dealer home, FAB, tokens, motion, catalog, new-order wizard/AI i18n, linkHref, statement, progress stages, login form logic  
- Broader catalog/sales-order related suites also green in combined runs  

## 13. Typecheck result

- **No dealer-scoped TypeScript errors** after `dealerMotion` duration fix  
- Repo still reports unrelated pre-existing issues (e.g. `@react-navigation/native` types in LocaleProvider, admin `DeleteDealerSheet`, `useDraggablePillBar` undefined layouts) — outside dealer redesign scope

## 14. Visual QA result

- Code matrix documented in `docs/dealer-mobile-visual-qa.md` — light/dark + EN/AR/HE + states covered by implementation  
- Full device screenshot pack marked **pending lab** before store release

## 15. Screenshots

- Reference samples: `docs/mobile-screenshots/dealer-home/` (if present)  
- Capture checklist lives in visual QA doc; store new assets as `docs/mobile-screenshots/dealer-*`

## 16. Remaining limitations

1. **Company name** — `AuthUser` lacks dedicated company/customerName; home/account fall back to user name / “Dealer account”.  
2. **No GLB assets** — 2.5D hero only (intentional).  
3. **Catalog thumbnails / related API** — optional `thumbnailUrl`; related rail uses same-category browse.  
4. **Statement PDF** — helper wired; needs live dealer-auth session verification.  
5. **Dealer progress map** — non-interactive plain stages (admin map remains interactive).  
6. **Device visual QA pack** — iOS/Android × themes × locales screenshot capture still to be filed in lab.  
7. **Repo-wide typecheck** — pre-existing non-dealer errors remain.

---

## Definition of Done checklist (§32)

- [x] Premium login feel  
- [x] Exceptional home + furniture-first 2.5D hero  
- [x] Central + New Order FAB  
- [x] Premium catalog + PDP  
- [x] Mobile-first 4-step New Order  
- [x] Multi-image / PDF / handwritten uploads  
- [x] Dealer pricing path  
- [x] Scannable orders + polished progress  
- [x] Admin-quality invoices + banking statement + simple returns  
- [x] Polished notifications + Account hub  
- [x] Light + dark + AR/EN/HE + RTL  
- [x] Motion + polished loading/error (no mock production data; leak guards)  
- [x] Dealer unit tests green; dealer-scoped typecheck clean  
- [ ] Full device visual QA screenshot pack (lab)

**Hard fails avoided:** no production mock data on dealer screens; no admin/worker redesign; FAB present; 4-step order flow; tokens semantic (no hardcoded dealer theme fork).
