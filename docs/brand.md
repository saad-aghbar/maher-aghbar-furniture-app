# Brand — Maher Al-Aghbar Furniture

Source: brand guidelines PDF (updated establishment year **EST. 1995**; document dated 2026). Implementation lives in `@maher/ui` (`packages/ui`).

## Color tokens

Mapped onto `--maher-*` in [`packages/ui/src/tokens.css`](../packages/ui/src/tokens.css).

### Light

| Token | Hex | Guideline |
|-------|-----|-----------|
| `--maher-brand` | `#776245` | Army Camo |
| `--maher-brand-hover` | `#635239` | darkened Army Camo |
| `--maher-brand-active` | `#372612` | Tumbleweed |
| `--maher-accent` | `#372612` | Tumbleweed |
| `--maher-background` | `#E1DFD3` | Apple White |
| `--maher-surface` | `#ffffff` | White |
| `--maher-surface-muted` | `#ededed` | Christmas White |
| `--maher-text-primary` | `#1e1a1b` | Liquorice |
| `--maher-border` | `#cacbcc` | Muted Silver |

### Dark

Liquorice base (`#1e1a1b`), Apple White text (`#E1DFD3`), lifted Army Camo brand (`#a8906c`). Full map is in `tokens.css` under `:root[data-theme='dark']`.

Semantic success / warning / error / info are unchanged (brand is no longer red, so error stays distinct).

## Logo assets

Extracted from the guidelines PDF into [`packages/ui/assets/brand/`](../packages/ui/assets/brand/):

| File | Use |
|------|-----|
| `logomark-on-light.png` | Compact mark: sofa “M” + **EST. 1995** on light surfaces |
| `logomark-on-dark.png` | Same mark on Liquorice / dark UI |
| `lockup-on-light.png` | Primary logo (auth / hero) — wordmark + **EST. 1995** |
| `lockup-on-dark.png` | Primary logo on dark |

Do **not** use older extractions that showed **EST. 2026** — that year was incorrect; establishment is **1995**.

Inlined as data URIs via `node scripts/encode-brand-logo.mjs` → `packages/ui/src/brand-logo-data.ts`.

`BrandMark` supports `variant="mark" | "lockup"`, sizes `sm`–`xl`, and swaps light/dark artwork from `html[data-theme]`.

## Typography

| Script | Brand target | Shipped | Notes |
|--------|--------------|---------|-------|
| Latin | **Gendy** | Outfit (web) / system (mobile) | Drop WOFF2 in `packages/ui/fonts/gendy/` |
| Arabic | **KO Sans** | KO Sans OTF | Mobile + `packages/ui/fonts/ko-sans/`; web still interim Noto until local next/font |
| Hebrew | (unspecified) | Heebo (web) / system (mobile) | — |

See [`packages/ui/fonts/README.md`](../packages/ui/fonts/README.md). Incomplete CFF subsets from the PDF remain in `packages/ui/fonts/_extracted-from-pdf/` for reference only.

## Mobile

Mirror the same palette and logo assets under `apps/mobile/assets/` (`icon.png`, `splash-icon.png`, adaptive icons, `brand/lockup-*.png`). App icon uses the sofa “M” only (no year text) on Apple White (`#E1DFD3`).

