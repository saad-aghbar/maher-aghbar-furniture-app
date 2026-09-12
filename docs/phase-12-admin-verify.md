# Phase 12 — Admin submission verification desk

**Date:** 2026-09-12

`GET /requests/:id` includes `aiJobs` and signed document paths. The handwritten photo and A4 PDF are pinned on the factory review desk. Each line shows sheet vs dealer provenance. Confirm or correct appends `reviewHistory` (`SPEC_CONFIRMED` / `SPEC_CORRECTED`) and never silently overwrites the original job fields. Mobile correction uses `SpecCorrectSheet` so the dealer-submitted values remain in the history message while the line is patched.
