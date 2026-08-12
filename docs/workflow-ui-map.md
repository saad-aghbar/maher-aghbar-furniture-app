# Workflow UI Map

## Admin Web

| Route | Purpose |
|-------|---------|
| `/production/workflow` | Workflow template cards |
| `/production/workflow/[id]` | Builder + draft edit |
| `/production/workflow/[id]/versions` | Version history |
| `/production/stages` or Stage Library | Reusable stage definitions |
| Product edit → Production Workflow | Applicability overrides |
| `/production/[id]` → Workflow panel | Snapshot graph + customize |

Nav: Production → Overview / Scheduling / **Workflow** / Stage Library / Quality.

## Admin Mobile

Production → Workflow (submenu, not a new bottom tab):

- Active workflow card, templates, Stage Library, versions  
- Detail: vertical scrollable dynamic graph  
- Edit via bottom sheets (add stage, runs after, optional, publish)

## Dealer Mobile / Web

Order Details → Production Progress only. Dynamic snapshot graph. No management. No workers/blockers/capacity. Home may show progress % only.

## Worker

No workflow graph. Assigned tasks only.

## Shared graph

One layout engine (layered DAG). Platform renderers:

- Mobile: `ProductionFlowMap` (existing aesthetic)  
- Web: SVG renderer from same layout output  

Statuses: COMPLETED / IN_PROGRESS / READY / PENDING / SKIPPED / BLOCKED with semantic theme tokens.
