# Dealer Home screenshots

Visual QA for Dealer (customer) Home (`/(app)/(customer)/(tabs)/index`).

## Capture method

1. Unit + API tests cover selectors and `GET /reports/dealer-home` (ownership / no leak).
2. Forced UI states: open Expo route **`/dev/dealer-home`**, toggle state chips and EN/AR.
3. Reference mockups below (design-faithful EN/AR frames for docs). Re-capture from a booted simulator with `xcrun simctl io booted screenshot` when validating on device.

## Files

| File | Locale | State |
|------|--------|-------|
| `en-success.png` | EN | Success — balance hero, metrics, orders, invoices |
| `ar-success.png` | AR | Success RTL |
| `en-loading.png` | EN | Skeleton |
| `ar-loading.png` | AR | Skeleton RTL |
| `en-error.png` | EN | Error + retry |
| `ar-error.png` | AR | Error RTL |
| `en-empty.png` | EN | Empty + New Order CTA |
| `ar-empty.png` | AR | Empty RTL |
| `en-offline.png` | EN | Offline banner + cached content |
| `ar-offline.png` | AR | Offline RTL |
