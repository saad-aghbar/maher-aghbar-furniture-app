# Workflow Implementation Final Report (§103)

## 1. Architecture discovered
Production was live-global-definition-driven: confirm cloned all active `ProductionStageDefinition` rows; readiness/scheduling read live `dependsOnCodes`. No versioned templates or order snapshots.

## 2. Existing models reused
`ProductionStageDefinition`, `ProductionStageInstance`, `ProductionOrder`, `ProductionTask`, `TaskTimeEntry`, `TaskBlocker`, `ProductStageEstimate`, `ProductProductionProfile`, `WorkerSkill`, `ProductionSchedule`, `ScheduleAllocation`, `FactoryCalendar`, audit events, notifications, scheduling planner.

## 3. Models added
`ProductionWorkflow`, `ProductionWorkflowVersion`, `ProductionWorkflowNode`, `ProductionWorkflowEdge`, `ProductWorkflowConfiguration`, `ProductWorkflowStageOverride`, `ProductionOrderWorkflowSnapshot`, `ProductionOrderWorkflowSnapshotNode`, `ProductionOrderWorkflowSnapshotEdge` + enums.

## 4. Migration summary
Schema applied via `pnpm db:push` + `prisma generate`. `dependsOnCodes` retained. See `docs/workflow-database-changes.md`.

## 5. Backfill summary
`packages/database/prisma/scripts/backfill-workflow-snapshots.ts` (idempotent, `DRY_RUN=1` supported). Dry-run against local DB: 0 orders needing snapshot.

## 6. Workflow compiler
Pure `compileWorkflow` with optional/excluded edge rewrite + transitive reduction. Tests cover exclude painting, parallel/merge, skip.

## 7. Versioning
Draft → validate → publish transaction; prior PUBLISHED → SUPERSEDED; revision stale → `WORKFLOW_VERSION_STALE`; published immutable.

## 8. Snapshot
Confirm path compiles product workflow and persists snapshot + instances + tasks in one transaction.

## 9–11. Product applicability / optional / readiness
Product overrides + order skip/customize; pipeline uses snapshot edges; SKIPPED satisfies predecessors; weighted progress.

## 12–15. Assignment / scheduling / timers / blockers
Existing WorkerSkill + scheduling assignment kept; planner deps from snapshot; timer complete → unlock from snapshot; blockers unchanged.

## 16–20. UI surfaces
Admin Web: `/production/workflow` list/builder/stages + product config + order workflow section.  
Admin Mobile: workflow list/detail + AddStageSheet.  
Dealer Web: `DealerOrderWorkflowGraph` on order detail.  
Dealer Mobile: wired to workflow API.  
Worker: no workflow graph.

## 21. Graph rendering
`@maher/workflow-graph` shared layout; mobile ProductionFlowMap; admin/dealer vertical graphs.

## 22–24. i18n / permissions / APIs
`production.workflow.*` + mobile keys en/ar/he; six new permissions; REST under production-workflows / stage-library / order workflow.

## 25–27. Tests / builds
Workflow domain tests: 15 passed. Permissions workflow tests passed. API + admin-web typecheck passed. Layout package tests passed.

## 28. Visual QA
Checklist in `docs/workflow-visual-qa.md` (manual capture still recommended for screenshot sign-off).

## 29–31. File lists
See `docs/workflow-web-changes.md`, `docs/workflow-mobile-changes.md`, `docs/workflow-database-changes.md`.

## 32. Known limitations
- Full canvas drag-to-connect / undo-redo on web is structured-editor first (runs-after), not a full node-editor.
- WorkerSkill admin UI enhancement may still use existing employee screens.
- Smoke E2E against running API not executed in this session (needs live stack).
- Mobile full typecheck still has pre-existing unrelated errors.
- Order customize after start is locked (no manager override path beyond skip refusal).
- AI intake proposal for optional stages is guard-documented; no auto-mutation of templates.
