# Production Deployment

Piece 14 deployment rules for applying schema and running the stack safely. Complements [`docs/deployment.md`](./deployment.md).

---

## Migrations (required)

**Production and staging schema changes use Prisma migrate — not demo wipe tools.**

| Do | Do not |
|----|--------|
| `prisma migrate deploy` (with production `DATABASE_URL`) | `pnpm demo:reset` |
| Keep migration history under `packages/database/prisma/migrations/` | `prisma db push --accept-data-loss` on prod |
| Forward-fix bad migrations | Rely on seed/`demo:reset` to “repair” live data |

Examples:

```bash
# From repo root (loads env as your ops process defines)
pnpm --filter @maher/database exec dotenv -e ../../.env -- prisma migrate deploy

# Local development only (creates migrations interactively)
pnpm db:migrate   # → prisma migrate dev
```

`pnpm demo:reset` rebuilds the **presentation/demo factory world**. It is destructive and for explicit local/demo use only.

`scripts/prepare-launch.sh` uses `prisma db push` + seed for **local launch convenience**. Do not use that path as the production deploy pipeline.

---

## Environment variables

Copy from [`.env.example`](../.env.example); override for the host. Minimum production set:

| Area | Variables |
|------|-----------|
| Runtime | `NODE_ENV=production`, `TZ` (e.g. `Asia/Amman`) |
| Database | `DATABASE_URL` |
| Redis | `REDIS_URL` |
| Auth | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (strong, unique); `COOKIE_DOMAIN` / `COOKIE_SECURE` as appropriate |
| App URLs | `API_URL`, `ADMIN_WEB_URL`, portal URLs, `CORS_ORIGINS`, `NEXT_PUBLIC_*` |
| Storage | `LOCAL_UPLOAD_DIR` and/or `STORAGE_PROVIDER` + `S3_*` |
| Business | `DEFAULT_CURRENCY`, `DEFAULT_LOCALE`, `DEFAULT_VAT_RATE`, company name fields |

Optional integrations (`EMAIL_PROVIDER`, `RESEND_API_KEY` / `SMTP_URL`, `WHATSAPP_*`, `TWILIO_*`, AI/OCR keys) — see [`PIECE14-EXTERNAL-INTEGRATIONS.md`](./PIECE14-EXTERNAL-INTEGRATIONS.md). Console defaults mean messages are **not** delivered externally.

Never commit real `.env` or production secrets.

---

## Storage (`STORAGE_PROVIDER`)

| Mode | When | Notes |
|------|------|-------|
| **Local (default)** | `STORAGE_PROVIDER` unset or not `s3` | Files under `LOCAL_UPLOAD_DIR` (default `./uploads`). Prefer a persistent volume in any long-lived host. |
| **S3 / MinIO** | `STORAGE_PROVIDER=s3` plus `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, region/path-style as needed | Opt-in in `apps/api/src/integrations/storage/s3-storage.service.ts`. |

Ephemeral local disk without backup is a production risk — see [`PRODUCTION-BACKUP-RECOVERY.md`](./PRODUCTION-BACKUP-RECOVERY.md).

---

## Seed / demo password policy

| Environment | Policy |
|-------------|--------|
| **Production** | Must **not** auto-seed `admin` / `123` or other demo passwords. Do not run `pnpm db:seed`, `db:seed:demo`, `demo:reset`, or `prepare-launch` seed as part of prod deploy. Create real users with strong passwords (or a one-time break-glass process that is not the default password `123`). |
| **Local / demo** | Seed and demo reset are **explicit** only: `pnpm db:seed`, `pnpm db:seed:demo`, `pnpm demo:reset`, etc. Launch seed documents password `123` for empty accounts — demo-only. |

Default seed (`packages/database/prisma/seed.ts`) hashes password `123` for launch/demo accounts. That is acceptable for local QA; it is **not** an acceptable production bootstrap.

---

## Deploy sketch

1. Build images / apps from a tagged release.
2. Set secrets and env for the target tier.
3. Run **`prisma migrate deploy`**.
4. Start API + worker (+ web apps / reverse proxy).
5. Smoke: `/health` (or ready), login with a **real** admin, read one SO and one inventory row.
6. Do **not** run demo reset or full seed against production data.

Rollback: previous image tag + forward-fix migration if schema already advanced (see `docs/deployment.md`). Database restore only via the backup runbook — never `demo:reset`.
