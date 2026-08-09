# Admin Home screenshots

Visual QA for Administrator Home (`/(app)/(admin)/(tabs)/index`), aligned to design-board **Screen 03**.

## Capture method

1. Unit + API tests cover selectors and `GET /reports/admin-home`.
2. Forced UI states: open Expo route **`/dev/admin-home`**, toggle state chips and EN/AR.
3. Reference mockups below (design-faithful EN/AR frames for docs). Re-capture from a booted simulator with `xcrun simctl io booted screenshot` when validating on device.

## Layout (Screen 03)

Greeting → primary 2×2 KPIs → secondary low-stock / pending payments → Recent orders → optional urgent alert + tasks below the fold. No fake trend percentages or charts.

## Files

| File | Locale | State |
|------|--------|-------|
| `en-success.png` | EN | Success — 2×2 KPIs + recent orders |
| `ar-success.png` | AR | Success RTL |
| `en-loading.png` | EN | Skeleton |
| `ar-loading.png` | AR | Skeleton RTL |
| `en-error.png` | EN | Error + retry |
| `ar-error.png` | AR | Error RTL |
| `en-empty.png` | EN | All clear empty |
| `ar-empty.png` | AR | Empty RTL |
| `en-offline.png` | EN | Offline banner + cached content |
| `ar-offline.png` | AR | Offline RTL |
