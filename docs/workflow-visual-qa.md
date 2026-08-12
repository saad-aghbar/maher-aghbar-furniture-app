# Workflow Visual QA Checklist

## Admin Web

### Navigation
- [ ] Production nested nav shows **Workflow** between Scheduling and Production stages
- [ ] `/production/workflow` highlights Workflow tab; other production routes highlight correct tab
- [ ] User without `production.workflow.read` does not see workflow nav item (when permission gating is enabled server-side)

### Workflow list (`/production/workflow`)
- [ ] Cards show localized name, code, active version badge, stage count
- [ ] Empty state when no workflows
- [ ] Create workflow modal validates code + EN/AR names
- [ ] Card navigates to builder

### Workflow builder (`/production/workflow/[id]`)
- [ ] Draft creation from active version works
- [ ] Stages render vertically with index, required/optional badge
- [ ] **Runs after** checkboxes update dependencies (multi-select, not raw graph UI)
- [ ] Add stage: pick library stage OR create inline
- [ ] Required/optional toggle on add and per-node edit
- [ ] Validate surfaces cycle/unreachable errors with i18n codes
- [ ] Publish confirm mentions future orders only
- [ ] Published version shown in active version card

### Stage library (`/production/workflow/stages`)
- [ ] Lists stages from production-stage-library API
- [ ] Create stage form works

### Production order detail
- [ ] Workflow section loads `GET /production-orders/:id/workflow`
- [ ] Vertical DAG with connectors; stage click opens detail panel
- [ ] Detail shows assignee, planned/actual times when present
- [ ] Legacy orders still render (fallback graph)

### Product edit
- [ ] Workflow dropdown lists templates
- [ ] Stage applicability rows: INHERIT / REQUIRED / OPTIONAL / EXCLUDED
- [ ] Save persists via PATCH workflow-configuration

### i18n / RTL
- [ ] EN / AR / HE labels for workflow nav and `production.workflow.*` strings
- [ ] RTL layout: nested nav, vertical DAG, modals

---

## Admin Mobile

### Navigation
- [ ] Production tab → **Workflow** link visible with `production.workflow.read`
- [ ] More / Home quick access tile opens workflow list
- [ ] No new bottom tab added

### Workflow list
- [ ] Cards match web info (name, version, stage count)
- [ ] Pull-to-refresh works

### Workflow detail
- [ ] Vertical stage list + ProductionFlowMap preview
- [ ] Add stage bottom sheet: stage pick, required/optional, runs-after checklist
- [ ] Validate + publish draft (confirmation sheet)
- [ ] Create draft when none exists

### Order flow (admin + dealer)
- [ ] Admin production order flow uses workflow API when snapshot exists
- [ ] Dealer order flow uses workflow API; **no worker names/times/blockers** in dealer sheet
- [ ] Legacy orders fall back to stage list mapping
- [ ] ProductionFlowMap edges reflect workflow dependencies

### Aesthetic
- [ ] Theme tokens (spacing, radius, brand colors) consistent with Production/Scheduling screens
- [ ] Bottom sheets use standard height and safe area padding

---

## Cross-cutting
- [ ] API errors show friendly messages (`WORKFLOW_*` codes)
- [ ] Offline banner does not break workflow screens
- [ ] Permission denied handled gracefully on mobile routes
