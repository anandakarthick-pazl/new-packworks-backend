-- 02/04/2025

ALTER TABLE sku
ADD COLUMN composite_type ENUM('Partition', 'Panel') NULL,
ADD COLUMN part_count INT NULL,
ADD COLUMN part_value JSON NULL;

