# Mobile visual QA checklist

**App:** Expo `@maher/mobile`  
**Date opened:** 2026-08-05  
**Status:** Manual matrix — not executed end-to-end in CI (no device lab). Fill Pass / Fail / N/A / Blocked per cell during device sessions.

Related screenshot notes (partial): [`docs/mobile-screenshots/`](./mobile-screenshots/).

---

## How to use

1. Pick a **platform + form factor** row set.
2. For each **locale** (`ar`, `he`, `en`) and **theme** (light / dark), walk major screens.
3. For each screen, verify **loading**, **empty**, **error**, and **offline** where applicable (airplane mode + cached lists).
4. Mark cells: `P` pass · `F` fail · `-` N/A · `B` blocked.

### Devices

| Code | Meaning |
|------|---------|
| A-S | Android small (~360×640–800) |
| A-L | Android large (~412×915+) |
| I-S | iOS small (SE / mini class) |
| I-L | iOS large (Pro Max class) |

### Locales / themes

| Code | Meaning |
|------|---------|
| ar | Arabic RTL |
| he | Hebrew RTL |
| en | English LTR |
| L | Light |
| D | Dark (`userInterfaceStyle: automatic`) |

---

## Major surfaces

Copy this table per platform (A-S, A-L, I-S, I-L) or track in a spreadsheet.

| Screen | Route / entry | Loading | Empty | Error | Offline | ar+L | ar+D | he+L | he+D | en+L | en+D | Notes |
|--------|---------------|---------|-------|-------|---------|------|------|------|------|------|------|-------|
| Login | `(auth)/login` | | | | | | | | | | | |
| Biometric unlock | `(auth)/unlock` | | | | | | | | | | | |
| Admin home | `(admin)/(tabs)/home` | | | | | | | | | | | |
| Dealer home | `(customer)/(tabs)/home` | | | | | | | | | | | |
| Worker home | `(employee)/(tabs)/home` | | | | | | | | | | | |
| Orders list | orders tabs | | | | | | | | | | | |
| Order detail | orders/[id] | | | | | | | | | | | |
| Catalog | catalog | | | | | | | | | | | |
| Product detail | catalog/[id] | | | | | | | | | | | |
| New order / request | new-order / requests | | | | | | | | | | | |
| AI intake | ai-intake | | | | | | | | | | | |
| Tasks list | tasks | | | | | | | | | | | |
| Task detail + outbox | tasks/[id] | | | | | | | | | | | Pending upload banner |
| Production | production | | | | | | | | | | | Admin |
| Inventory | inventory | | | | | | | | | | | Admin |
| Purchasing | purchasing | | | | | | | | | | | Admin |
| Invoices | invoices | | | | | | | | | | | |
| Account statement | account/statement | | | | | | | | | | | Dealer |
| Returns | returns | | | | | | | | | | | |
| Notifications | notifications | | | | | | | | | | | |
| Global search | search | | | | | | | | | | | |
| More / Account | more / account tabs | | | | | | | | | | | |

---

## Cross-cutting checks (every locale)

| Check | A-S | A-L | I-S | I-L | Notes |
|-------|-----|-----|-----|-----|-------|
| 44×44 min touch targets (chips, headers, primary buttons) | | | | | |
| Screen-reader labels on icon buttons (search, notifications) | | | | | |
| RTL icon mirroring (back / chevrons) | | | | | ar + he |
| Form error announcements | | | | | |
| Reduced motion (OS setting) — no jarring motion | | | | | |
| High contrast (OS) — borders/text readable | | | | | |
| Pull-to-refresh | | | | | |
| Last-updated label when offline cache shown | | | | | |
| Brand icon / splash on cold start | | | | | |
| Deep link `maher://` opens app | | | | | |

---

## Roles to exercise

| Role | Demo user (seed) | Focus |
|------|------------------|-------|
| Admin | `admin` | Home KPIs, production, inventory, purchasing, AI, returns approve |
| Dealer | `nile` / `oasis` | Own orders only, statement, invoices, returns submit, catalog |
| Worker | `carpenter` / `carpenter2` | Own tasks only, complete, photo outbox |

Password (seed): `123`

---

## Session log

| Date | Tester | Device | Locales | Result summary |
|------|--------|--------|---------|----------------|
| 2026-08-05 | — | Not run (docs only) | — | Automated Jest/smokes green; visual matrix pending devices |

---

## Blockers for full visual sign-off

- Physical / cloud device farm (BrowserStack, Firebase Test Lab, etc.)
- Stable admin-web for any web companion checks
- Store screenshot sets (6.7" / 6.5" / Android phone) for listings
