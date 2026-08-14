-- Classify existing identity roles and leave any other roles as STAFF.
UPDATE roles SET kind = 'CUSTOMER', "isSystem" = true, "isActive" = true
WHERE code = 'CUSTOMER';

UPDATE roles SET kind = 'PRODUCTION_WORKER', "isSystem" = true, "isActive" = true
WHERE code = 'PRODUCTION_WORKER';

UPDATE roles SET kind = 'ADMIN', "isSystem" = true, "isActive" = true
WHERE code = 'SYSTEM_ADMINISTRATOR';

UPDATE roles SET kind = 'STAFF', "isSystem" = true, "isActive" = true
WHERE code = 'WAREHOUSE_MANAGEMENT';

UPDATE roles
SET "descriptionEn" = description
WHERE "descriptionEn" IS NULL AND description IS NOT NULL;
