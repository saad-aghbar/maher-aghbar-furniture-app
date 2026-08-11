# Dealer Mobile Redesign Plan

Implements the 8-phase premium overhaul. Routes stay `customer`; UI says Dealer.

## Phases

1. **Docs + tokens + motion + floating bar + FAB + component scaffold**
2. **Login polish + Home showpiece (2.5D hero) + FAB live**
3. **Catalog grid + PDP**
4. **4-step New Order + uploads + AI human states**
5. **Orders list/detail + progress map**
6. **Invoices + statement + returns**
7. **Notifications deep-links + Account hub + i18n/RTL**
8. **Microdetail, a11y, perf, visual QA, DoD report**

## Navigation target

```
Home   Catalog   [+]   Orders   Account
```

- Floating pill for customer (same quality as admin).
- Center sculpted `+` opens `/(app)/(customer)/(tabs)/new-order`.
- Tab config drops `new-order` as equal-width tab (route kept).

## Theme

- Shared parchment / liquorice tokens.
- Optional dealer aliases mapped to existing colors (`dealerHeroWash`, `dealerFab`).
- Light + dark on every screen; no hardcoded hex in feature UI.

## New Order steps (max 4)

1. Product (catalog / manual, qty, optional ref image)
2. Order details (external #, fabric, notes)
3. Customer & delivery (name, phone, address, map)
4. Attachments & review (images, handwritten, PDF, submit)

## Hero

No GLB in repo → **2.5D only**: cutout furniture, depth layers, parallax, soft light. Respect reduced motion.

## Tiny API (only if required)

- Customer notification deep-links (mobile routing).
- Optional statement PDF helper.
- Prefer pure UI for end-customer display if API already has data on request embed.

## Guardrails

- Do not redesign Admin/Worker.
- Do not change permission grants.
- Do not edit `features/dealers/` (admin CRM).
- No mock data on production screens.
- No cost/worker leaks.
