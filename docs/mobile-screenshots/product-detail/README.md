# Product detail screenshots

Visual QA for Dealer Product Details (`/(app)/(customer)/catalog/[id]`).

## Capture method

1. API scope tests: `catalog.browse-scope.spec.ts` (`browseProductById`)
2. Gallery: Expo route **`/dev/product-detail`**
3. Reference mockups below

## Files

| File | Locale | State |
|------|--------|-------|
| `en-success.png` | EN | Detail + sticky Add to Order |
| `ar-success.png` | AR | RTL detail |
| `en-loading.png` | EN | Skeleton |
| `en-error.png` | EN | Error |
| `en-no-image.png` | EN | Missing image state |
