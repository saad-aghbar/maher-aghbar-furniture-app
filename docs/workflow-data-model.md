# Workflow Data Model

## Enums

- `ProductionWorkflowStatus`: `DRAFT | ACTIVE | ARCHIVED`
- `ProductionWorkflowVersionStatus`: `DRAFT | PUBLISHED | SUPERSEDED | ARCHIVED`
- `WorkflowDependencyType`: `HARD` (schema-ready for future `SOFT` / `ANY_OF`)
- `StageApplicability`: `INHERIT | REQUIRED | OPTIONAL | EXCLUDED`

## ProductionWorkflow

Logical template family (`SOFA_STANDARD`, `CHAIR_STANDARD`, …).

- Unique `code`
- `nameAr` / `nameEn` / `nameHe`
- Optional descriptions
- `status`, `activeVersionId?`, archive + audit fields

## ProductionWorkflowVersion

- `workflowId`, `versionNumber` — `@@unique([workflowId, versionNumber])`
- `status`, `name`, `description?`, `changelog?`
- Publish metadata (`publishedAt`, `publishedById`)
- Published versions are **immutable**

## ProductionWorkflowNode

- Refs `stageDefinitionId` (library stage; no per-workflow stage duplication)
- `nodeKey` unique per version
- Layout: `displayX` / `displayY`, `sortOrder`
- `isRequiredByDefault`, `canBeSkipped`
- Optional duration / department / inspection / photos overrides
- `metadata Json?`

## ProductionWorkflowEdge

- `fromNodeId` → `toNodeId`, `dependencyType` (v1: `HARD`)
- `@@unique([workflowVersionId, fromNodeId, toNodeId])`
- Merge semantics: multiple inbound edges ⇒ all predecessors required

## ProductWorkflowConfiguration

- `productId` unique → `workflowId`
- Uses workflow’s active published version at compile time

## ProductWorkflowStageOverride

- Product + node/stage reference
- `applicability`: INHERIT / REQUIRED / OPTIONAL / EXCLUDED
- Optional duration / department overrides

## ProductionOrderWorkflowSnapshot

- `productionOrderId` unique
- Source workflow/version/number
- Customize metadata

### SnapshotNode

Frozen: stage code, multilingual names, required/skipped, estimates, dept, layout, `sourceWorkflowNodeId?`

### SnapshotEdge

Frozen edges between snapshot nodes

## Deletion policies

- Historical snapshots **survive** master workflow archive (`Restrict` / `SetNull` on source FKs as needed)
- Stage definitions: **deactivate**, never hard-delete when referenced by history

## Legacy field

`ProductionStageDefinition.dependsOnCodes` retained during transition. Authoritative for new/backfilled orders = snapshot edges.
