# Backups & Recovery

Backup and disaster recovery assumptions for **Maher Al-Aghbar & Sons Furniture ERP**.

---

## Assets to protect

| Asset | Priority | Method |
|-------|----------|--------|
| PostgreSQL (all business data) | **Critical** | Automated daily + WAL/PITR |
| S3/MinIO documents | **Critical** | Bucket versioning + cross-region replica (prod) |
| Redis | Low | Ephemeral cache/queues; rebuild acceptable |
| Secrets | Critical | Secret manager; not in backups |

---

## RPO / RTO targets

| Tier | RPO (max data loss) | RTO (max downtime) | Notes |
|------|---------------------|--------------------|-------|
| **Production** | 1 hour | 4 hours | PITR + runbook |
| **Staging** | 24 hours | 8 hours | Daily snapshot sufficient |
| **Local** | None | N/A | Developer responsibility |

**RPO rationale:** Factory operates business hours Asia/Amman; hourly WAL archiving limits loss to typical transaction window. Nightly full backup alone would be 24h RPO — insufficient for production.

**RTO rationale:** 4 hours covers VM restore, DNS failover, migration verify, and smoke test for a single-region deployment without hot standby.

---

## PostgreSQL backup strategy

### Production

1. **Continuous archiving (WAL)** to object storage — 1-hour RPO.
2. **Full daily snapshot** at 02:00 Asia/Amman — retained 30 days.
3. **Weekly full** retained 12 weeks; **monthly** retained 7 years (financial audit alignment).
4. Managed provider PITR window: minimum 7 days.

### Verification

- Weekly automated restore to isolated instance + `SELECT COUNT(*)` on core tables.
- Quarterly manual restore drill documented in ops log.

### Restore procedure (summary)

1. Provision clean PostgreSQL instance.
2. Restore latest base backup.
3. Replay WAL to target timestamp (before incident).
4. Run `pnpm db:migrate deploy` if schema drift.
5. Smoke test: login, single SO read, inventory balance check.
6. Re-enable API/worker traffic.

---

## Document storage backup

| Control | Detail |
|---------|--------|
| Versioning | Enabled on production bucket |
| Replication | Async to secondary region/bucket (prod) |
| Lifecycle | IA after 90 days; Glacier for audit archive (optional) |
| Deletion | Soft delete only in app; bucket MFA delete protection |

Restore: re-link `Document.storageKey` if bucket restored; keys are immutable UUID paths.

---

## Redis

- No backup required for v1; queues re-process from idempotent jobs or dead-letter.
- Persistence `AOF` optional if job loss unacceptable — document if enabled.

---

## Application configuration

- Infrastructure as code in git (`infra/`).
- Environment secrets in host secret store — export inventory documented, not backed up with DB.

---

## Disaster scenarios

| Scenario | Response |
|----------|----------|
| Accidental row delete | PITR to point-in-time; prefer soft-delete recovery first |
| Ransomware / bucket wipe | Restore from off-site replica; rotate all secrets |
| Region outage | Failover to replica region (Phase 11+); update DNS |
| Bad migration | Forward-fix migration; restore DB if destructive |
| Corrupted single document | Restore object version from S3 versioning |

---

## Monitoring & alerts

- Backup job success/failure alert within 1 hour
- WAL archive gap > 2 hours → page on-call
- Disk usage > 80% on DB volume

---

## Compliance notes

- Financial records retention: 7 years (Jordan business practice assumption).
- Customer PII in backups subject to same access controls as production.
- Backup encryption at rest (provider default AES-256).

---

## Local development

Developers may snapshot local Docker Postgres ad hoc. Before `pnpm demo:reset` (Checkpoint 3):

```bash
mkdir -p backups
pg_dump -h 127.0.0.1 -U maher -d maher_erp -Fc -f backups/maher_erp-pre-demo-$(date +%Y%m%d).dump
# Before a presentation-data repair:
# pg_dump -h 127.0.0.1 -U maher -d maher_erp -Fc -f backups/maher_erp-pre-repair-$(date +%Y%m%d).dump
```

Restore:

```bash
pg_restore -h 127.0.0.1 -U maher -d maher_erp --clean --if-exists backups/maher_erp-pre-demo-YYYYMMDD.dump
```

Compose equivalent (user `maher`, database `maher_erp` per `infra/docker/docker-compose.yml`):

```bash
docker compose -f infra/docker/docker-compose.yml exec postgres pg_dump -U maher -Fc maher_erp > backups/maher_erp-pre-demo.dump
```

`backups/` is gitignored. Not a substitute for production procedures.
