-- Remap legacy warehouse type strings before converting the column to WarehouseType.
UPDATE warehouses SET type = 'RAW_MATERIALS' WHERE type IN ('RAW', 'RAW_MATERIALS');
UPDATE warehouses SET type = 'SEMI_FINISHED' WHERE type IN ('SEMI', 'SEMI_FINISHED');
UPDATE warehouses SET type = 'FINISHED_GOODS' WHERE type IN ('FINISHED', 'FINISHED_GOODS', 'FIN');
UPDATE warehouses SET type = 'RAW_MATERIALS' WHERE type NOT IN ('RAW_MATERIALS', 'SEMI_FINISHED', 'FINISHED_GOODS');
