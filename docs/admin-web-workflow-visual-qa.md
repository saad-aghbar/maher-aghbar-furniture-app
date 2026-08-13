# Admin Web workflow — visual QA

Manual pass after the production-flow builder overhaul. Websites serve `next start` (not `next dev`).

## List `/production/workflow`

- Cards show localized name, stage count, published/draft pills — **no technical code**
- Create modal: English + Arabic required, Hebrew optional, **no code field**
- Empty state CTA opens create
- RTL: cards and actions follow logical start/end

## Builder `/production/workflow/[id]`

- Loading: graph-shaped skeleton (circles), not one beige block
- Empty draft: “Add the first stage…” CTA
- Graph is primary; compact numbered list beside/under it
- **No checkbox matrix** on the main page
- Numbered brand circles; optional stages have a dashed ring
- Click a circle or list row → drawer from logical **end** (right in EN, left in ar/he)
- Escape closes drawer; Tab cycles; focus ring visible
- Drawer hides codes / nodeKeys / sortOrder
- Required/Optional, Starts after, Leads into, duration
- Cycle candidates disabled (not crash)
- Parallel copy when multiple Runs after; merge sentence on Leads into
- Small path preview updates as connections change
- Remove confirm explains reconnect
- Publish confirm: future orders only
- Published view is read-only; Create draft from history
- Graph companion: visually hidden ordered list for screen readers
- Topology change: nodes ease 200–350ms; `prefers-reduced-motion` skips

## Stage library `/production/workflow/stages`

- Search by localized names
- Filters: All / Active / Inactive / inspection / photos
- Compact cards; click opens edit drawer (names, department, duration, flags)
- Deactivate confirm; no hard delete in everyday UI
- **No code / sortOrder** in the cards

## Legacy

- `/production-stages` redirects to `/production/workflow/stages`
- Nested Production nav no longer lists a separate Production stages CRUD item

## Locales

- EN / AR / HE: new workflow keys present
- Status pills use `StatusBadge` (`PUBLISHED`, `DRAFT`, `ACTIVE`, `ARCHIVED`) — no raw enums
- RTL: drawer from `end`; edge direction is **not** mirrored (top-to-bottom still)

## Regression

- Order and product pages still show runtime-colored `ProductionFlowMap`
- Mobile unchanged
- Existing production-order snapshots unchanged after publish
