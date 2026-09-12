# Phase 11 — Handwritten sheet intake

**Date:** 2026-09-12

A photographed dealer sheet becomes an A4 PDF document of record. The original image goes to a single-pass vision model constrained to SpecOptionValue codes. Cross-vendor consensus (`AI_VISION_MODEL_VERIFY`) marks disagreed fields as low confidence. Unknown foam/wood/finish codes land in `unrecognizedOptions`, never as silent free text.

`extractPreview` returns `preview.items[]` with per-field confidence. The dealer Scan Review board requires every low-confidence field to be touched before the lines enter the Phase 10 basket. Two-stage OCR→JSON remains the fallback.

## Tests

- Consensus disagreement marks width low-confidence
- Unrecognized foam is not kept as free text
- Scan review blocks confirm until a low-confidence dimension is checked
- Confirmed lines become basket lines
- Sheet geometry for Scan Review and crop preview
- Maestro: dealer photographs a two-product sheet, reviews both lines, corrects one dimension, submits
