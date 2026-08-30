# PIECE 13 — Mobile UX/UI Audit

> **Status:** Phase A inventory (code research). Not a visual PASS.  
> **Scope:** Expo routes under `apps/mobile/app/` (98 screen routes excluding `_layout.tsx`).  
> **Business logic:** Pieces 1–12 frozen — this audit is presentation / consistency only.  
> **Related:** [PIECE13-MOBILE-VISUAL-BASELINE.md](./PIECE13-MOBILE-VISUAL-BASELINE.md) · [PIECE13-MOBILE-VISUAL-ACCEPTANCE.md](./PIECE13-MOBILE-VISUAL-ACCEPTANCE.md)

---

## 0. Inventory method

| Source | Count |
|--------|------:|
| Admin `(app)/(admin)/**` | 48 |
| Dealer `(app)/(customer)/**` | 22 |
| Worker `(app)/(employee)/**` | 7 |
| Auth `(auth)/**` | 6 |
| Shared `(app)/` (index, forbidden, notifications, search) | 4 |
| Root splash `app/index.tsx` | 1 |
| Dev `app/dev/**` (`__DEV__` only) | 10 |
| **Total screen routes** | **98** |

Layouts (`_layout.tsx`) excluded from count. Sheets/modals that are **not** routes are noted under the owning screen.

**FIX REQUIRED legend**

| Value | Meaning |
|-------|---------|
| **HIGH** | Blocks “one product feel”; fix in Piece 13 area phases |
| **MED** | Inconsistent / dense / weak destinations; polish required |
| **LOW** | Minor chrome / copy / edge states |
| **PRESERVE** | Visual reference — touch only for dock/search/filter/RTL/empty inconsistency |

---

## 1. Cross-cutting findings (code research)

| Theme | Evidence | Severity |
|-------|----------|----------|
| **Multiple order card languages** | Live signature path uses `OrdersProgressCard`; tree still has `OrderBoardCard`, `AdminOrderCard`, classic `DealerOrderCard` (sales-orders) + `dealer-ui/DealerOrderCard` | HIGH |
| **Journey vs dealer chips** | Admin `AdminLifecycleChips` vs dealer `OrdersFilterChips` / `DEALER_LIFECYCLE_CHIPS` on same signature home family | HIGH |
| **Raw `StatusBadge` enums** | `AdminOrderCard`, `ProductionOrderCard`, quotations, transfers; fallback strips `_` only | HIGH |
| **Production vocabulary overlap** | Production board vs Orders journey both talk stages/status; cards risk looking like another Orders list | HIGH |
| **Task dump on cards** | `ProductionDetailScreen` lists dense `ProductionTaskCard` (dual badges, progress, assignee) | HIGH |
| **Sticky CTA fragmentation** | `JourneyStickyDock` → `FloatingActionDock`; Invoice pill dock; Order/Product/Inventory absolute docks; TaskActionDock; glass NewOrder dock | HIGH |
| **Inventory dual rails** | `InventoryLifecycleTabs` + `InventorySectionTabs` share chrome band — separation under-enforced | MED |
| **Dealer destinations** | Home generally good; Statement / Payments / Deliveries / Returns can feel secondary | MED |
| **Worker Today + task detail** | Buckets exist (`TodayFloorBucketSection`); task detail multi-floor + 2×2 dock is dense | MED |
| **Management Home (P12)** | `AdminHomeSignatureHome` Attention→…→Activity: many MetricRow / TileChip strips — density risk | MED |
| **Flat setup/forms** | Some production-setup / workflow / staff forms still section as plain stacked fields | MED |
| **Quotations / returns / transfers badges** | Raw or partially mapped StatusBadge — not dealer-safe human pills everywhere | MED |

---

## 2. AUTH

| ROUTE | ROLE | PURPOSE | CURRENT UX PROBLEMS | CURRENT VISUAL PROBLEMS | DUPLICATED INFORMATION | PRIMARY ACTION | SECONDARY ACTIONS | SEARCH | FILTERS | EMPTY | LOADING | ERROR | RTL | FIX REQUIRED |
|-------|------|---------|---------------------|-------------------------|------------------------|----------------|-------------------|--------|---------|-------|---------|-------|-----|--------------|
| `/(auth)/login` | ALL | Sign in | Auth motion separate from app chrome | Strong brand; may diverge from parchment boards | — | Sign in | Locale | — | — | N/A | Form busy | Credential / network | Code-aware; handset PENDING | LOW |
| `/(auth)/mfa` | ALL | MFA challenge | Minimal | Functional parchment | — | Verify | Back | — | — | N/A | Busy | Invalid code | PENDING | LOW |
| `/(auth)/unlock` | ALL | Biometric re-unlock | — | Minimal | — | Unlock | Sign out | — | — | N/A | Unlocking | Biometric fail | PENDING | LOW |
| `/(auth)/session-expired` | ALL | Force re-auth | Copy may be terse | Flat message screen | — | Sign in again | — | — | — | N/A | — | — | PENDING | LOW |
| `/(auth)/disabled` | ALL | Account disabled | No recovery path beyond support copy | Flat | — | Contact / OK | — | — | — | N/A | — | — | PENDING | LOW |
| `/(auth)/offline` | ALL | No connectivity gate | — | Flat | — | Retry | — | — | — | N/A | Retry busy | Offline | PENDING | LOW |

---

## 3. ADMIN — tabs

| ROUTE | ROLE | PURPOSE | CURRENT UX PROBLEMS | CURRENT VISUAL PROBLEMS | DUPLICATED INFORMATION | PRIMARY ACTION | SECONDARY ACTIONS | SEARCH | FILTERS | EMPTY | LOADING | ERROR | RTL | FIX REQUIRED |
|-------|------|---------|---------------------|-------------------------|------------------------|----------------|-------------------|--------|---------|-------|---------|-------|-----|--------------|
| `/(admin)/(tabs)/` → Home | ADMIN | P12 management desk | Attention dominance vs many equal tile rows; long scroll | Dense MetricRow / TileChip strips; section shells good | Tile counts vs deep-link destinations can feel redundant | Open Attention / COUNT=DATASET | Reports, search, overflow modules | Global / home search | Section filters via deep-links | Partial healthy empties | Skeletons uneven by section | Retry per section? | PENDING | **HIGH** (density) |
| `/(admin)/(tabs)/orders` | ADMIN | Orders journey board | Multiple card langs in tree; Preparing setup not always remaining-work-forward | Signature cards strong; classic cards diverge | Status + journey phase + chips | Open order / filter journey | New / overflow | Yes | Journey chips + sheet | Yes | Skeleton | Retry | PENDING | **HIGH** |
| `/(admin)/(tabs)/production` | ADMIN | Factory production buckets | Vocab overlaps Orders; board cards may dump tasks | `ProductionOrderCard` + raw StatusBadge | SO + PO + stage + status | Open production order | Plan / schedule links | Yes (area) | Bucket filters | Yes | Skeleton | Retry | PENDING | **HIGH** |
| `/(admin)/(tabs)/inventory` | ADMIN | RAW / SEMI / FIN hub | Lifecycle vs section tabs need clearer separation | Signature home strong; dual rails clutter risk | Group counts + lifecycle counts | Enter lifecycle / scan | Transfers, counts | Yes | Lifecycle + section | Yes | Skeleton | Retry | PENDING | **MED** |
| `/(admin)/(tabs)/more` | ADMIN | Overflow hub | Module density | MoreBoard generally board-like | — | Open module | Settings / account | — | — | N/A | — | — | PENDING | LOW |

---

## 4. ADMIN — Orders / RFQ / Setup / Flow

| ROUTE | ROLE | PURPOSE | CURRENT UX PROBLEMS | CURRENT VISUAL PROBLEMS | DUPLICATED INFORMATION | PRIMARY ACTION | SECONDARY ACTIONS | SEARCH | FILTERS | EMPTY | LOADING | ERROR | RTL | FIX REQUIRED |
|-------|------|---------|---------------------|-------------------------|------------------------|----------------|-------------------|--------|---------|-------|---------|-------|-----|--------------|
| `/(admin)/orders/[id]` | ADMIN | Order detail | Detail anatomy uneven by phase; sticky CTA not Journey dock | Absolute board dock ≠ Invoice/Journey | Status + timeline + phase | Phase primary (confirm / setup / …) | Cancel, flow, docs | — | Persist from list? | N/A | Skeleton | Retry | PENDING | **HIGH** |
| `/(admin)/orders/[id]/flow` | ADMIN | Production flow graph | Dealer-safe vs admin drill sheets | Graph density | Stage list elsewhere | Drill stage | Sheets | — | — | Empty flow | Loading | Error | PENDING | MED |
| `/(admin)/orders/[id]/production-setup` | ADMIN | Order production setup home | Form sections can feel flat dossier | JourneyStickyDock OK | Readiness + line cards | Continue / save | Lines | — | — | Empty lines | Loading | Error | PENDING | **HIGH** |
| `/(admin)/orders/[id]/production-setup/lines/[lineId]` | ADMIN | Line setup dossier | Dense measurements / materials / cost | Flat sections risk | Spec vs BOM vs cost | Save line | Pickers / sheets | Material pick | — | — | Loading | Error | PENDING | **HIGH** |
| `/(admin)/requests/[id]` | ADMIN | Customer request / RFQ | Must stay visually distinct from Preparing SO | Board vs form mix | RFQ status + order link | Advance RFQ | Edit / quote | — | — | N/A | Loading | Error | PENDING | MED |
| `/(admin)/quotations/[id]` | ADMIN | Quotation detail | Raw StatusBadge enums | Less floor-board than Invoices | Amounts + lines | Accept / send / PDF | — | — | — | Loading | Error | PENDING | MED |
| `/(admin)/scheduling` | ADMIN | Factory scheduling | Capacity + at-risk cards | Mixed card languages | Capacity vs order risk | Reschedule / open order | Sheets | — | Date / risk | Empty | Loading | Error | PENDING | MED |

---

## 5. ADMIN — Production / Workflow / Tasks

| ROUTE | ROLE | PURPOSE | CURRENT UX PROBLEMS | CURRENT VISUAL PROBLEMS | DUPLICATED INFORMATION | PRIMARY ACTION | SECONDARY ACTIONS | SEARCH | FILTERS | EMPTY | LOADING | ERROR | RTL | FIX REQUIRED |
|-------|------|---------|---------------------|-------------------------|------------------------|----------------|-------------------|--------|---------|-------|---------|-------|-----|--------------|
| `/(admin)/production/[id]` | ADMIN | Production order detail | Task dump; hierarchy vs dock | Floating dock present; body dense | Stage + tasks + WIP | Primary plan / release action | Tasks, materials, QC | — | Task filters? | Empty tasks | Skeleton | Retry | PENDING | **HIGH** |
| `/(admin)/production/[id]/flow` | ADMIN | Admin production flow | Same family as order flow | Dense | Duplicates order flow | Stage drill | — | — | — | Empty | Loading | Error | PENDING | MED |
| `/(admin)/production/[id]/setup` | ADMIN | Redirect / legacy setup | Redirect-only — confirm no dead UX | — | — | → detail | — | — | — | — | — | — | — | LOW (dead path check) |
| `/(admin)/production/tasks/[id]` | ADMIN | Admin task detail | Same density as worker task | Industrial sections | Materials + work + status | Task primary | Photos / notes | — | — | — | Loading | Error | PENDING | MED |
| `/(admin)/production/workflow` | ADMIN | Workflow library list | Visual-only Piece 13 | Floor list OK | — | Open workflow | Create | Search? | — | Empty | Loading | Error | PENDING | MED |
| `/(admin)/production/workflow/[id]` | ADMIN | Workflow detail | Graph Inspector `__DEV__` only | Stage cards | Opening/terminal blocks | Edit stages | Sheets | — | — | Empty stages | Loading | Error | PENDING | MED |
| `/(admin)/production/workflow/stages` | ADMIN | Stage library | Gallery tiles | — | — | Add / edit stage | — | — | — | Empty | Loading | Error | PENDING | MED |

---

## 6. ADMIN — Inventory

| ROUTE | ROLE | PURPOSE | CURRENT UX PROBLEMS | CURRENT VISUAL PROBLEMS | DUPLICATED INFORMATION | PRIMARY ACTION | SECONDARY ACTIONS | SEARCH | FILTERS | EMPTY | LOADING | ERROR | RTL | FIX REQUIRED |
|-------|------|---------|---------------------|-------------------------|------------------------|----------------|-------------------|--------|---------|-------|---------|-------|-----|--------------|
| `/(admin)/inventory/[group]` | ADMIN | Category / group list | Ensure RAW≠SEMI≠FIN mix | Group cards | Counts | Open items | — | Yes | Group | Empty | Skeleton | Retry | PENDING | MED |
| `/(admin)/inventory/items/[id]` | ADMIN | Item detail | Sticky receive CTA divergent absolute | Media / lots uneven | Stock + transfers | Receive / adjust | Scan, report | — | — | — | Loading | Error | PENDING | **HIGH** (dock) |
| `/(admin)/inventory/semi/[orderId]` | ADMIN | SEMI order physical desk | Must stay piece/custody forward | Semi cards strong | Stage + kit + SO | Handoff / open piece | Sheets | — | Stage | Empty | Loading | Error | PENDING | MED |
| `/(admin)/inventory/finished/[salesOrderId]` | ADMIN | FIN outbound desk (P10) | Polish only | `InventoryFinishedOrderCard` reference-quality | Packages + leave-by | Ship / load | Inspect sheets | — | — | Empty pkgs | Loading | Error | PENDING | LOW–PRESERVE polish |

---

## 7. ADMIN — Products / Purchasing / Invoices (**PRESERVE**)

| ROUTE | ROLE | PURPOSE | CURRENT UX PROBLEMS | CURRENT VISUAL PROBLEMS | DUPLICATED INFORMATION | PRIMARY ACTION | SECONDARY ACTIONS | SEARCH | FILTERS | EMPTY | LOADING | ERROR | RTL | FIX REQUIRED |
|-------|------|---------|---------------------|-------------------------|------------------------|----------------|-------------------|--------|---------|-------|---------|-------|-----|--------------|
| `/(admin)/products` | ADMIN | Catalog (reference) | — | ProductCard + orderBoardShadow = baseline | — | Open product | Create sheet | Yes | Category | Empty | Skeleton | Retry | PENDING | **PRESERVE** |
| `/(admin)/products/[id]` | ADMIN | Product detail | Absolute/glass sticky on some paths | Media gallery strong | Spec + BOM | Edit / order CTA | Setup links | — | — | — | Loading | Error | PENDING | **PRESERVE** (+ dock unify) |
| `/(admin)/products/[id]/production-setup` | ADMIN | Product mfg setup | Flat fields risk; absolute pill dock ≈ Invoice | — | Workflow times link | Save | Sheets | — | — | — | Loading | Error | PENDING | **PRESERVE** (+ dock) |
| `/(admin)/products/[id]/workflow-times` | ADMIN | Stage times | Form density | Flat sections | — | Save | — | — | — | — | Loading | Error | PENDING | **PRESERVE** |
| `/(admin)/purchasing` | ADMIN | Purchasing hub (reference) | — | PurchasingFloorBoard + accent strip | Tabs PO / PR / SI | Open board card | Create | Yes | Filter triggers | Empty | Skeleton | Retry | PENDING | **PRESERVE** |
| `/(admin)/purchasing/create` | ADMIN | Redirect → hub create | Confirm no orphan | — | — | — | — | — | — | — | — | — | — | LOW |
| `/(admin)/purchasing/[id]` | ADMIN | PO detail | — | Board language | Lines + status | Receive / advance | — | — | — | — | Loading | Error | PENDING | **PRESERVE** |
| `/(admin)/purchasing/requests/[id]` | ADMIN | PR detail | — | Board language | — | Convert / edit | — | — | — | — | Loading | Error | PENDING | **PRESERVE** |
| `/(admin)/purchasing/supplier-invoices/[id]` | ADMIN | Supplier invoice | — | Board card family | — | Match / pay path | — | — | — | — | Loading | Error | PENDING | **PRESERVE** |
| `/(admin)/invoices` | ADMIN | Invoice list (reference) | — | InvoiceBoardCard / floor | Balance strip | Open invoice | Create sheet | Yes | Filter triggers | Empty | Skeleton | Retry | PENDING | **PRESERVE** |
| `/(admin)/invoices/[id]` | ADMIN | Invoice detail | Dock pattern = InvoiceStickyActions (pill) — keep as dock reference, unify others toward FloatingActionDock | Strong | Amounts + lines | PDF / Pay / Credit | — | — | — | Loading | Error | PENDING | **PRESERVE** |

---

## 8. ADMIN — Dealers / Users / Returns / Deliveries / AI / Account

| ROUTE | ROLE | PURPOSE | CURRENT UX PROBLEMS | CURRENT VISUAL PROBLEMS | DUPLICATED INFORMATION | PRIMARY ACTION | SECONDARY ACTIONS | SEARCH | FILTERS | EMPTY | LOADING | ERROR | RTL | FIX REQUIRED |
|-------|------|---------|---------------------|-------------------------|------------------------|----------------|-------------------|--------|---------|-------|---------|-------|-----|--------------|
| `/(admin)/dealers` | ADMIN | Dealer CRM list | — | DealerBoard cards | Metrics rail | Open dealer | Add | Yes | Status | Empty | Skeleton | Retry | PENDING | MED |
| `/(admin)/dealers/[id]` | ADMIN | Dealer detail | Sheet sprawl | Metric tiles | Orders + invoices lists | Edit / price | CRM sheets | — | — | Empty lists | Loading | Error | PENDING | MED |
| `/(admin)/users` | ADMIN | Staff list | — | UserBoardCard | — | Open / invite | Status filter | Yes | Status sheet | Empty | Skeleton | Retry | PENDING | MED |
| `/(admin)/users/staff-types` | ADMIN | Staff types | — | Board cards | — | Open type | New | — | — | Empty | Loading | Error | PENDING | LOW |
| `/(admin)/users/staff-types/new` | ADMIN | Create staff type | Form flat risk | — | — | Save | — | — | — | — | Busy | Error | PENDING | LOW |
| `/(admin)/users/staff-types/[id]` | ADMIN | Edit staff type | Form flat risk | — | — | Save | — | — | — | — | Loading | Error | PENDING | LOW |
| `/(admin)/returns` | ADMIN | Returns list | Raw / mapped badges inconsistent | ReturnBoardCard | — | Open return | Create | Yes | Filter triggers | Empty | Skeleton | Retry | PENDING | MED |
| `/(admin)/returns/[id]` | ADMIN | Return detail | Next-action clarity | Photo gallery OK | Resolution + status | Resolve / advance | Photos | — | — | — | Loading | Error | PENDING | MED |
| `/(admin)/deliveries/[id]` | ADMIN | Delivery / load desk | Phase language vs dealer | Load sheet density | Packages + status | Confirm / ship | — | — | — | — | Loading | Error | PENDING | MED |
| `/(admin)/ai-intake` | ADMIN | AI intake list | — | List boards | — | Open review | — | — | — | Empty | Loading | Error | PENDING | LOW |
| `/(admin)/ai-intake/[id]` | ADMIN | AI review | Processing animation | — | Extracted vs order | Confirm / reject | — | — | — | — | Loading | Error | PENDING | LOW |
| `/(admin)/ai-chat` | ADMIN | Admin AI chat | Response boards | — | — | Send | — | — | — | Empty chat | Streaming | Error | PENDING | LOW |
| `/(admin)/more/account` | ADMIN | Account | — | Simple | — | Save profile | — | — | — | — | Busy | Error | PENDING | LOW |
| `/(admin)/more/settings` | ADMIN | Settings | — | Simple | — | Toggle prefs | Locale | — | — | — | — | — | PENDING | LOW |

---

## 9. DEALER (customer)

| ROUTE | ROLE | PURPOSE | CURRENT UX PROBLEMS | CURRENT VISUAL PROBLEMS | DUPLICATED INFORMATION | PRIMARY ACTION | SECONDARY ACTIONS | SEARCH | FILTERS | EMPTY | LOADING | ERROR | RTL | FIX REQUIRED |
|-------|------|---------|---------------------|-------------------------|------------------------|----------------|-------------------|--------|---------|-------|---------|-------|-----|--------------|
| `/(customer)/(tabs)/` Home | DEALER | Commercial home | Destinations (Statement/Payments/Deliveries/Returns) may be weak | Generally good dealer chrome | Metrics + lists | Open destination | Catalog / new order | — | — | Empty modules | Loading | Error | PENDING | MED |
| `/(customer)/(tabs)/catalog` | DEALER | Browse products | — | DealerProductCard / ProductCard | — | Open product | — | Yes | Category | Empty | Skeleton | Retry | PENDING | **PRESERVE**-ish |
| `/(customer)/(tabs)/orders` | DEALER | Dealer orders | Chip language ≠ admin journey; dual DealerOrderCard kits | Signature + dealer-ui mix | Lifecycle + status | Open order | — | Yes | Lifecycle chips | Empty | Skeleton | Retry | PENDING | **HIGH** |
| `/(customer)/(tabs)/new-order` | DEALER | Create order flow | Must stay one linear flow | Glass NewOrderFloatingDock ≠ Journey | Cart vs review | Submit | Customize sheets | Product search | Filters | Empty cart | Busy | Error | PENDING | MED |
| `/(customer)/(tabs)/schedule` | DEALER | Delivery calendar | — | Calendar load colors OK | — | Open day / order | — | — | Date | Empty | Loading | Error | PENDING | LOW |
| `/(customer)/(tabs)/account` | DEALER | Account hub | Destinations prominence | — | — | Statement / Payments / … | Security | — | — | — | — | — | PENDING | MED |
| `/(customer)/catalog/[id]` | DEALER | Product detail | Glass sticky dock | Media strong | — | Add to order | Related | — | — | — | Loading | Error | PENDING | MED (dock) |
| `/(customer)/orders/[id]` | DEALER | Order detail | No factory leakage; phase copy only | Dock pattern | Status + timeline | Confirm receipt / pay links | Flow | — | — | — | Loading | Error | PENDING | **HIGH** |
| `/(customer)/orders/[id]/flow` | DEALER | Dealer-safe flow | Leakage risk if admin sheets shared | Simplified stages | — | View stage | DealerStageSheet | — | — | Empty | Loading | Error | PENDING | MED |
| `/(customer)/requests/[id]` | DEALER | Edit / view RFQ | — | Form | — | Submit / update | — | — | — | — | Busy | Error | PENDING | MED |
| `/(customer)/quotations` | DEALER | Quotation list | Raw StatusBadge | Weaker than invoice boards | — | Open quote | — | — | — | Empty | Loading | Error | PENDING | MED |
| `/(customer)/quotations/[id]` | DEALER | Quotation detail | Raw StatusBadge | — | — | Accept / PDF | — | — | — | — | Loading | Error | PENDING | MED |
| `/(customer)/invoices` | DEALER | Invoice list | Align money language | Share Invoice board language | — | Open invoice | — | Yes | Filters | Empty | Skeleton | Retry | PENDING | MED |
| `/(customer)/invoices/[id]` | DEALER | Invoice detail | Dock unify | InvoiceStickyActions | — | Pay / PDF / credit | — | — | — | — | Loading | Error | PENDING | MED |
| `/(customer)/returns` | DEALER | Returns list | — | Cards | — | Open / create | — | — | Filters | Empty | Loading | Error | PENDING | MED |
| `/(customer)/returns/create` | DEALER | Create return | Absolute form chrome | — | Order pick + photos | Submit | Picker sheet | Order search | — | — | Busy | Error | PENDING | MED |
| `/(customer)/returns/[id]` | DEALER | Return detail | Next action clarity | Photos | — | View status | — | — | — | — | Loading | Error | PENDING | MED |
| `/(customer)/account/statement` | DEALER | Account statement | Credit ≠ debt visually | Balance board | Activity rows | Date range | — | — | Date sheet | Empty | Loading | Error | PENDING | MED |
| `/(customer)/account/payments` | DEALER | Payments | Money language align | — | — | Record / view | — | — | — | Empty | Loading | Error | PENDING | MED |
| `/(customer)/account/security` | DEALER | Security | — | Simple | — | Change password | — | — | — | — | Busy | Error | PENDING | LOW |
| `/(customer)/account/calendar` | DEALER | Account calendar | Overlap with schedule tab? | — | — | Open date | — | — | — | Empty | Loading | Error | PENDING | LOW |
| `/(customer)/ai-chat` | DEALER | Dealer AI chat | Role-safe answers | Boards | — | Send | — | — | — | Empty | Streaming | Error | PENDING | LOW |

---

## 10. WORKER (employee)

| ROUTE | ROLE | PURPOSE | CURRENT UX PROBLEMS | CURRENT VISUAL PROBLEMS | DUPLICATED INFORMATION | PRIMARY ACTION | SECONDARY ACTIONS | SEARCH | FILTERS | EMPTY | LOADING | ERROR | RTL | FIX REQUIRED |
|-------|------|---------|---------------------|-------------------------|------------------------|----------------|-------------------|--------|---------|-------|---------|-------|-----|--------------|
| `/(employee)/(tabs)/` Today | WORKER | Floor Today buckets | Bucket clarity OK; nested card density | Industrial theme override | Stage + quality stamps | Open task | — | — | Bucket sections | Empty bucket | Skeleton | Retry | PENDING | MED |
| `/(employee)/(tabs)/tasks` | WORKER | Task list / delivery list branch | Branching by floor role | IndustrialFloorTaskCard | — | Open task | — | Yes | Status | Empty | Skeleton | Retry | PENDING | MED |
| `/(employee)/(tabs)/completed` | WORKER | Completed today / history | Date picker sheet | — | — | Open completed | Date filter | — | Date | Empty | Loading | Error | PENDING | LOW |
| `/(employee)/(tabs)/notifications` | WORKER | Inbox | Shared inbox chrome | NotificationBoardCard | — | Open deep-link | — | — | — | Empty | Skeleton | Retry | PENDING | LOW |
| `/(employee)/(tabs)/profile` | WORKER | Profile | — | Simple | — | Locale / logout | — | — | — | — | — | — | PENDING | LOW |
| `/(employee)/tasks/[id]` | WORKER | Task detail | Dense multi-floor; hide irrelevant controls | TaskActionDock 2×2 absolute ≠ FloatingActionDock | Materials + incoming + semi + work | State primary (start/complete/…) | Photos / notes / SEMI | — | — | — | Loading | Error | PENDING | **HIGH** |
| `/(employee)/deliveries/[id]` | WORKER | Delivery load sheet | Physical package cards | Density | Packages + confirm | Confirm load / deliver | — | — | — | Empty pkgs | Loading | Error | PENDING | MED |

---

## 11. SHARED / ROOT

| ROUTE | ROLE | PURPOSE | CURRENT UX PROBLEMS | CURRENT VISUAL PROBLEMS | DUPLICATED INFORMATION | PRIMARY ACTION | SECONDARY ACTIONS | SEARCH | FILTERS | EMPTY | LOADING | ERROR | RTL | FIX REQUIRED |
|-------|------|---------|---------------------|-------------------------|------------------------|----------------|-------------------|--------|---------|-------|---------|-------|-----|--------------|
| `/` (`app/index`) | ALL | Splash / gate | — | Brand intro | — | Auto-route | — | — | — | — | Splash | Boot error | PENDING | LOW |
| `/(app)/` index | ALL | Role redirect | — | — | — | Redirect | — | — | — | — | — | — | — | LOW |
| `/(app)/_forbidden` | ALL | Permission denied | — | Flat | — | Go back / home | — | — | — | N/A | — | — | PENDING | LOW |
| `/(app)/notifications` | SHARED | Admin/shared inbox | Same as worker inbox family | Board cards | — | Open item | — | — | — | Empty | Skeleton | Retry | PENDING | LOW |
| `/(app)/search` | SHARED | Global search | Must use SearchBarShell language | Results cards vary | Cross-module hits | Open result | — | Yes | Type chips? | Search-empty ≠ empty | Loading | Error | PENDING | MED |

---

## 12. DEV (`__DEV__` only)

`app/dev/_layout.tsx` redirects to `/` when `!__DEV__`. Not production UX.

| ROUTE | ROLE | PURPOSE | FIX REQUIRED |
|-------|------|---------|--------------|
| `/dev/admin-home` | DEV | Gallery Admin Home | LOW — keep `__DEV__`; no production polish |
| `/dev/dealer-home` | DEV | Gallery Dealer Home | LOW |
| `/dev/worker-home` | DEV | Gallery Worker Home | LOW |
| `/dev/catalog` | DEV | Gallery catalog | LOW |
| `/dev/product-detail` | DEV | Gallery product | LOW |
| `/dev/orders` | DEV | Gallery orders | LOW |
| `/dev/order-detail` | DEV | Gallery order | LOW |
| `/dev/new-order` | DEV | Gallery new order | LOW |
| `/dev/tasks` | DEV | Gallery tasks | LOW |
| `/dev/task-detail` | DEV | Gallery task | LOW |

Piece 13 may remove obsolete DEV badges elsewhere; **do not** delete `/dev/*` galleries.

---

## 13. Full route index (98)

### Auth (6)
`login` · `mfa` · `unlock` · `session-expired` · `disabled` · `offline`

### Admin tabs (5)
`(tabs)/index` · `orders` · `production` · `inventory` · `more`

### Admin stacks (43)
`orders/[id]` · `orders/[id]/flow` · `orders/[id]/production-setup` · `orders/[id]/production-setup/lines/[lineId]` · `production/[id]` · `production/[id]/flow` · `production/[id]/setup` · `production/tasks/[id]` · `production/workflow` · `production/workflow/[id]` · `production/workflow/stages` · `products` · `products/[id]` · `products/[id]/production-setup` · `products/[id]/workflow-times` · `purchasing` · `purchasing/create` · `purchasing/[id]` · `purchasing/requests/[id]` · `purchasing/supplier-invoices/[id]` · `invoices` · `invoices/[id]` · `inventory/[group]` · `inventory/items/[id]` · `inventory/semi/[orderId]` · `inventory/finished/[salesOrderId]` · `dealers` · `dealers/[id]` · `users` · `users/staff-types` · `users/staff-types/new` · `users/staff-types/[id]` · `returns` · `returns/[id]` · `requests/[id]` · `quotations/[id]` · `scheduling` · `deliveries/[id]` · `ai-intake` · `ai-intake/[id]` · `ai-chat` · `more/account` · `more/settings`

### Dealer (22)
tabs: `index` · `catalog` · `orders` · `new-order` · `schedule` · `account`  
stacks: `catalog/[id]` · `orders/[id]` · `orders/[id]/flow` · `requests/[id]` · `quotations` · `quotations/[id]` · `invoices` · `invoices/[id]` · `returns` · `returns/create` · `returns/[id]` · `account/statement` · `account/payments` · `account/security` · `account/calendar` · `ai-chat`

### Worker (7)
tabs: `index` · `tasks` · `completed` · `notifications` · `profile`  
stacks: `tasks/[id]` · `deliveries/[id]`

### Shared + root (5)
`app/index` · `(app)/index` · `(app)/_forbidden` · `(app)/notifications` · `(app)/search`

### Dev (10)
`admin-home` · `dealer-home` · `worker-home` · `catalog` · `product-detail` · `orders` · `order-detail` · `new-order` · `tasks` · `task-detail`

---

## 14. Priority map for Piece 13 phases

| Phase | Areas | Dominant FIX |
|-------|-------|--------------|
| B | Orders list + detail | HIGH |
| C | Production + setup + workflow | HIGH |
| D | Worker Today + task | HIGH/MED |
| E | Inventory lifecycle separation + docks | MED/HIGH |
| F | Purchasing + Products | PRESERVE |
| G–I | Quality/pack (on prod/task), Deliveries, Returns, Finance | MED |
| J | Dealer simplify + destinations | MED |
| K | Management Home density | HIGH density / MED polish |
| L–M | Global RTL, empties, docks, DEV cleanup | Cross-cutting |

---

## 15. Honesty

- Inventory from **Expo route files + screen imports** (Aug 2026 codebase).  
- Visual / RTL / handset columns are **PENDING** until observed — see acceptance matrix.  
- No business semantics changed by this document.
