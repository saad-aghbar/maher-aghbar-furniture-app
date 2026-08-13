# Admin Web production workflow — QA checklist

## Backend (Jest, `@maher/api`)

- [ ] Omit stage `code` → generated unique slug from `nameEn` (`CUSTOM_FINISH`)
- [ ] Two “Custom Finish” creates → `CUSTOM_FINISH` then `CUSTOM_FINISH_2` (duplicate display names allowed)
- [ ] Rename `nameEn` → stored `code` unchanged
- [ ] Explicit `code: "CNC"` still works (normalize trim/upper/spaces→`_`)
- [ ] Omit library `sortOrder` → assigned (`max+10`)
- [ ] Omit `nodeKey` on addNode → equals stage code (suffix on collision in that version)
- [ ] Explicit `nodeKey` still accepted (mobile compatibility)
- [ ] `removeNode` reconnect: pred×succ Cartesian edges; currently untested — add coverage
- [ ] Existing `workflow-domain.test.ts` still passes
- [ ] Existing `workflow-parallel.test.ts` still passes (Foam + Painting → Upholstery)

## Admin Web graph / rewire (Vitest)

- [ ] Linear path: levels 0..n-1, one node per level
- [ ] Fork: siblings same level, distinct lanes
- [ ] Merge: join node one level after both parents
- [ ] 15-node graph: layout completes, deterministic
- [ ] Cycle detection: `wouldCreateCycle` true for A→B→A
- [ ] Barycenter: parallel branches stay symmetric (not scrambled on re-layout)

## Builder UX (manual)

- [ ] Graph is the primary surface; no checkbox matrix on the main page
- [ ] Click stage opens drawer; Escape closes; focus visible; RTL drawer from logical end
- [ ] Codes / nodeKeys / sortOrder hidden in everyday UI
- [ ] Add existing: used stages hidden; search by localized name
- [ ] Create new: EN + AR required, HE collected; no code field
- [ ] Required / Optional segmented control
- [ ] Runs after + Leads into; cycle candidates disabled
- [ ] Parallel copy (`canRunInParallel` / `runsAfterHint`) and merge sentence shown
- [ ] Live preview updates from drawer selections before save
- [ ] Remove confirms reconnect; `reconnect=true`
- [ ] Publish confirm: `futureOrdersOnly`; existing PO snapshots unchanged
- [ ] Published version read-only; Create draft → vN+1
- [ ] Stale revision shows `WORKFLOW_VERSION_STALE` human copy
- [ ] Empty: “Add the first stage…” CTA
- [ ] Loading: graph-shaped skeleton

## Library + list + legacy

- [ ] Stage library: search, All/Active/Inactive/inspection/photos, edit drawer, deactivate
- [ ] `/production-stages` redirects to `/production/workflow/stages`
- [ ] Nested nav no longer lists Production stages as a separate CRUD page
- [ ] Workflow list cards: names + stage count + status pills; **no code**
- [ ] Create workflow: three names, no code

## i18n / a11y / motion

- [ ] `production.workflow.*` leaf-key parity en/ar/he
- [ ] `PUBLISHED` and `ARCHIVED` in `statuses.json` all locales; `StatusBadge` never raw enums
- [ ] No hardcoded `"Code"` labels
- [ ] Graph companion: visually hidden ordered list
- [ ] Keyboard: Tab, Escape, visible focus
- [ ] RTL: drawer from `end`; edge semantics **not** reversed
- [ ] Topology animation 200–350ms; `prefers-reduced-motion` skips transform

## Regression (no mobile redesign)

- [ ] Mobile still sends `code` / `nodeKey` — APIs accept them
- [ ] Compiler / snapshot / scheduling untouched
- [ ] Smoke: parallel Foam+Painting → Upholstery
- [ ] Dealer order graph still renders
- [ ] Worker tasks unchanged

## Commands

```text
pnpm --filter @maher/api test          # at least workflow files
pnpm --filter @maher/api typecheck
pnpm --filter @maher/admin-web typecheck
pnpm --filter @maher/i18n build
pnpm --filter @maher/admin-web build
pnpm --filter @maher/admin-web test    # vitest: layout + rewire only
```

Rebuild + restart **admin-web only** (`next start` on :3000). Do not seed the DB.
