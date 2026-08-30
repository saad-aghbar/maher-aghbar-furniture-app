# Production Backup & Recovery

Piece 14 ops documentation. **This file describes what must be protected and how to think about recovery.** It does **not** claim that automated backups, WAL archiving, or off-site replicas are configured in this environment.

Related (aspirational / older guidance): [`docs/backups.md`](./backups.md) — treat RPO/RTO and “daily + PITR” there as **targets**, not evidence that jobs are running.

---

## What must be backed up

| Asset | Why | Typical location |
|-------|-----|------------------|
| **PostgreSQL database** | All business state (orders, inventory txs, finance, workflow snapshots, audit) | Managed Postgres or Docker volume (`pgdata` in compose) |
| **Uploads / object files** | Product images, attachments, QC photos, documents | Local: `LOCAL_UPLOAD_DIR` (default `./uploads` per `.env.example`). Optional S3/MinIO when `STORAGE_PROVIDER=s3` |
| **Secrets / env** | JWT secrets, DB URL, provider keys, webhook secrets | Host secret store or secured `.env` — **never** commit; **not** a substitute for DB backup |

Redis (BullMQ / cache) is generally **rebuildable**; do not treat it as the system of record unless you deliberately persist jobs and accept that policy.

---

## Local / ephemeral storage risk

Default storage is **local disk** (`apps/api/src/integrations/storage/local-disk.storage.ts` under `LOCAL_UPLOAD_DIR`).

Risks:

- Container or VM recreate **without a volume** → uploads gone while DB still points at keys.
- Single-host disk failure → irreversible document loss if no copy exists.
- `pnpm prepare:launch` / local compose without a named uploads volume → same class of loss.

For anything beyond a disposable demo host: use a **persistent volume** or set `STORAGE_PROVIDER=s3` with a durable bucket, and back up that bucket too.

---

## Recovery outline (manual)

Use this as a runbook skeleton; fill in your real host, credentials, and backup tool when ops configures them.

1. **Stop writers** — pause API and worker traffic to avoid split-brain writes during restore.
2. **Restore PostgreSQL** — provision a clean instance; restore from the latest verified dump/snapshot (and WAL/PITR if available). Confirm `DATABASE_URL`.
3. **Apply schema if needed** — `prisma migrate deploy` against the restored DB (see [`PRODUCTION-DEPLOYMENT.md`](./PRODUCTION-DEPLOYMENT.md)). Do **not** run `pnpm demo:reset` or wipe seeds to “fix” prod.
4. **Restore files** — copy `LOCAL_UPLOAD_DIR` contents back, or restore the S3/MinIO bucket so `Document` / upload keys resolve.
5. **Restore secrets** — inject production `.env` / secret manager values (JWT, DB, storage, providers). Rotate credentials if the incident was a compromise.
6. **Smoke** — health check, admin login (production users — not demo `admin`/`123` unless that was an explicit break-glass seed), open one SO, one inventory item with an image, one PDF if used.
7. **Re-enable traffic** — API then worker; watch queues and error logs.

### Local developer dump (ad hoc only)

```bash
mkdir -p backups
pg_dump -h 127.0.0.1 -U maher -d maher_erp -Fc -f backups/maher_erp-$(date +%Y%m%d).dump
```

Restore example:

```bash
pg_restore -h 127.0.0.1 -U maher -d maher_erp --clean --if-exists backups/maher_erp-YYYYMMDD.dump
```

These commands do **not** mean production backups exist.

---

## Honesty checklist

- [ ] Automated DB backup job documented and verified by a restore drill
- [ ] Uploads volume or S3 versioning/replication documented
- [ ] Secrets inventory documented outside git
- [ ] RPO/RTO agreed with the factory owner

Until those are true, treat production readiness for **disaster recovery** as incomplete even if application features pass UAT.
