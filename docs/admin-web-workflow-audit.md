# Admin Web production workflow — UI audit

Local inspection of the worktree (not GitHub). Backend DAG, versions, and snapshots already exist. Mobile already has a visual editor. Admin Web is the gap.

## Routes (Admin Web)

| Route | File | What it does today |
|-------|------|--------------------|
| `/production/workflow` | `apps/admin-web/src/app/[locale]/production/workflow/page.tsx` | Card list. Shows localized name **and `row.code`**. Raw `ACTIVE` / `DRAFT` badges (not `StatusBadge` for workflow status). Create modal requires a Code field. |
| `/production/workflow/[id]` | `apps/admin-web/src/app/[locale]/production/workflow/[id]/page.tsx` | **~640-line monolith.** Vertical numbered list + “Runs after” **checkbox matrix**. Shows `nodeKey`. No graph. No “Leads into”. Add-stage modal asks for Code. Publish + validate exist. |
| `/production/workflow/stages` | `apps/admin-web/src/app/[locale]/production/workflow/stages/page.tsx` | Stage library via `/api/v1/production-stage-library`. Create-only; shows `code · #sortOrder`. No edit drawer, no filters. |
| `/production-stages` | `apps/admin-web/src/app/[locale]/production-stages/page.tsx` | **Legacy duplicate CRUD** on the same `ProductionStageDefinition` table via `/api/v1/production-stages`. Nested under Production tabs. |

## Navigation duplication

- Sidebar: Workflow (`/production/workflow`) under Production.
- Nested Production tabs (`nav-items.ts`): Workflow **and** Production stages (`/production-stages`).
- Builder also links to `/production/workflow/stages`.

Two admin surfaces edit the same stage table with different APIs.

## Graph already used — but not on the builder

Admin Web already renders a real DAG:

- `apps/admin-web/src/lib/stage-graph-layout.ts` — topological levels from `dependsOnCodes` (no barycenter yet).
- `apps/admin-web/src/components/workflow/production-flow-map.tsx` — SVG circles + barrel paths; `onStageClick` exists; colors are **runtime progress** (done/active/blocked).
- Used by `order-workflow-section.tsx` (production order) and `product-workflow-times.tsx` (product).

The builder does **not** use these. Order/product views are the reference for the visual language.

No Drawer/Sheet in `@maher/ui`. Admin Web uses `Modal` + `ConfirmDialog`. Components live under `apps/admin-web/src/components/` (not a `features/` tree).

## Mobile editor (UX reference — do not redesign)

| Screen | File |
|--------|------|
| Detail + graph | `apps/mobile/src/features/workflow/WorkflowDetailScreen.tsx` |
| Add | `apps/mobile/src/features/workflow/components/AddStageSheet.tsx` |
| Edit | `apps/mobile/src/features/workflow/components/EditStageSheet.tsx` |
| Rewire / cycle | `apps/mobile/src/features/workflow/rewireWorkflowEdges.ts` |
| Commit | `apps/mobile/src/features/workflow/commitWorkflowGraph.ts` |

Mobile already: numbered circles, Required/Optional, Runs after + Leads into, cycle candidates disabled, create-from-names (client slugs `code`), `nodeKey = stage.code`, reconnect on remove, publish with `futureOrdersOnly`, version history. Client currently **sends** `code` / `nodeKey` — those must keep working.

## i18n / status leaks (found)

- `production.workflow.*` exists in en/ar/he (including `leadsInto`, `canRunInParallel`, `runsAfterHint`, `editingDraft`, `viewingPublished`, `futureOrdersOnly`, `WORKFLOW_VERSION_STALE`).
- List page still shows raw `row.status` (`ACTIVE`) via `Badge`, not `StatusBadge`.
- `PUBLISHED` and `ARCHIVED` are **missing** from `packages/i18n/src/messages/*/statuses.json`.
- Hardcoded English `"Code"` labels on list create, builder add-stage, and stage library.

## Out of scope for this overhaul

- New workflow model / `WorkflowV2`
- React Flow / dagre
- Mobile UI changes
- Mutating published versions or existing order snapshots
- Showing generated codes in everyday UI
