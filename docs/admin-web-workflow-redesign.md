# Admin Web production workflow — redesign

Target UX for a non-technical factory owner. Same backend DAG. Desktop layout inspired by mobile sheets, not a checkbox matrix.

## Principles

1. Humans name stages and connect them. The server owns `code`, `nodeKey`, `sortOrder`.
2. The graph is the primary editor, not a debug view of IDs.
3. Reuse `ProductionFlowMap` + `stage-graph-layout.ts`. No React Flow / dagre.
4. Match mobile: Required/Optional, Runs after, Leads into, cycle candidates disabled, reconnect on remove, publish = future orders only.
5. Published versions are read-only. Edits go to draft vN+1.

## Information architecture

```text
/production/workflow                 list + create (names only)
/production/workflow/[id]            visual builder
/production/workflow/stages          stage library (search, filters, edit drawer)
/production-stages                   redirect → /production/workflow/stages
```

Remove nested nav item for `/production-stages`. Keep `/api/v1/production-stages` for seeds.

## Builder layout

```text
┌─────────────────────────────────────────────┬──────────────┐
│ Header: name, draft/published pills,        │              │
│ Publish, Versions, Add stage                │  Drawer      │
├─────────────────────────────────────────────┤  (logical    │
│ Graph canvas (full width until a stage      │   end)       │
│ is selected). Numbered circles, brand       │              │
│ accent. Click → drawer.                     │              │
├─────────────────────────────────────────────┤              │
│ Compact numbered list (companion + a11y)    │              │
└─────────────────────────────────────────────┴──────────────┘
```

No checkbox matrix on the main page.

### Graph (editor mode)

- Numbered circles, optional dashed ring for optional stages, selected elevation, validation error ring.
- Config graph uses **brand accent**, not runtime progress colors.
- Map version `nodes` + `edges` → `FlowMapStage` (`dependsOnCodes` from incoming edges).
- Fit/zoom/pan only if a ~15-node graph overflows; default workflows readable with no controls.
- Memoize layout; do not recompute on hover.
- Barycenter lane ordering (port from mobile `stageGraphLayout.ts`) for branch symmetry.
- Animate topology changes (200–350ms CSS; respect `prefers-reduced-motion`).
- Visually hidden ordered list: “Stage 1: Carpentry. Starts the workflow.”

### Stage drawer (click)

Escape closes, focus trap, RTL: panel from logical `end` (left in ar/he). Show localized name, required/optional, Starts after, Leads into, duration, department, Edit, Remove. Hide IDs/codes.

Remove: confirm with reconnect explanation; `DELETE ?reconnect=true`.

### Add stage drawer

Segmented: **Existing** (search library, hide already-used) vs **Create new** (EN/AR/HE names → then department / time / inspection / photos). Segmented Required/Optional. Runs after + Leads into; cycle candidates disabled. Human copy for parallel (`canRunInParallel` / `runsAfterHint`) and merge.

Live preview: drawer selections update a small graph preview; save PATCHes `runsAfterNodeIds` (Leads into = patch successors, same as mobile `commitWorkflowGraph`).

### Publish / versions

Compact pills: `editingDraft` / `viewingPublished`. Publish confirm uses `futureOrdersOnly`. Version history drawer (View / create draft). Keep `expectedRevision`. Human message for `WORKFLOW_VERSION_STALE`.

## Component split (`apps/admin-web/src/components/workflow/`)

| File | Role |
|------|------|
| `workflow-header.tsx` | Title, pills, actions |
| `workflow-graph-canvas.tsx` | `ProductionFlowMap` + a11y list |
| `workflow-stage-list.tsx` | Compact numbered rows |
| `workflow-stage-drawer.tsx` | Edit / remove selected node |
| `add-workflow-stage-drawer.tsx` | Existing vs create |
| `create-stage-form.tsx` | Names + department/time/flags |
| `workflow-version-drawer.tsx` | History |
| `workflow-validation-panel.tsx` | Issue list |
| `workflow-empty-state.tsx` | “Add the first stage…” |
| `workflow-skeleton.tsx` | Graph-shaped loading |
| `workflow-drawer.tsx` | Side panel (logical end) |

Lib:

- `apps/admin-web/src/lib/workflow-rewire.ts` — port of mobile rewire helpers (plain TS)
- `apps/admin-web/src/lib/workflow-labels.ts` — localized names + nodes/edges → flow stages

## Stage library

Search by localized names. Filters: All / Active / Inactive / inspection / photos. Compact cards. Drawer edit (names, department, duration, flags, active). Deactivate instead of hard delete. No code/sortOrder in everyday UI.

## Workflow list / create

Premium cards: localized name, stage count, published/draft pills — **no `row.code`**. Create: three names, no code field.

## Empty / loading / error

- Loading: graph-shaped skeleton, not one beige block.
- Empty: “Add the first stage…” CTA.
- Error: existing `ErrorState` + retry.
