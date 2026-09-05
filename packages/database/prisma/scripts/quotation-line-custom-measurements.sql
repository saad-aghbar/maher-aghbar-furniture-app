-- Persist RFQ named measurements on quotation lines so MODIFIED spec
-- survives quotation → sales order. Matches QuotationLine.customMeasurements.

ALTER TABLE "quotation_lines"
  ADD COLUMN IF NOT EXISTS "customMeasurements" JSONB;
