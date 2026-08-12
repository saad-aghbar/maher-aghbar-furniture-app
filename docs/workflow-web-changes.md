# Workflow Admin Web Changes

## Navigation
- `apps/admin-web/src/components/nav-items.ts` — workflow nested item + match prefixes
- `apps/admin-web/src/components/nested-nav.tsx` — secondary nav tabs (wired in app shell)
- `apps/admin-web/src/components/app-shell.tsx` — renders `NestedNav`
- `packages/i18n/src/messages/{en,ar,he}/navigation.json` — `workflow` label

## Pages
- `apps/admin-web/src/app/[locale]/production/workflow/page.tsx` — workflow list cards
- `apps/admin-web/src/app/[locale]/production/workflow/[id]/page.tsx` — builder (vertical stages, runs-after, add stage, validate, publish)
- `apps/admin-web/src/app/[locale]/production/workflow/stages/page.tsx` — stage library (production-stage-library API)

## Order & product integration
- `apps/admin-web/src/components/workflow/order-workflow-section.tsx` — order workflow DAG + stage detail panel
- `apps/admin-web/src/app/[locale]/production/[id]/page.tsx` — workflow section on production order detail
- `apps/admin-web/src/app/[locale]/products/[id]/page.tsx` — product workflow select + stage applicability overrides

## i18n
Uses existing `production.workflow.*` keys via `useTranslations('production')` → `t('workflow.title')`.
