# PIECE 13 — Mobile Visual Baseline

> **Status:** Extracted from live reference screens (code). **No new brand.**  
> **References:** Products · Purchasing · Invoices · Inventory · Management Home  
> **Related:** [PIECE13-MOBILE-UX-UI-AUDIT.md](./PIECE13-MOBILE-UX-UI-AUDIT.md) · [PIECE13-MOBILE-VISUAL-ACCEPTANCE.md](./PIECE13-MOBILE-VISUAL-ACCEPTANCE.md)

---

## 0. Non-negotiables

| Rule | Meaning |
|------|---------|
| **Warm parchment** | Canvas is never pure white; cards lift as warm paper |
| **Layered depth** | Important objects have containment: surface + border + soft shadow + optional brand edge |
| **NO new brand** | Army Camo / coffee semantics already in `apps/mobile/src/theme/` |
| **NO flat primary objects** | Plain text on beige with thin border only is a fail for primary entities |
| **Align docs to screens** | Older “borders over shadows / Apple White” notes are secondary to this baseline |
| **Prefer reuse** | Consolidate good patterns; do not invent 40 near-duplicate cards |

---

## 1. Reference surfaces (source of truth)

| Area | Screen / component | Why it is baseline |
|------|--------------------|--------------------|
| **Products** | `CatalogScreen` · `ProductCard` · `orderBoardShadow()` | Media-first store card; radius.xl; parchment surface; soft board shadow |
| **Purchasing** | `PurchasingHubScreen` · `PurchasingFloorBoard` · PO/PR/SI board cards | Floor board + 3px brand accent strip + titled header band |
| **Invoices** | `InvoicesListScreen` · `InvoiceBoardCard` · `InvoiceStickyActions` | Money board cards + floating action pill dock |
| **Inventory** | `InventorySignatureHome` · `InventoryFinishedOrderCard` | Lifecycle hub + physical FIN media cards |
| **Home** | `AdminHomeSignatureHome` | Section shells, metric tiles, Attention→desk rhythm (density to be tamed, not rebranded) |

Shared elevation helper:

```ts
// apps/mobile/src/features/sales-orders/components/orderFloorStyle.ts
orderBoardShadow(colorScheme) === createElevation(colorScheme).card
```

Sticky CTA direction of travel:

- Canonical behavior: `FloatingActionDock` (`JourneyStickyDock` is a thin alias).
- Invoice pill (`InvoiceStickyActions`) remains a strong **multi-action chip dock** reference.
- Divergent absolute docks (Order detail, Product, Inventory item, Task, New Order glass) should converge toward `FloatingActionDock` (transparent surround, opaque action surface, safe-area + tab + keyboard).

---

## 2. Theme tokens (`apps/mobile/src/theme/`)

### 2.1 Canvas & color (light)

| Token | Value | Use |
|-------|-------|-----|
| `background` | `#E1DFD3` | Page parchment / linen |
| `surface` | `#F5F1EA` | Lifted paper cards |
| `surfaceSecondary` | `#EBE6DC` | Header bands / nested chrome |
| `surfaceElevated` | `#FAF7F1` | Nested section lift |
| `textPrimary` | `#1E1A1B` | Titles / body |
| `textSecondary` | `#5C574F` | Supporting |
| `textMuted` | `#8A857C` | Captions |
| `border` / `borderStrong` | `#D4CFC4` / `#C4BDB0` | Card edges |
| `brand` | `#776245` | Accent strip, primary CTA fill family |
| `success` / `warning` / `error` / `info` | Olive / amber coffee / burnt sienna / warm stone | **No traffic red / UI blue / mint** |

Dark scheme: liquorice base + lifted camo (`darkColors`) — same semantic family.

### 2.2 Spacing (4pt scale)

`none 0` · `2xs 2` · `xs 4` · `sm 8` · `md 12` · `lg 16` · `xl 20` · `2xl 24` · `3xl 32` · `4xl 40` · `5xl 48` · `6xl 64`

### 2.3 Radius

`sm 6` · `md 10` · `lg 14` · **`xl 20` (boards/cards)** · `full 9999` (pills/chips)

### 2.4 Elevation

| Level | Light intent |
|-------|----------------|
| `none` | Flat chrome only when intentional |
| `rest` | Soft resting controls (y3 / opacity ~0.08) |
| **`card`** | Primary boards (`orderBoardShadow`) — y8 / opacity ~0.12 / radius 18 / elevation 4 |
| `raised` | Metric tiles / floating chrome — slightly stronger |

**Hard gate:** primary entity cards use at least surface + border (+ accent) + `card` elevation. Do not ship important lists as unshadowed flat rows on beige.

---

## 3. Pattern catalog

### 3.1 Page canvas

- `AppScreen` / feature roots fill `colors.background` parchment.
- Content sits on lifted boards (`surface`), not raw text on the page wash.
- Horizontal padding typically `theme.spacing.lg` (16); section gaps `lg`–`2xl`.

### 3.2 Header

**Reference:** Purchasing / Invoices hub titles.

- Centered `largeTitle` (or equivalent heading) when hub-like.
- Absolute `ScreenBackLead` for stack screens (RTL-aware lead edge).
- Avoid competing eyebrows that overpower brand on auth; inside app, operational titles are calm and clear.

### 3.3 Section header

**Reference:** `AdminHomeSignatureHome` section shells; `PurchasingFloorBoard` titled header band.

- Uppercase / tracked brand caption for desk sections (Home).
- Floor boards: heading inside board with bottom `border` separator.
- One job per section: one title + short support when needed.

### 3.4 Cards

| Family | Reference | Anatomy |
|--------|-----------|---------|
| **Entity / media** | `ProductCard`, `InventoryFinishedOrderCard` | Photo → title → muted meta → optional price/status; `radius.xl`; `orderBoardShadow` |
| **Board / floor** | `PurchasingFloorBoard`, invoice/purchasing board cards | Strong border, surface, optional **3px brand accent strip** (RTL-aware), optional header band |
| **Action** | Invoice chip actions, PrimaryButton in docks | Opaque CTA; clear enabled/disabled |
| **Summary / metric** | Home `TileChip` / MetricRow | Raised elevation; CountUp; deep-link; not endless identical beige tiles without hierarchy |

Product media ratio baseline: **`PRODUCT_CARD_MEDIA_RATIO = 1.05`**. FIN cards use a taller crop (~1.28) for furniture outbound — keep consistent within family.

### 3.5 Status pill

- Prefer human labels (`DealerStatusBadge` pattern: always pass localized `label`).
- `StatusBadge` must not show raw API enums (`IN_PRODUCTION` → ugly underscore strip is a fail).
- Restrained coffee/olive soft fills — not neon chips.

### 3.6 Filter chips / rail

- Single chip language per role surface (admin journey stations vs dealer lifecycle — document intentional split or unify visually).
- Overflow → Filters sheet (no 3–4 wrapped chip rows).
- Purchasing / Invoices `*FilterTriggers` are the overflow trigger reference.

### 3.7 Search

- **`SearchBarShell`**: one height / icon / clear / placeholder language app-wide.
- Search-empty ≠ dataset-empty copy.

### 3.8 Sheet

- Shared sheet chrome (handle, title, safe padding, RTL).
- Confirmation sheets: **WHAT WILL HAPPEN**, not bare “Are you sure?”.
- Pickers (materials, dealers, categories) inherit parchment surfaces — not system-white islands when avoidable.

### 3.9 Sticky / floating dock

| Pattern | When |
|---------|------|
| **`FloatingActionDock`** (`JourneyStickyDock` alias) | Default primary operational CTA — transparent surround, opaque surface, `stickyCtaInset` + tab clearance + keyboard |
| **`InvoiceStickyActions` pill** | Multi-chip money actions (PDF / credit / pay) — keep visual language; parent absolute positioning should share inset math |
| **Avoid** | Bare absolute `PrimaryButton`, glass-only docks, opaque full-width blocks that collide with tab bar |

### 3.10 Empty / error / skeleton

| State | Pattern |
|-------|---------|
| **Empty** | `EmptyState` — heading + secondary + optional PrimaryButton; healthy empty (not “404”) |
| **Search empty** | Distinct copy (“No matches”) |
| **Error** | Human message + Retry |
| **Loading** | Area skeletons (no flash zeros on metric desks) |
| **Stale** | Prefer keep previous data while refetching where architecture already does |

### 3.11 Typography & icons

- Hierarchy via `AppText` variants + weight (AR often `medium` where EN uses `semibold`).
- Icons restrained Ionicons; no emoji decoration.
- Money rows: tabular figures where used on invoice/statement boards.

---

## 4. Screen anatomy (target for major lists/details)

```
Header (title + back)
→ Context / Attention (WHY + WHAT NEXT when relevant)
→ Search / Filter rail
→ Content (boards / media cards)
→ Primary CTA dock
→ Safe area (+ tab clearance when tabbed)
```

Detail variant:

```
Hero / media
→ Identity
→ Phase / progress
→ Next action
→ Supporting info (gated by role)
→ Timeline / history
→ FloatingActionDock
```

---

## 5. What Piece 13 must not do

- Invent Material / pure-white / neon / glassmorphism as a new system
- Flatten parchment into Apple-white cards
- Replace Products / Purchasing / Invoices visual language wholesale
- Claim visual PASS from TypeScript alone

---

## 6. Token quick reference (implementers)

| Need | Import |
|------|--------|
| Colors / spacing / radius | `@/theme` → `useTheme()` |
| Board shadow | `orderBoardShadow` from `orderFloorStyle` |
| Elevation factory | `createElevation` from `@/theme/elevation` |
| Search | `SearchBarShell` |
| Empty | `EmptyState` |
| Dock | `FloatingActionDock` (prefer over local absolute clones) |
