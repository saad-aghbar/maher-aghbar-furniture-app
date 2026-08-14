# Scripts

Flat on purpose. Root `package.json` points at these paths. Do not nest without updating every command.

## Launch / stop

| File | Command |
|------|---------|
| `prepare-launch.sh` | `pnpm prepare:launch` |
| `launch.sh` | `pnpm launch` |
| `start-all.sh` | `pnpm start:all` |
| `stop-all.sh` | `pnpm stop:all` |

## Smoke / UAT

| File | Command |
|------|---------|
| `smoke-pdf-lifecycle.mjs` | `pnpm smoke:lifecycle` |
| `smoke-workflow-critical-path.mjs` | `pnpm smoke:workflow` |
| `smoke-scope-isolation.mjs` | `pnpm smoke:scope` |
| `smoke-factory-uat.mjs` | `pnpm smoke:factory-uat` |
| `factory-lifecycle-uat.mjs` | `pnpm smoke:factory-lifecycle` (88 assertions) |

Needs a running API. Factory lifecycle also needs launch dealer `nile` and `pnpm db:seed:factory-uat` / `seed:factory-uat-only`.

## Maintenance

| File | Role |
|------|------|
| `encode-brand-logo.mjs` | Regenerates UI brand data URIs |
| `generate-watermark-field.py` | Mobile watermark PNGs |
| `apply-arabic-glossary.py` | One-time i18n glossary |
| `patch-arabic-remaining-i18n.py` | One-time i18n leftover keys |
| `check-boundaries.mjs` | `pnpm check:boundaries` |

Database seeds live under `packages/database/prisma/`, not here.
