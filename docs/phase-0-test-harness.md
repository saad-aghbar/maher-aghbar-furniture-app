# Phase 0 — Test harness foundation

**Date:** 2026-09-12

Nothing product-facing. This is the machinery that makes “every button works, no broken popups” enforceable.

## What landed

| Gate | Where |
|------|--------|
| Sheet geometry harness | `apps/mobile/src/test/sheetHarness.tsx` — real `BottomSheet` inside `SafeAreaProvider` with fixed iPhone-14 metrics |
| Height helper | `resolveSheetHeightCap` on `BottomSheet` — default ~70% window, keyboard shrinks the cap |
| All-sheets sweep | `apps/mobile/src/test/__tests__/allSheetsSweep.test.ts` — every `*Sheet.tsx` must host with a height constraint and a footer action |
| Screen interaction harness | `apps/mobile/src/test/screenHarness.tsx` — `renderScreen()` + `expectEveryActionWired()` |
| Accessibility-label sweep | `apps/mobile/src/test/accessibilitySweep.ts` — scoped via `harnessScopes.ts` (starts at `src/components/sheets`; later phases append their dirs) |
| Maestro | `e2e/mobile/*.yaml`, `.maestro/config.yaml`, `pnpm mobile:e2e` |
| Playwright | `e2e/helpers.ts`, `e2e/cost-performance.spec.ts`, per-locale screenshot helper, login retry (first-compile 500) |
| CI | `pnpm lint`, `pnpm dev:component-lab:audit`, Playwright job with screenshot artifacts |

## How later phases use it

1. Add an RNTL test that `renderScreen()`s the new screen and calls `expectEveryActionWired`.
2. Geometry-test any new `*Sheet` with `renderSheet` + `assertSheetHeightContract`.
3. Append the feature directory to `ACCESSIBILITY_SWEEP_DIRS`.
4. Register the screen in the component lab; `pnpm dev:component-lab:audit` must stay 0.
5. Add a Maestro flow under `e2e/mobile/` for the happy path + one failure path.
6. If admin-web changed, add a Playwright spec and `screenshotLocales`.

## Manual pass

Harness unit tests are the gate for this phase (no product UI). Maestro/Playwright against a live stack need `/run` and a simulator; they are documented, not blocking CI.
