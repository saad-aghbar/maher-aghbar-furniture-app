# Orders list screenshots

Visual QA for Admin + Dealer Orders (`/(app)/(admin|customer)/(tabs)/orders`).

## Capture method

1. API ownership/leak tests: `sales-orders.list-scope.spec.ts`
2. Gallery: Expo route **`/dev/orders`** (toggle admin/dealer + states + EN/AR)
3. Reference mockups below

## Files

| File | Locale | State |
|------|--------|-------|
| `en-admin-success.png` | EN | Admin list with cost/profit |
| `en-dealer-success.png` | EN | Dealer list without costs |
| `ar-admin-success.png` | AR | Admin RTL |
| `en-loading.png` | EN | Skeleton |
| `en-empty.png` | EN | Empty |
| `en-error.png` | EN | Error |
