# Workflow Database Changes

## Overview

Adds configurable, versioned production workflow templates and per-order snapshots while **retaining** `ProductionStageDefinition.dependsOnCodes` for legacy compatibility and seed/bootstrap.

## New enums

| Enum | Values |
|------|--------|
| `ProductionWorkflowStatus` | `DRAFT`, `ACTIVE`, `ARCHIVED` |
| `ProductionWorkflowVersionStatus` | `DRAFT`, `PUBLISHED`, `SUPERSEDED`, `ARCHIVED` |
| `WorkflowDependencyType` | `HARD` (schema-ready for future `SOFT` / `ANY_OF`) |
| `StageApplicability` | `INHERIT`, `REQUIRED`, `OPTIONAL`, `EXCLUDED` |

## New models

### `ProductionWorkflow`

Master template family (e.g. `STANDARD_FURNITURE`).

- Unique `code`
- Trilingual `nameAr` / `nameEn` / `nameHe` (+ optional descriptions)
- `status`, optional `activeVersionId` (unique FK → published version)
- `archivedAt`, audit fields

**Indexes:** `status`

### `ProductionWorkflowVersion`

Immutable published graphs; editable drafts.

- `@@unique([workflowId, versionNumber])`
- `status`, `name`, `description`, `changelog`
- Publish metadata: `publishedAt`, `publishedById`
- Optimistic concurrency: `revision` (bumped on draft mutations)

**Indexes:** `[workflowId, status]`

### `ProductionWorkflowNode`

Node in a version graph; references stage library (`stageDefinitionId`).

- `@@unique([workflowVersionId, nodeKey])`
- Layout: `sortOrder`, `displayX`, `displayY`
- Defaults: `isRequiredByDefault`, `canBeSkipped`
- Optional duration / department / inspection / photos overrides
- `metadata Json?`

**Indexes:** `[workflowVersionId]`, `[stageDefinitionId]`

### `ProductionWorkflowEdge`

Directed dependency between nodes.

- `fromNodeId` → `toNodeId`, `dependencyType` (v1: `HARD`)
- `@@unique([workflowVersionId, fromNodeId, toNodeId])`

**Indexes:** `[workflowVersionId]`

### `ProductWorkflowConfiguration`

One workflow per catalog product.

- `productId` unique → `workflowId`

**Indexes:** `[workflowId]`

### `ProductWorkflowStageOverride`

Per-product applicability / duration / department overrides.

- `@@unique([configurationId, stageDefinitionId])`
- `applicability`: INHERIT / REQUIRED / OPTIONAL / EXCLUDED

**Indexes:** `[productId]`, `[workflowNodeId]`, `[stageDefinitionId]`

### `ProductionOrderWorkflowSnapshot`

Frozen graph for a production order (runtime authority).

- `productionOrderId` unique
- Source workflow/version/number (`SetNull` on archive)
- `isLegacyBackfill`, customize metadata

**Indexes:** `[sourceWorkflowId]`, `[sourceWorkflowVersionId]`

### `ProductionOrderWorkflowSnapshotNode`

Frozen node fields: codes, multilingual names, required/skipped, estimates, layout.

- `@@unique([snapshotId, nodeKey])`

**Indexes:** `[snapshotId]`, `[stageDefinitionId]`, `[stageCode]`

### `ProductionOrderWorkflowSnapshotEdge`

Frozen edges between snapshot nodes.

- `@@unique([snapshotId, fromNodeId, toNodeId])`

**Indexes:** `[snapshotId]`

## Legacy field retained

`ProductionStageDefinition.dependsOnCodes` remains on the stage library table.

- Used by seed/bootstrap to derive initial workflow edges
- Used by legacy backfill when no snapshot exists
- **Not** authoritative for new orders once a snapshot is created — snapshot edges win at runtime

## Migration / push

```bash
# From repo root after pulling schema changes
pnpm --filter @maher/database exec prisma validate
pnpm --filter @maher/database exec prisma generate
pnpm --filter @maher/database exec prisma db push   # dev / ephemeral
# or
pnpm --filter @maher/database exec prisma migrate dev --name production-workflow
```

Re-seed foundation + demo world:

```bash
pnpm --filter @maher/database db:seed
```

Seed creates `STANDARD_FURNITURE` (v1 PUBLISHED, ACTIVE) and attaches it to active catalog products.

## Rollback notes

1. **Schema rollback:** Drop workflow/snapshot tables in reverse dependency order (edges → nodes → versions → workflows → product configs/overrides → snapshots). Existing `production_stage_instances` / `production_tasks` are unaffected.
2. **Runtime rollback:** Point product configurations back to implicit stage-def ordering by removing `ProductWorkflowConfiguration` rows; orders with snapshots keep frozen graphs until manually migrated.
3. **Do not** drop `dependsOnCodes` on stage definitions — required for legacy backfill and scheduling helpers during transition.
4. Published versions referenced by snapshots must not be hard-deleted; archive instead (`ARCHIVED` status + `archivedAt` on workflow).

## Permissions

Already in `@maher/permissions`: `production.workflow.read`, `production.workflow.write`, `production.workflow.publish`.
