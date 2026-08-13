# Admin Web production workflow — API audit

Local inspection of Nest workflow module. Do **not** invent a parallel model. Identifiers stay in Prisma; humans stop typing them.

## Endpoints (keep)

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/production-workflows` | `production.workflow.read` or `production-order.update` | List (excludes archived) |
| POST | `/production-workflows` | `production.workflow.manage` | Create + draft v1 |
| GET | `/production-workflows/:id` | read | Workflow + versions + activeVersion |
| DELETE | `/production-workflows/:id` | manage | Archive |
| POST | `/production-workflows/:id/versions` | manage | New draft from published (or empty) |
| GET | `/production-workflows/:id/versions` | read | History |
| GET | `/production-workflows/:id/versions/:versionId` | read | Nodes + edges + stage definitions |
| POST | `.../nodes` | manage | Add node + incoming edges |
| PATCH | `.../nodes/:nodeId` | manage | Flags + `runsAfterNodeIds` (replaces incoming) |
| DELETE | `.../nodes/:nodeId?reconnect=` | manage | Default `reconnect=true` (Cartesian pred×succ) |
| POST | `.../validate` | manage | Graph validator |
| POST | `.../publish` | `production.workflow.publish` | Draft → published; `expectedRevision` |
| GET/POST | `/production-stage-library` | stage.manage / manage / read | Workflow-facing library |
| PATCH/DELETE | `/production-stage-library/:id` | `production.workflow.stage.manage` | PATCH has no `code`; DELETE soft-deactivates when referenced |
| * | `/production-stages` | legacy CRUD | **Same table.** Keep for seeds/tests. Web will stop using that page. |

Controller: `apps/api/src/modules/production/workflow/workflow.controller.ts`  
Service: `apps/api/src/modules/production/workflow/workflow-version.service.ts`  
Validator: `apps/api/src/modules/production/workflow/domain/workflow-graph-validator.ts`

## Required fields today (before overhaul)

| Action | Required | Optional / generated |
|--------|----------|----------------------|
| Create workflow (`CreateWorkflowDto`) | `code`, `nameAr`, `nameEn` | `nameHe`, descriptions |
| Create stage (`createStage` inline body) | `code`, `nameAr`, `nameEn` | `sortOrder` → `max+10`; flags |
| Add node (`AddNodeDto`) | `stageDefinitionId`, `nodeKey` | `sortOrder` defaults **0**; `runsAfterNodeIds`; `expectedRevision` |
| PATCH node (`UpdateNodeDto`) | — | connections / flags; **no** `stageDefinitionId` / `nodeKey` |
| PATCH stage | names, flags, `isActive` | **Must never accept `code` change** (inline Partial today — strip `code` explicitly) |
| Publish | — | `expectedRevision` |

`code` on library create is **normalized** (`trim` / upper / spaces → `_`), not generated.  
`nodeKey` is unique per version (`@@unique([workflowVersionId, nodeKey])`). Clients (including mobile) send `stage.code`.

## Publish / snapshot semantics (do not change)

- Mutations only on **DRAFT** versions (`assertDraftMutable`).
- Every draft mutation bumps `revision`; stale `expectedRevision` → `WORKFLOW_VERSION_STALE`.
- Publish activates the version for **future** production orders only (`futureOrdersOnly`).
- Existing production-order snapshots stay frozen. Compiler / scheduling unchanged.

## Permissions

- `production.workflow.read`
- `production.workflow.manage`
- `production.workflow.publish`
- `production.workflow.stage.manage`

## Target identifier behavior (Phase 2)

Keep Prisma `code` / `nodeKey` / `sortOrder`.

- Stage create: `code?`. Omit → slug from `nameEn` (`CUSTOM_FINISH`), unique with `_2`, `_3`…. Explicit code keeps current normalize. Duplicate **display** names allowed.
- Rename `nameEn` later: **do not** change stored `code`.
- Add node: `nodeKey?`. Omit → `stage.code` (suffix on collision in that version). Explicit `nodeKey` still accepted (mobile).
- Create workflow: `code?` from `nameEn` the same way. Require `nameEn` + `nameAr`.
- Node `sortOrder` when omitted: assign `max+1` (not always `0`).
- Do **not** change `/production-stages` DTO.

## Untested today

- Auto-code / collision / rename stability
- Omit `nodeKey` on addNode
- `removeNode` reconnect (Cartesian pred×succ) — implemented, no Jest
