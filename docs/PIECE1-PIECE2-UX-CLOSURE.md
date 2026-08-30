# PIECE 1 + PIECE 2 — UX / LOGIC CLOSURE

## Scores

| Area | Score | Notes |
|---|---|---|
| DOMAIN | PASS | Release still POs+snapshot+reserve once; no schedule/assignment; confirm gated |
| COUNT-LIST | PASS | Customer Requests badge uses `open_inbox` + `meta.totalItems` |
| JOURNEY | PASS | `adminOrderJourney` single classifier; Preparing = DRAFT + 0 POs / not RELEASED |
| REQUEST | PASS | Human phase banner; post-accept → Preparing/Setup copy |
| PREPARING | PASS | Journey cards + readiness/CTA via OrderBoardCard language |
| ATTENTION | PASS | reasonCode + severity + action on cards |
| SETUP HOME | PASS | Journey steps + Ready≠Shortage + sticky dock |
| LINE | PASS | Spec/Fabric/Materials/Workflow/Refs/Notes/Cost dossier |
| FABRIC | PASS | Requested vs selected vs expected qty |
| ESTIMATED COST | PASS | API `buildMaterialCostMap`; unavailable ≠ silent $0 |
| SAFE AREA | PASS | `JourneyStickyDock` / `SURFACE_TAB_BAR_CLEARANCE` |
| SEARCH | PASS | Desk-scoped search; RFQ subchips within open_inbox |
| VISUAL | PASS (code) | Maher OrderBoardCard / ManufacturingCost aesthetic |
| EN / AR / HE | PASS | New journey/setup/fabric/cost/attention/rfqInbox strings |
| HANDSET | **PENDING** | Not observed on device in this pass |

---

## A. Journey audit (count ≡ list)

| Bucket | Entity | API / filter | Count source | List source |
|---|---|---|---|---|
| Customer Requests | RFQ | `GET /requests?statusGroup=open_inbox` | `meta.totalItems` | Same query `data` (+ subchip client filter) |
| Preparing | SO | Client `classifyAdminOrderJourney` | Loaded SO stream bucket count | Same classifier |
| In production / Ready / Shipped / Delivered | SO+delivery | Same | Loaded stream | Same |
| Attention | Cross-cut | Same + reason | Loaded stream | Cards show reason+action |

**Root cause fixed:** Badge no longer uses unfiltered `adminRfqCards.length` while list used `waiting_review`.

---

## Exact handoff script

1. `admin` / `123` → Mobile → Orders → **Customer requests** badge total = list `meta.total` / open inbox semantics  
2. Subchips: All open / Waiting / Needs info / Quoted / Drafts  
3. → Sales Orders → **Preparing** → `SO-P2-E` → Prepare production → Ready + Material shortage + estimated costs  
4. → Line → **Fabric** section + **Cost** summary (unavailable not silent zero)  
5. → `SO-P2-F` / release path → POs exist, no schedule, Worker assignment banner  
6. **Attention** card shows reason + Fix/Review action  
7. AR/HE RTL smoke on Setup home  

Accounts: `admin` / `oasis` / `nile` password `123`.  
Fixtures: `RFQ-P1-*`, `SO-P1-*`, `SO-P2-A`…`F` (E = Ready + Shortage).

---

## File change groups

- Journey: `adminOrderJourney.ts`, `adminOrderLifecycle.ts`, `selectOrderCard.ts`, `OrdersListScreen.tsx`, `OrdersSignatureHome.tsx`, `OrdersProgressCard.tsx`, `AdminLifecycleTray.tsx`
- Types: `packages/types/.../order-presentation.ts` (`open_inbox`)
- Setup cost API: `order-production-setup.service.ts`
- Setup UI: Fabric/Cost sections, sticky journey dock, home/line screens
- Request boundary: `AdminRequestDetailScreen.tsx`
- i18n: en/ar/he `mobile.json`
- Tests: `adminOrderJourney.test.ts`, types presentation tests
- Docs: this file

---

## Domain freeze (P)

- Release does **not** call `scheduling.generate`
- Confirm remains `SETUP_INCOMPLETE` unless setup RELEASED
- No Piece 3 assignment/scheduling UX, DAG, SEMI/FIN, QC edits in this pass

---

## Z. STOP

Piece 1+2 UX/logic closure complete for implementation scope. **Do not start Piece 3.**
