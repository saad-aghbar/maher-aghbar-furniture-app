# Mobile localization

**Date:** 2026-08-05  
**Code:** [`apps/mobile/src/i18n/`](../apps/mobile/src/i18n)  
**Shared catalogs:** [`packages/i18n`](../packages/i18n)  
**RTL QA:** [mobile-rtl-checklist.md](./mobile-rtl-checklist.md)

## Overview

Expo app supports **Arabic (RTL)**, **English (LTR)**, and **Hebrew (RTL)** via a thin adapter over `@maher/i18n` — no i18next.

| Concern | Implementation |
|---------|----------------|
| Messages | `getMessages(locale)` from `@maher/i18n` |
| Default | `ar` |
| Persist | SecureStore `maher.locale` |
| Direction | `getDirection` + `I18nManager` + in-app `textAlign` / `writingDirection` |
| Format | `Intl` date / number / JOD currency (`ar-JO`, `en-JO`, `he-IL`) |
| UI text | `AppText` + `t('namespace.key')` |

## Usage

```tsx
import { useLocale } from '@/i18n';
import { AppText } from '@/components/AppText';

function Example() {
  const { t, locale, setLocale, formatCurrency, isRTL } = useLocale();
  return (
    <>
      <AppText variant="body">{t('mobile.scaffoldDemoTitle')}</AppText>
      <AppText variant="caption">{formatCurrency(1250.75)}</AppText>
    </>
  );
}
```

`t('mobile.languageName.ar')` walks nested JSON. Interpolation: `t('mobile.relativeDueIn', { n: 2, unit: 'days' })`.

## Reuse vs mobile-only keys

**Reuse** shared namespaces (`common`, `auth`, `mobile`, `statuses`, `errors`, …).

**Add to** `packages/i18n/src/messages/{ar,en,he}/mobile.json` only when the string is mobile-specific (scaffold demo, language names, etc.). Rebuild `@maher/i18n` after editing JSON (`pnpm --filter @maher/i18n build`).

## Runtime switching

1. `setLocale('en' | 'ar' | 'he')` updates React context immediately.
2. SecureStore persists selection.
3. `I18nManager.forceRTL` runs when direction changes.
4. **Note:** Native root layout (e.g. some absolute positions) may need **one app reload** after the first RTL↔LTR switch. Copy, alignment, and flex row direction update without reload.

`getActiveLocale()` is available for the future API client `Accept-Language` header.

## Typography + language

Hierarchy lives in the design system ([mobile-design-system.md](./mobile-design-system.md)). Prefer `AppText` so alignment follows `isRTL`. Mixed Arabic–English strings rely on Unicode bidi; keep Latin codes (order numbers) adjacent to localized labels as in `mobile.mixedSample`.

## Demo

Boot screen (`app/index.tsx`) is a three-locale lab: language chips, typography samples, date/number/currency, mirrored back control, theme toggle.

## Tests

```bash
pnpm mobile:test
```

Covers `translate`, `format`, and `rtl` helpers.
