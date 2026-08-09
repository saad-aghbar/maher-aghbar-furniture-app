# Brand fonts

## Target (licensed)

Drop licensed files here:

```
packages/ui/fonts/gendy/*.woff2   — Latin (Gendy)
packages/ui/fonts/ko-sans/*.otf   — Arabic (KO Sans)
```

## Arabic — KO Sans (shipped)

OTF files from the brand guidelines typeface (**KO Sans**, Boharat / [Kotype](https://ko-type.com/products/ko-sans-typeface)):

- `KOSans-Thin.otf`
- `KOSans-ExtraLight.otf`
- `KOSans-Light.otf`
- `KOSans-Regular.otf`
- `KOSans-Medium.otf`
- `KOSans-SemiBold.otf`
- `KOSans-Bold.otf`

Mobile loads Thin / Regular / Medium / SemiBold via `apps/mobile/assets/fonts/` and applies them whenever the locale is `ar`.

Confirm an app license with the foundry for production distribution if your deal requires it (their store is free / pay-what-you-want for desktop use; they ask to contact them for app licenses).

## Latin — interim

Until licensed Gendy WOFF2 is available:

- Latin: **Outfit** (Google Fonts) on web
- Mobile Latin / Hebrew: system UI font

## PDF subsets

`_extracted-from-pdf/` holds incomplete CFF subsets from the brand PDF — reference only, not for production.
