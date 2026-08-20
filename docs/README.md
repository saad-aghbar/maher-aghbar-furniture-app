# Documentation index

Start here:

- [Repository map](architecture/repository-map.md) — where each app and package lives
- [Where to change things](architecture/where-to-change-things.md) — feature → path
- [Architecture audit](repository-architecture-audit.md)
- [Refactor plan](repository-refactor-plan.md) / [baseline](repository-refactor-baseline.md) / [final report](repository-refactor-final-report.md) / [dead-code candidates](dead-code-candidates.md)
- Root operator guide: [README.md](../README.md)
- [Launch checklist](launch-checklist.md) · [Troubleshooting](troubleshooting.md)

User guides: [admin](user-guides/admin-user-guide.md) · [customer](user-guides/customer-user-guide.md) · [employee](user-guides/employee-user-guide.md)

---

## Current architecture / operations

Keep these as the living set.

- [architecture.md](architecture.md) · [api.md](api.md) · [permissions.md](permissions.md) · [security.md](security.md)
- [database/database-model.md](database/database-model.md) · [deployment.md](deployment.md) · [backups.md](backups.md)
- [product-overview.md](product-overview.md) · [requirements.md](requirements.md) · [navigation.md](navigation.md)
- [workflows.md](workflows.md) · [localization.md](localization.md) · [testing.md](testing.md)
- [known-limitations.md](known-limitations.md) · [assumptions.md](assumptions.md) · [milestones.md](milestones.md)
- [pdf-compliance.md](pdf-compliance.md) · [brand.md](brand.md)
- [mobile-architecture.md](mobile-architecture.md) · [mobile-api-client.md](mobile-api-client.md) · [mobile-authentication.md](mobile-authentication.md)
- [mobile-data-flow.md](mobile-data-flow.md) · [mobile-release.md](mobile-release.md) · [store-submission.md](store-submission.md)
- [mobile-risk-register.md](mobile-risk-register.md) · [mobile-api-inventory.md](mobile-api-inventory.md)
- Production scheduling: [production-scheduling.md](production-scheduling.md) · [production-scheduling-architecture.md](production-scheduling-architecture.md) · [production-scheduling-operations.md](production-scheduling-operations.md) · [production-scheduling-admin-guide.md](production-scheduling-admin-guide.md) · [production-scheduling-dealer-guide.md](production-scheduling-dealer-guide.md) · [production-scheduling-troubleshooting.md](production-scheduling-troubleshooting.md) · [production-scheduling-permissions.md](production-scheduling-permissions.md)
- [inventory-production-integration.md](inventory-production-integration.md) · [workflow-builder-architecture.md](workflow-builder-architecture.md)
- Demo factory data: [demo-data-system-audit.md](demo-data-system-audit.md) · [demo-screen-data-coverage.md](demo-screen-data-coverage.md) · [father-demo-walkthrough.md](father-demo-walkthrough.md) · [demo-factory-data-closure-report.md](demo-factory-data-closure-report.md) · [father-demo-presentation-readiness.md](father-demo-presentation-readiness.md) · [demo-factory-data-repair-report.md](demo-factory-data-repair-report.md)
- Dealer Schedule: [dealer-scheduling-calendar-closure-report.md](dealer-scheduling-calendar-closure-report.md)

## Feature design (still useful)

- Inventory: [inventory-warehouse-domain-model.md](inventory-warehouse-domain-model.md) · [inventory-web-redesign.md](inventory-web-redesign.md) · [inventory-mobile-redesign.md](inventory-mobile-redesign.md) · [inventory-test-plan.md](inventory-test-plan.md) · [inventory-migration-plan.md](inventory-migration-plan.md) · [inventory-production-gap-plan.md](inventory-production-gap-plan.md)
- Workflow: [workflow-data-model.md](workflow-data-model.md) · [workflow-runtime-rules.md](workflow-runtime-rules.md) · [workflow-ui-map.md](workflow-ui-map.md) · [workflow-i18n-map.md](workflow-i18n-map.md) · [workflow-versioning.md](workflow-versioning.md) · [workflow-test-plan.md](workflow-test-plan.md) · [admin-web-workflow-redesign.md](admin-web-workflow-redesign.md)
- Scheduling: [production-scheduling-algorithm.md](production-scheduling-algorithm.md) · [production-scheduling-data-model.md](production-scheduling-data-model.md) · [production-scheduling-ui-map.md](production-scheduling-ui-map.md) · [production-scheduling-test-plan.md](production-scheduling-test-plan.md)
- Mobile design: [mobile-design-system.md](mobile-design-system.md) · [mobile-component-library.md](mobile-component-library.md) · [mobile-motion-system.md](mobile-motion-system.md) · [mobile-screen-map.md](mobile-screen-map.md) · [mobile-navigation-map.md](mobile-navigation-map.md) · [mobile-scaffold.md](mobile-scaffold.md) · [mobile-implementation-plan.md](mobile-implementation-plan.md) · [mobile-localization.md](mobile-localization.md) · [mobile-rtl-checklist.md](mobile-rtl-checklist.md)
- Dealer mobile: [dealer-mobile-redesign-plan.md](dealer-mobile-redesign-plan.md) · [dealer-mobile-screen-map.md](dealer-mobile-screen-map.md) · [dealer-mobile-motion-plan.md](dealer-mobile-motion-plan.md) · [dealer-edit-rules.md](dealer-edit-rules.md)
- Other: [ai-chat.md](ai-chat.md) · [ai-ocr.md](ai-ocr.md) · [arabic-terminology-glossary.md](arabic-terminology-glossary.md) · [factory-ux-phase2.md](factory-ux-phase2.md)

## Historical — implementation reports / audits

These are snapshots from past work. Prefer the architecture docs above for current truth.

- Staff shell: [staff-runtime-shell-audit.md](staff-runtime-shell-audit.md) · [staff-runtime-shell-final-report.md](staff-runtime-shell-final-report.md)
- Admin web workflow: [admin-web-workflow-audit.md](admin-web-workflow-audit.md) · [admin-web-workflow-api-audit.md](admin-web-workflow-api-audit.md) · [admin-web-workflow-changes.md](admin-web-workflow-changes.md) · [admin-web-workflow-qa.md](admin-web-workflow-qa.md) · [admin-web-workflow-visual-qa.md](admin-web-workflow-visual-qa.md) · [admin-functionality-audit.md](admin-functionality-audit.md)
- Inventory: [inventory-rearchitecture-audit.md](inventory-rearchitecture-audit.md) · [inventory-rearchitecture-changes.md](inventory-rearchitecture-changes.md) · [inventory-migration-report.md](inventory-migration-report.md) · [inventory-production-gap-audit.md](inventory-production-gap-audit.md) · [inventory-production-gap-closure.md](inventory-production-gap-closure.md)
- Workflow reports: [workflow-builder-audit.md](workflow-builder-audit.md) · [workflow-database-changes.md](workflow-database-changes.md) · [workflow-web-changes.md](workflow-web-changes.md) · [workflow-mobile-changes.md](workflow-mobile-changes.md) · [workflow-visual-qa.md](workflow-visual-qa.md) · [workflow-final-report.md](workflow-final-report.md)
- Scheduling reports: [production-scheduling-audit.md](production-scheduling-audit.md) · [scheduling-database-changes.md](scheduling-database-changes.md) · [scheduling-web-changes.md](scheduling-web-changes.md) · [scheduling-mobile-changes.md](scheduling-mobile-changes.md)
- Mobile reports: [mobile-audit.md](mobile-audit.md) · [mobile-api-gap-analysis.md](mobile-api-gap-analysis.md) · [mobile-mock-data-audit.md](mobile-mock-data-audit.md) · [mobile-mock-data-removal-report.md](mobile-mock-data-removal-report.md) · [mobile-visual-qa.md](mobile-visual-qa.md) · [mobile-brand-intro-visual-qa.md](mobile-brand-intro-visual-qa.md) · [login-motion-qa.md](login-motion-qa.md)
- Dealer mobile reports: [dealer-mobile-aesthetic-audit.md](dealer-mobile-aesthetic-audit.md) · [dealer-mobile-visual-qa.md](dealer-mobile-visual-qa.md) · [dealer-mobile-completion-report.md](dealer-mobile-completion-report.md)
- Arabic: [arabic-localization-audit.md](arabic-localization-audit.md) · [arabic-localization-changes.md](arabic-localization-changes.md) · [arabic-localization-qa.md](arabic-localization-qa.md)

## UAT

- [factory-end-to-end-uat-report.md](factory-end-to-end-uat-report.md)
- [factory-configuration-uat-audit.md](factory-configuration-uat-audit.md)
- Script: `pnpm smoke:factory-lifecycle`

## Screenshots

[mobile-screenshots/](mobile-screenshots/) — tracked QA captures (admin-home, dealer-home, worker-home, catalog, orders, …).

`source-proposal.pdf` — original Arabic technical proposal.
