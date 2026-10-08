# ACTIVE_WORK

Branch: `main`. This file is the in-flight pointer, not a changelog.

## Landed (this commit)

- Unified web app: `apps/web` (`@maher/web`) on :3000
- Surfaces: `/[locale]/admin`, `/[locale]/dealer`, `/[locale]/worker`
- Auth middleware, session provider, SurfaceGate, PermissionGate, silent refresh
- Floor primitives in `@maher/ui`, token drift test vs mobile colors
- Parity manifest: `apps/web/src/parity/manifest.ts` (routes + `API_PARITY` rows; contract test greps each row's file)
- Full-site QA pass: spec-correct sheet, quotation cost hints (`GET /quotations/:id/cost-hints`, web + mobile), branded PDF+CSV report exports, `TextArea autoGrow`, stage Estimated/Actual/Live panel, shared `StageAssignSheet` (day slots) on plan + hub, workflow-change invalidation, return-to-bin (`locationId`), fabric parity (order tracker, supplier WhatsApp, task take-in/disposition), worker gates (inspector checklist, packer confirm, recovery floor), redirect stubs repointed to real pages, sessions with `sid` + "sign out other devices", `relocateLot` balance-preserving WIP moves

## In flight

- Demo reset is a 30-day factory (`seededWorld: demo-factory-v2`). Pin `DEMO_AS_OF=2026-10-08` for the checked world (57 sales orders). `pnpm demo:reset` backs up `maher_erp`, drains only this app's Redis queues, writes real files under `uploads/demo/`, then `pnpm demo:validate`. `pnpm demo:live-uat` fails if the API is down. Empty launch world remains `pnpm db:seed`.

## Open follow-ups

- Web Push (inbox polling is live)
- Offline outbox / biometrics (native-only)
- Physical camera UAT on dest-client (mobile)

## Not this stack

`/run` starts API `:4000` + web `:3000` + Metro `:8081`. Customer/employee portal apps are deleted.
