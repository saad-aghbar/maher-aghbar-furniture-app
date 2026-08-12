# Workflow Test Plan

## Backend unit

- Graph validator: cycle, self-link, duplicate edge, no root/terminal, duplicate nodeKey  
- Compiler: linear, fork, merge, 3-way parallel, exclude painting, omit optional, edge rewrite  
- Version publish immutability + supersede  
- Snapshot versioning (Order1 stays on v1 after v2 publish)  
- Product EXCLUDED compiles without excluded tasks  
- Parallel READY / merge wait  
- Skip optional satisfies deps + audit  
- Progress weighted; excluded out of denominator  
- Idempotent snapshot generation  
- WORKFLOW_VERSION_STALE  
- Duration ESTIMATE_REVIEW_REQUIRED  

## Backend integration / service

- Confirm creates snapshot + instances + tasks only for included  
- Pipeline unlock from snapshot  
- Timer complete unlocks correct nodes  
- Blocker behavior preserved  
- Scheduler parallel + merge + no excluded alloc  
- Dealer ownership + field strip  
- Worker isolation (no graph; no other worker tasks)  
- Permission gates  
- Legacy backfill idempotent  

## Frontend

- Admin web: builder, add/remove, deps, publish, validation  
- Admin mobile: list, sheets, publish, light/dark, ar/en/he  
- Dealer: dynamic graph, parallel/merge/skip, ownership, RTL  

## Layout

1-node, linear, fork, merge diamond, 15-node, long ar/he labels, optional omitted

## Smokes / CI

`pnpm typecheck`, `lint`, `test`, `build`, `smoke:lifecycle`, `smoke:workflow`, `smoke:scope`, prisma validate/generate/push, backfill dry-run, mobile typecheck/lint/test

## Visual QA

See `docs/workflow-visual-qa.md` — en/ar/he × light/dark.
