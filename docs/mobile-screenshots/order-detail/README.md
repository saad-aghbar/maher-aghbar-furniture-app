# Order detail screenshots

Visual QA for Admin + Dealer Order Detail (`/(app)/(admin|customer)/orders/[id]`).

## Capture method

1. API ownership/leak tests: `sales-orders.detail-scope.spec.ts`
2. Gallery: Expo route **`/dev/order-detail`** (toggle admin/dealer + states + EN/AR)
3. Reference mockups below

## Files

| File | Locale | State |
|------|--------|-------|
| `en-admin-success.png` | EN | Admin — costs, stages, worker |
| `en-dealer-success.png` | EN | Dealer — selling price, no stages/costs |
| `ar-admin-success.png` | AR | Admin RTL |
| `en-loading.png` | EN | Skeleton |
| `en-error.png` | EN | Error / forbidden |
