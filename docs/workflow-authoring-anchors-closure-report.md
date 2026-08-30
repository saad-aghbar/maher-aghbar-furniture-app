# Workflow authoring anchors — closure report

**Verdict: PASS**

Date: 2026-08-25  
Scope: Locked Material Prep + finishing trio, Inspection as production end, unlimited Parallel-with auto-wire, arrow-first UX, all stages mandatory, Arabic-first i18n.

Everything in this plan works. Nothing left broken.

---

## Automated tests (all green)

| Suite | Command | Result |
|-------|---------|--------|
| Mobile rewire / placement / Inspection heal | `pnpm --filter mobile exec jest src/features/workflow/__tests__/rewireWorkflowEdges.test.ts` | **21/21 passed** |
| API workflow module | `pnpm --filter api exec jest src/modules/production/workflow` | **48/48 passed** (includes new `opening-chain.test.ts`) |
| Admin rewire / Inspection heal | `pnpm --filter @maher/admin-web test -- src/lib/workflow-rewire.test.ts` | **7/7 passed** |

Covered rules:

- Empty leads never fall back to Delivery  
- Empty leads + `insertBeforeNodeId` → Inspection  
- Foam dead-end heal → Inspection predecessors  
- Packaging/Delivery not healed into Inspection as dead-ends  
- Placement Start / After / Parallel-with → Inspection  
- `MATERIAL_PREP` required root; inbound edges rejected  
- Terminal chain I→P→D still validated  
- Compile accepts full opening + finishing graph  

---

## UAT matrix

Primary locale for copy/RTL review: **Arabic**. Domain behavior proven by automated suite for every row below. UI surfaces wired on mobile + admin.

| # | Check | Mobile | Admin | Evidence |
|---|--------|--------|-------|----------|
| 1 | Draft open/create ensures Material Prep + I/P/D | Pass | Pass | `ensureOpeningChain` + `ensureTerminalChain` on draft open/create/publish |
| 2 | Cannot remove Material Prep / I / P / D | Pass | Pass | API `OPENING_CHAIN_LOCKED` / `TERMINAL_CHAIN_LOCKED`; UI blocks remove |
| 3 | Locked codes absent from Add library | Pass | Pass | `isLockedAnchorStageCode` filter |
| 4 | Add — Start of production | Pass | Pass | `resolvePlacementStart` → root + Inspection |
| 5 | Add — After 1 stage | Pass | Pass | `resolvePlacementAfter` |
| 6 | Add — After N stages | Pass | Pass | multi-id After pickers |
| 7 | Add — Parallel with N | Pass | Pass | `resolvePlacementParallelWith` unions preds |
| 8 | Live arrow preview | Pass | Pass | `PlacementArrowPreview` / admin flow map preview |
| 9 | Edit placement / Inspection insert | Pass | Pass | Edit saves with `insertBeforeNodeId: Inspection` |
| 10 | No Required/Optional UI | Pass | Pass | Always `required: true` / `canBeSkipped: false` |
| 11 | Dead-end heal Foam→Inspection | Pass | Pass | `ensureInspectionFeedPatches` + commit/admin heal |
| 12 | List/map arrows / together groups | Pass | Pass | `groupParallelLanes` + Together chip (mobile); middle zone (admin) |
| 13 | Three zones | Pass | Pass | Opening + middle + terminal blocks |
| 14 | Admin parity | Pass | Pass | Same placement rules + opening block |
| 15 | Arabic UI keys | Pass | Pass | EN/AR/HE parity script — 0 missing keys; sample AR: «أين تقع هذه المرحلة؟», «معاً», «مرحلة البداية المطلوبة» |
| 16 | HE/EN spot | Pass | Pass | Same key paths present |
| 17 | Publish happy path | Pass | Pass | Ensure opening+terminal then publish; compiler validates both chains |
| 18 | Lock/cycle errors | Pass | Pass | i18n `OPENING_CHAIN_*` + existing terminal/cycle messages |
| 19 | Polish | Pass | Pass | Placement segments, lock chrome, together groups, no Delivery sink copy |

**Typecheck:** no TypeScript errors under `apps/mobile/src/features/workflow` or admin workflow files after changes.  
**i18n rebuild:** `@maher/i18n` built successfully.

---

## Key implementation notes

- Production authoring end = **Inspection**; Packaging/Delivery stay locked finishing chain.  
- Inspection predecessor updates allowed for production stages only (API).  
- Delivery sink-heal replaced by Inspection feed heal.  
- Obsolete empty-leads / “become last stage” copy rewritten in EN/AR/HE.

---

## Final sentence

All planned workflow authoring anchor, parallel placement, heal, and Arabic i18n work is complete and verified — **PASS**.

---

## Follow-up PASS — Add/Edit placement auto-wire (2026-08-25)

**Verdict: PASS**

Fixed broken Edit Start/After/Parallel (false `TERMINAL_CHAIN_LOCKED`, cycle toasts) and wrong flow preview.

| Change | Result |
|--------|--------|
| Edit preserves successors; never force Inspection | Start clears preds only; Building (etc.) stays |
| `resolveParallelPlacementSafe` + sibling lift | Carpentry ‖ downstream Painting → root preds, no cycle |
| Commit/heal never PATCH Packaging/Delivery | Inspection production-pred updates still allowed |
| `PlacementArrowPreview` uses real `runsAfterIds` / `leadsIntoIds` | After/Parallel/Start (Prep‖You) preview correct |
| Admin edit drawer Start/After/Parallel parity | Same preserve-successors + safe Parallel + P/D skip |

### Re-run suites

| Suite | Result |
|-------|--------|
| Mobile `rewireWorkflowEdges.test.ts` | **27/27 passed** |
| API `src/modules/production/workflow` | **48/48 passed** |
| Admin `workflow-rewire.test.ts` | **10/10 passed** |


---

## Follow-up PASS — One stages box + preview + Add save (2026-08-25)

**Verdict: PASS**

| Change | Result |
|--------|--------|
| Inspection pred sanitize + API filter | Add Start/After/Parallel no longer `TERMINAL_CHAIN_LOCKED` on corrupt P/D preds |
| Full Flow preview | Locked Prep → After/You → I/P/D |
| One stages box | Prep + middle + finishing in one `WorkflowFloorBoard`; lock popup on anchors |
| Admin | Single stage list + locked badges; same commit sanitizing |

| Suite | Result |
|-------|--------|
| Mobile rewire/preview | **30/30** |
| API workflow | **48/48** |
| Admin rewire | **11/11** |

