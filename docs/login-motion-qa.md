# Login motion QA (legacy notes)

Primary brand intro QA now lives in [`docs/mobile-brand-intro-visual-qa.md`](mobile-brand-intro-visual-qa.md).

Cold launch plays the programmatic **bottom line → rising stroke → SVG logo draw → settle → form reveal** sequence (`useBrandIntroState` + `components/branding/*`).

## Theme + language

- `LoginThemeSwitcher` — circular sun↔moon; `setMode` recolors via `getLoginColors` + `brandColors.primary`.
- `LoginLanguageSwitcher` — frosted glass pill with sliding bubble; AR/EN/HE.
- Chrome pins **language left / theme right** in every locale.

## Reduced motion

Skip rising line and path draw; short fade to filled logo + form.

## Auth

Unchanged `AuthProvider.login`. SplashGate holds on `bootstrapping` so restored sessions never flash Login. Logout requests short intro via `requestShortBrandIntro()`.

## Tests

| Command | Expected |
|---------|----------|
| `pnpm mobile:typecheck` | Pass |
| `pnpm --filter @maher/mobile test` | Pass |
