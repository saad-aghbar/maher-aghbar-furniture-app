# Workflow Admin Mobile Changes

## Navigation
- `apps/mobile/src/features/admin-home/adminOverflowModules.ts` — Workflow module (More + Home quick access)
- `apps/mobile/src/features/production/ProductionOverviewScreen.tsx` — workflow shortcut link on Production tab
- `packages/i18n/src/messages/{en,ar,he}/mobile.json` — `adminHome.navWorkflow` / `navWorkflowHint`

## Routes
- `apps/mobile/app/(app)/(admin)/production/workflow/index.tsx`
- `apps/mobile/app/(app)/(admin)/production/workflow/[id].tsx`

## Feature module
- `apps/mobile/src/api/modules/workflow.ts` — API client
- `apps/mobile/src/api/queryKeys.ts` — workflow query keys
- `apps/mobile/src/features/workflow/query.ts` — React Query hooks
- `apps/mobile/src/features/workflow/WorkflowListScreen.tsx`
- `apps/mobile/src/features/workflow/WorkflowDetailScreen.tsx`
- `apps/mobile/src/features/workflow/components/AddStageSheet.tsx`

## Dealer / order flow
- `apps/mobile/src/features/production-flow/selectProductionFlowFromWorkflowGraph.ts` — map order workflow API → flow model
- `apps/mobile/src/features/production-flow/ProductionFlowScreen.tsx` — prefers `GET /production-orders/:id/workflow` when stages exist; dealer path strips worker fields via existing `enforceDealerStageStrip`

## i18n
Uses `mobile.production.workflow.*` keys.
