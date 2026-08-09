# Worker Home screenshots

Visual QA for Worker (employee) Home (`/(app)/(employee)/(tabs)/index`).

## Capture method

1. Unit + API tests cover selectors and `GET /reports/worker-home` (Worker A/B ownership).
2. Forced UI states: open Expo route **`/dev/worker-home`**, toggle state chips and EN/AR.
3. Reference mockups below. Re-capture from a booted simulator with `xcrun simctl io booted screenshot` when validating on device.

## Layout

Greeting → completed today → urgent task → today’s tasks (Open Task) → notifications preview. No progress %, finance, or other workers.

## Files

| File | Locale | State |
|------|--------|-------|
| `en-success.png` | EN | Success |
| `ar-success.png` | AR | Success RTL |
| `en-loading.png` | EN | Skeleton |
| `ar-loading.png` | AR | Skeleton RTL |
| `en-error.png` | EN | Error + retry |
| `ar-error.png` | AR | Error RTL |
| `en-empty.png` | EN | Empty |
| `ar-empty.png` | AR | Empty RTL |
| `en-offline.png` | EN | Offline + cached |
| `ar-offline.png` | AR | Offline RTL |
