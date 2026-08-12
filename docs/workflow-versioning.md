# Workflow Versioning

## Lifecycle

```
ACTIVE VERSION v3
  → Create draft v4 (clone)
  → Edit nodes/edges
  → Validate (DAG)
  → Preview
  → Publish (transaction)
      → v4 PUBLISHED + ACTIVE
      → v3 SUPERSEDED
```

## Rules

1. Only **one** active published version per workflow (`activeVersionId`).
2. Published graphs are **immutable**. To change: clone → draft → edit → publish.
3. Master edits affect **future** ProductionOrders only.
4. Existing orders keep their snapshot (version number frozen).
5. Unstarted order migration to a new version requires explicit Admin customize/migrate + audit — never silent.
6. Concurrent draft edits: optimistic check; stale publish → `409 WORKFLOW_VERSION_STALE`.
7. Do not destructively delete versions referenced by historical snapshots.

## Confirmation copy (publish)

> This will affect future production orders only.

## Status meanings

| Status | Meaning |
|--------|---------|
| DRAFT | Editable |
| PUBLISHED | Immutable, may be active |
| SUPERSEDED | Was published; replaced by newer |
| ARCHIVED | Hidden from normal pickers; retained for history |
