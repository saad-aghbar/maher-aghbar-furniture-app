-- One commercially accepted quotation per RFQ.
-- Partial unique index: Prisma schema cannot express WHERE status = ACCEPTED.
CREATE UNIQUE INDEX IF NOT EXISTS quotations_one_accepted_per_request
ON quotations ("requestId")
WHERE status = 'ACCEPTED' AND "requestId" IS NOT NULL AND "archivedAt" IS NULL;
