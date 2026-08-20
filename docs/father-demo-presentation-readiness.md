# Father demo — presentation readiness

**Verdict: PASS — presentation-ready** after curated seed + mapping repair on 2026-08-16.

**Clock:** 16 Aug 2026 (Asia/Amman), `DEMO_AS_OF`. Password `123`.  
**Method:** Same audit as the pre-repair fail. `pnpm demo:reset` (idempotent) + `demo:validate` + live `GET` after login (mobile and web tokens). Walkthrough: [father-demo-walkthrough.md](father-demo-walkthrough.md). Repair notes: [demo-factory-data-repair-report.md](demo-factory-data-repair-report.md).

All 12 walkthrough numbers, dealers, products, and logins (`admin`, `nile` / `oasis` / `balqis`, `carpenter` / `inspector`) still exist. Canonical may-be-late is **exactly 3** (Cedar, Diwan, Jabal). Dashboard delayed count is **3**. Mobile home hero is Jabal `SO-2026-00023`.

---

## Previous blockers (re-evaluated)

| # | Blocker | Result |
|---|---------|--------|
| 1 | 54 synthetic `projectName`s | **PASS** — extras use site/project names (e.g. Irbid Showroom Floor). Zero dealer+SKU+kind strings. |
| 2 | Active `TEST` / `TEST-2` / `SA` warehouses | **PASS** — only RAW / SEMI / FIN, all active. |
| 3 | Dashboard delayed 23 vs scheduling 3; hero `SO-2026-00003` | **PASS** — dashboard delayed **3**; scheduling at-risk **3**; hero **SO-2026-00023** LATE, peerCount 3. |
| 4 | Admin web raw `demo:…` reasons | **PASS** — schedule `reason` is null; DTO `reason` is null; `reasonLabel` is the i18n key (Late / WIP not ready / Materials not ready). |
| 5 | Future DELIVERED / past PLANNED deliveries | **PASS** — 0 future DELIVERED; 0 stale PLANNED. Abdali `DLV-2026-00010` PLANNED **19 Aug**. |
| 6 | 91 stale open allocations; carpenter in progress since 25 Jul | **PASS** — ordinary stale opens are 0 (Jabal remaining work in late July is the justified LATE exception). Carpenter current carpentry starts **16 Aug**. |

---

## Walkthrough stories

| # | Story | Numbers | Result |
|---|--------|---------|--------|
| 1 | Abdoun lounge set | SO-2026-00001 DELIVERED, PO-2026-00001 COMPLETED, DLV-2026-00001, INV-2026-00001 PAID 0 outstanding | **PASS** |
| 2 | Sweifieh sectional | SO-2026-00047 IN_PRODUCTION, foam IN_PROGRESS after carpentry COMPLETED | **PASS** |
| 3 | Abdali banquettes | SO-2026-00019 READY_FOR_DELIVERY, DLV-2026-00010 PLANNED **19 Aug** | **PASS** |
| 4 | Cedar Italian velvet | SO-2026-00056 WAITING_FOR_MATERIALS, MAT-ITAL-VEL avail 0, PORD-2026-00019 SENT, 0 started tasks, at-risk copy is materials-not-ready | **PASS** |
| 5 | Diwan wingback foam | SO-2026-00051 IN_PRODUCTION, FOAM **READY** (not in progress), UPHOLSTERY NOT_STARTED, classifier BLOCKED / WIP_NOT_READY | **PASS** |
| 6 | Jabal contract dining | SO-2026-00023, committed 10 Aug, LATE chip, remaining inspection still dated 27 Jul (intentional late exception) | **PASS** |
| 7 | Oasis club armchair QC | SO-2026-00042 IN_PRODUCTION, PO ON_HOLD, QC fail + RW-2026-00002 AWAITING_STAGE | **PASS** |
| 8 | Nile loveseat recovered | SO-2026-00006 DELIVERED, INV-2026-00003 PARTIALLY_PAID 471.053 outstanding | **PASS** |
| 9 | Zaatar ottoman scuff | SO-2026-00013 DELIVERED, RET-2026-00002 APPROVED DELIVERY_DAMAGE | **PASS** |
| 10 | Qasr suite dining | SO-2026-00064 READY_FOR_PRODUCTION, schedule PROPOSED / AWAITING_APPROVAL | **PASS** |
| 11 | Noor club chair hold | SO-2026-00065 DRAFT, no PO | **PASS** |
| 12 | Rawnaq dining six | SO-2026-00063 READY_FOR_PRODUCTION, 0 started tasks | **PASS** |

Dealer isolation: Oasis does not see Nile orders. **PASS.**

---

## Mobile Admin

| Screen | Result |
|--------|--------|
| Login | **PASS** |
| Home | **PASS** — Late orders **3**; hero Jabal `SO-2026-00023` |
| Orders list | **PASS** (product titles, photos) |
| Order detail (flagship) | **PASS** |
| Order detail (browse extras) | **PASS** — realistic project names |
| Inventory | **PASS** — warehouse pickers RAW / SEMI / FIN only |
| Production | **PASS** — current work around 16 Aug; Jabal remaining past dates are the late story |
| More → Products | **PASS** — 22 products, photos, Arabic names |
| More → Dealers | **PASS** — Arabic `nameAr` on all 10 |
| More → Purchasing | **PASS** — mix of received / partial / sent; velvet PO SENT |
| More → Invoices | **PASS** — paid / partial / issued; math holds |
| More → Scheduling (calendar) | **PASS** |
| More → Scheduling (at-risk) | **PASS** — i18n `reasonLabel`, no `demo:` |
| More → Workflow | **PASS** |
| More → Returns | **PASS** — 3 returns on delivered SOs only |
| More → Users | **PASS** |
| More → AI chat | **PASS** if unopened. Unused i18n still mentions Jerash / “API not wired” (not a blocker) |

---

## Admin Web

| Screen | Result |
|--------|--------|
| Login | **PASS** |
| Dashboard | **PASS** — delayed orders **3**, same as scheduling |
| Orders hub | **PASS** |
| RFQs / drafts | **PASS** — live intake + reviewed Arabic WhatsApp job |
| Quotations | **PASS** |
| Sales orders list | **PASS** |
| Sales order detail (flagship) | **PASS** |
| Sales order detail (extras) | **PASS** |
| Deliveries | **PASS** — Abdali planned 19 Aug; no future DELIVERED |
| AI intake | **PASS** |
| Products / categories / materials / fabrics | **PASS** |
| Dealers | **PASS** |
| Production board | **PASS** |
| Production order (flagship) | **PASS** including Diwan gated foam |
| Scheduling calendar | **PASS** — Sunday 16 Aug closed is honest |
| Scheduling at-risk | **PASS** — translated reasons, not `demo:` |
| Scheduling awaiting approval | **PASS** — Qasr proposed |
| Workflow templates | **PASS** |
| Stage library | **WARN** — inactive CNC `nameAr: سنس` if filter is `all` (not a go/no-go) |
| Inventory | **PASS** — Italian velvet 0 |
| Warehouses | **PASS** — RAW / SEMI / FIN only |
| Purchasing / suppliers | **PASS** |
| Invoices | **PASS** (3-decimal ILS is real VAT) |
| Employees / staff types | **PASS** |
| Returns | **PASS** |
| Notifications | **PASS** copy; link `http://localhost:3000/purchasing` is still a dev URL |
| Settings | **PASS** |
| Reports | **PASS** for the home/dashboard delayed metric (canonical may-be-late) |

---

## Dealer (portal + mobile)

| Screen | Result |
|--------|--------|
| Login | **PASS** |
| Home (Nile) | **PASS** — isolation holds; recents may still prefer newest extras (realistic names) |
| Catalog | **PASS** |
| New order | **PASS** |
| Orders list | **PASS** |
| Order detail (Abdoun / Sweifieh / QC armchair) | **PASS** |
| Deliveries | **PASS** — no future delivered extras; Abdali planned 19 Aug |
| Account calendar | **PASS** |
| Invoices | **PASS** — Nile sees paid Abdoun + partial loveseat |
| Statement | **PASS** |
| Returns | **PASS** |
| Documents / contracts | **PASS** — honest empty |
| Profile | **PASS** |
| Notifications | **PASS** |
| AI chat | **PASS** if unopened |

---

## Worker (employee web + mobile)

| Screen | Result |
|--------|--------|
| Login `carpenter` / `inspector` | **PASS** — Arabic stage names (`النجارة`, `فحص الجودة`) |
| Home (carpenter) | **PASS** — carpentry in progress from **16 Aug** (`SO-2026-00010`), not 25 Jul |
| Home (inspector) | **PASS** — current August inspections; Jabal’s July inspection is assigned to another QC worker and remains the scheduling LATE exception |
| Open tasks | **PASS** |
| Completed | **PASS** |
| Notifications | **PASS** |
| Profile | **PASS** |

---

## What stayed clean

- Flagship commercial history (Abdoun paid, Nile partial, Zaatar return).
- Cedar materials gate.
- Oasis QC not delivered; historical Nile rework completed then passed then delivered.
- Qasr proposed / Noor draft / Rawnaq not started.
- Dealer Arabic names; 22/22 product photos.
- Invoice totals match payments; SOF-3S-STD Hebrew frame output exists.

---

## Not blockers (do not treat as go/no-go)

- Unused mobile AI i18n still mentions Jerash Furnishings and “live API not wired”.
- Invoice amounts like 471.053 ILS are 3-decimal VAT, not broken money.
- 16 Aug 2026 is Sunday; factory calendar closed is honest.
- Inactive CNC stage `سنس` if the stage library filter is `all`.
- Notification deep-link `http://localhost:3000/purchasing`.
- Jabal remaining allocations still sit in late July — that is the committed-date LATE story, not leftover extras.
