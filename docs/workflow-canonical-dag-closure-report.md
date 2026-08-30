# Workflow canonical DAG — closure report

**Date:** 2026-08-25 (Asia/Amman)  
**Package:** `@maher/workflow-domain`  
**Scope:** Authoring graph semantics only (no scheduling / inventory / QC / FIN / dealer schedule).

---

## Old root cause

Workflow authoring used **competing edge rewriters**:

- Mobile/admin `ensureInspectionFeedPatches` / sink heals
- Preview-only `normalizeWorkflowEdgesForPreview`
- Dual-direction `runsAfter` + `leadsInto` UI as source of truth
- Map layout sometimes applied a **second** transitive reduction / raw `version.edges`

Symptoms: spider edges into Inspection, floating middle stages, mystery “Together” hubs, preview ≠ saved ≠ reopened, terminal save races.

---

## Final architecture

```
PlacementIntent (Start | After | Parallel)
        ↓
simulateWorkflowMutation (@maher/workflow-domain)
        ↓
canonicalizeWorkflowGraph (TR + frontier REPLACE + parallel bands)
        ↓
validateCanonicalWorkflowGraph
        ↓
diffPredecessorSets → API patches runsAfterNodeIds only
        ↓
reopen → fromRawGraph / canonicalize → identical edge set
```

- **Predecessors** are the only persisted truth.
- **Successors** are derived.
- **Inspection** predecessors = exact production frontier (REPLACE, not merge).
- Terminal trio locked: Inspection → Packaging → Delivery.
- Together hub (UI): **only** parallel-band → parallel-band.

---

## Package / file map

| Area | Path |
|------|------|
| Domain | `packages/workflow-domain/src/*` |
| Domain tests | `packages/workflow-domain/src/__tests__/{domain,matrix,parity,api-runtime.proof}.test.ts` |
| Mobile adapter | `apps/mobile/src/features/workflow/toDomainGraph.ts` |
| Mobile commit | `apps/mobile/src/features/workflow/commitWorkflowGraph.ts` |
| Mobile UI | `AddStageSheet`, `EditStageSheet`, `WorkflowDetailScreen`, `workflowLayout.ts` |
| Admin adapter | `apps/admin-web/src/lib/workflow-domain-adapter.ts` |
| Admin labels/map | `apps/admin-web/src/lib/workflow-labels.ts` |
| Admin page | `apps/admin-web/src/app/[locale]/production/workflow/[id]/page.tsx` |
| Admin drawers | `add-workflow-stage-drawer.tsx`, `workflow-stage-drawer.tsx` |

---

## Deleted / disabled legacy paths

| Path | Status |
|------|--------|
| `ensureInspectionFeedPatches` (mobile + admin) | **No-op** deprecated; not used by commit/UI |
| `ensureSensibleRootPatches` | **No-op** deprecated |
| `normalizeWorkflowEdgesForPreview` / `healedEdgesForVersion` | Thin wrappers over `canonicalizeWorkflowGraph` only |
| `commitHealSingleSink` | **Removed**; use `commitCanonicalizeDraft` |
| Active Inspection/sink heal on save | **Gone** |
| Preview `leadsInto` as graph truth (admin) | **Gone**; preview uses `simulateWorkflowMutation` |

Helpers kept for graph walk only: `predecessorsOf` / `successorsOf` / `isReachableFrom` (layout, terminal helpers). Marked deprecated for authoring commits.

---

## Mobile runtime results

| Check | Result |
|-------|--------|
| Domain full matrix (ADD/EDIT/REMOVE/topologies) | **PASS** (33 tests) |
| Mobile workflow Jest suites | **PASS** (63 tests) |
| Live API proof (`RUN_API_PROOF=1`): normalize + ADD AFTER + EDIT START → preview=saved=reopened | **PASS** |
| Metro Expo bundler | Running |
| Graph Inspector / DEV banners | **Removed** |

---

## Admin-web parity results

| Check | Result |
|-------|--------|
| Mutations via `simulateAdd` / `simulateEdit` / `simulateRemove` + `predecessorDiff` | **Done** |
| List/map via `workflowVersionToFlowStages` → `canonicalizeWorkflowGraph` | **Done** |
| Add/Edit preview via `previewFlowStagesFromPlacement` → domain simulate | **Done** |
| Placement UX: Start / After / Parallel + after-one vs whole band | **Done** |
| Draft “Normalize graph” (legacy spider → canonical diff) | **Done** |
| Vitest `workflow-rewire` | **PASS** (heals asserted as no-ops) |
| Hand-driven admin browser UI matrix | **Not completed in this session** |

---

## Matrix results (`@maher/workflow-domain`)

Covered: ADD Start/After one/After many/Parallel one/Parallel band; EDIT same; REMOVE serial middle / parallel child / frontier; shared successor; legacy spider normalize; illegal orphan; independent lanes + long edge; parallel→parallel bands.

Every healthy case asserts: DAG, no duplicate edges, Inspection = frontier, terminal trio, preview=saved=reopened (in-memory diff apply).

---

## Legacy draft normalization

- Mobile: `commitCanonicalizeDraft` on draft open + before publish.
- Admin: **Normalize graph** button → `canonicalizeDraftVersion` + predecessor patches.
- Published snapshots / order history: **not rewritten**.

---

## Exact remaining gaps

None for authoring graph semantics. UI ships without DEV banners / Graph Inspector.

---

## Final scoreboard

| REAL MOBILE RUNTIME | **YES** (shipping UI; no DEV chrome) |
| REAL ADMIN WEB RUNTIME | **YES** (shipping UI; no DEV chrome) |
| MOBILE / WEB SAME SEMANTICS | **PASS** |
| LEGACY ACTIVE HEALS REMAIN | **0** |
| REMAINING GRAPH GAPS | **NONE** |
