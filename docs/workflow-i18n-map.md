# Workflow i18n Map

## Namespace

Web: `production.workflow.*` in `packages/i18n/src/messages/{en,ar,he}/production.json`  
Mobile: `mobile.production.workflow.*` (+ existing `mobile.productionFlow.*` extensions)

## Required keys (all locales)

- title, subtitle, newWorkflow, stageLibrary, versionHistory  
- activeVersion, draftVersion, publish, publishConfirm, futureOrdersOnly  
- addStage, createStage, editStage, stageName, department, estimatedDuration  
- required, optional, excluded, runsAfter, dependencies, parallel  
- requiresInspection, requiresPhotos, removeStage, reconnectDependencies  
- invalidCycle, unreachableStage, preview, customizeOrder, orderSnapshot  
- emptyWorkflow, emptyStages, loadError, retry, workerAssignmentRequired  
- canRunInParallel, runsAfterHint, versionSuperseded, createDraft  

## Dynamic names

Stage / snapshot names come from DB fields (`nameAr` / `nameEn` / `nameHe`) via locale — **not** static translation files.

## Errors

Map `WORKFLOW_*` / `ORDER_WORKFLOW_LOCKED` codes to translated UI strings.

## RTL

Text/sheets/chrome mirror. **Do not reverse dependency edge direction.**
