# ACTIVE_WORK

Branch: `main`. This file is the in-flight pointer, not a changelog.

## Landed (this commit)

- Unified web app: `apps/web` (`@maher/web`) on :3000
- Surfaces: `/[locale]/admin`, `/[locale]/dealer`, `/[locale]/worker`
- Auth middleware, session provider, SurfaceGate, PermissionGate, silent refresh
- Floor primitives in `@maher/ui`, token drift test vs mobile colors
- Parity manifest: `apps/web/src/parity/manifest.ts`

## In flight

- None. Unified web overhaul is the current landed stack.

## Open follow-ups

- Web Push (inbox polling is live)
- Offline outbox / biometrics (native-only)
- Physical camera UAT on dest-client (mobile)

## Not this stack

`/run` starts API `:4000` + web `:3000` + Metro `:8081`. Customer/employee portal apps are deleted.
