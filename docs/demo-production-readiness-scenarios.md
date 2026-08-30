# Demo scenarios — Production readiness boards

Use these states when UAT-ing Admin Orders + Production after seed.

| Tag | How to recognize | Board expectation |
|-----|------------------|-------------------|
| A | Confirmed SO, PO `PLANNED`, ≥2 tasks with `assignedEmployeeId = null` | Orders: Needs attention; Production: Needs setup |
| B | All executable tasks assigned, materials not waiting | Production: Ready to start; Setup shows Start |
| C | PO `IN_PROGRESS`, mid manufacturing stage | On the floor |
| D | PO `WAITING_FOR_MATERIALS` | Blocked / attention |
| E | Open `TaskBlocker` on a task | Blocked |
| F | `QUALITY_CHECK` or current stage INSPECTION | Inspection & packaging |
| G | `READY_FOR_PACKAGING` or PACKAGING | Inspection & packaging |
| H | `READY_FOR_DELIVERY` | Completed/recent + FG desk |
| I | SO/delivery `DELIVERED` | Orders: Delivered |

Awkward layout fixtures: long Arabic dealer names, missing `imageUrl`, 6+ stages, parallel branches, overdue `requiredDeliveryDate`, null due date.

**Setup path:** Orders detail → Finish production setup → `/production/:id/setup`  
**Start gate:** Backend returns `PRODUCTION_NOT_READY` with `MISSING_ASSIGNMENT` until all non-LOGISTICS tasks are assigned.
