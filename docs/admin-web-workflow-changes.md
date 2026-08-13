# Admin Web production workflow overhaul — change log

## FILE / PURPOSE

### Docs
- `docs/admin-web-workflow-audit.md` — local UI/route audit (builder matrix, duplicate stage pages, graph already on order/product)
- `docs/admin-web-workflow-api-audit.md` — endpoints, required fields, publish/snapshot, identifier plan
- `docs/admin-web-workflow-redesign.md` — target UX and component split
- `docs/admin-web-workflow-qa.md` — test/QA checklist
- `docs/admin-web-workflow-visual-qa.md` — visual QA pass
- `docs/admin-web-workflow-changes.md` — this file

### API identifiers (backward compatible)
- `apps/api/src/modules/production/workflow/domain/technical-id.ts` — slug, unique suffix, nodeKey, sortOrder, reconnect pairs, stage patch whitelist (never `code`)
- `apps/api/src/modules/production/workflow/domain/index.ts` — re-exports
- `apps/api/src/modules/production/workflow/workflow.controller.ts` — optional `code` / `nodeKey` DTOs; `CreateStageDto` / `UpdateStageDto`; generate library code; strip `code` on PATCH
- `apps/api/src/modules/production/workflow/workflow-version.service.ts` — generate workflow `code`; omit `nodeKey` → stage code; assign node sortOrder; reconnect via `cartesianReconnect`
- `apps/api/src/modules/production/workflow/__tests__/workflow-identifiers.test.ts` — auto-code, collision, rename stability, nodeKey, sortOrder, reconnect

### Admin Web graph
- `apps/admin-web/src/lib/stage-graph-layout.ts` — barycenter lane order + smarter long-edge bridging
- `apps/admin-web/src/lib/workflow-rewire.ts` — port of mobile cycle/candidate/splice helpers (plain TS)
- `apps/admin-web/src/lib/workflow-labels.ts` — localized names + nodes/edges → flow stages + live preview
- `apps/admin-web/src/lib/stage-graph-layout.test.ts` — linear, fork, merge, 15-node determinism
- `apps/admin-web/src/lib/workflow-rewire.test.ts` — cycle, splice, edit patches
- `apps/admin-web/src/components/workflow/production-flow-map.tsx` — `variant="editor"` numbered brand circles, optional dashed ring, selected elevation, error ring
- `apps/admin-web/vitest.config.ts` + `apps/admin-web/package.json` — vitest for layout + rewire only

### Builder UI
- `apps/admin-web/src/app/[locale]/production/workflow/[id]/page.tsx` — orchestrator (no checkbox matrix)
- `apps/admin-web/src/components/workflow/workflow-header.tsx`
- `apps/admin-web/src/components/workflow/workflow-graph-canvas.tsx` — map + visually hidden ordered list
- `apps/admin-web/src/components/workflow/workflow-stage-list.tsx`
- `apps/admin-web/src/components/workflow/workflow-stage-drawer.tsx`
- `apps/admin-web/src/components/workflow/add-workflow-stage-drawer.tsx`
- `apps/admin-web/src/components/workflow/create-stage-form.tsx`
- `apps/admin-web/src/components/workflow/workflow-version-drawer.tsx`
- `apps/admin-web/src/components/workflow/workflow-validation-panel.tsx`
- `apps/admin-web/src/components/workflow/workflow-empty-state.tsx`
- `apps/admin-web/src/components/workflow/workflow-skeleton.tsx`
- `apps/admin-web/src/components/workflow/workflow-drawer.tsx` — side panel from logical `end`
- `apps/admin-web/src/components/workflow/workflow-connection-picker.tsx`
- `apps/admin-web/src/components/workflow/workflow-types.ts`
- `apps/admin-web/src/app/globals.css` — node motion + `prefers-reduced-motion`

### List, library, legacy
- `apps/admin-web/src/app/[locale]/production/workflow/page.tsx` — cards without code; create with three names
- `apps/admin-web/src/app/[locale]/production/workflow/stages/page.tsx` — search, filters, edit/deactivate drawers
- `apps/admin-web/src/app/[locale]/production-stages/page.tsx` — redirect to `/production/workflow/stages`
- `apps/admin-web/src/components/nav-items.ts` — remove nested Production stages CRUD item

### i18n / status
- `packages/i18n/src/messages/{en,ar,he}/production.json` — Leads into merge copy, empty first stage, reconnect, filters, a11y graph strings, etc.
- `packages/i18n/src/messages/{en,ar,he}/statuses.json` — `PUBLISHED`, `ARCHIVED`
- `packages/ui/src/StatusBadge.tsx` — variants for `PUBLISHED` / `ARCHIVED`

## Not changed
- Prisma schema (`code` / `nodeKey` / `sortOrder` remain)
- `/api/v1/production-stages` DTO (seeds/tests)
- Mobile UI
- Publish/snapshot semantics (future orders only)
- Compiler / scheduling
