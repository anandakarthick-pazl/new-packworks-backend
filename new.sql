-- 12/05/2025
-- item
ALTER TABLE invoice_settings
ADD COLUMN item_prefix VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
ADD COLUMN item_number_separator VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
ADD COLUMN item_digit INT NOT NULL;

ALTER TABLE item_master
ADD COLUMN item_generate_id VARCHAR(255) NULL;

-- purchase_order
ALTER TABLE invoice_settings
ADD COLUMN purchase_prefix VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
ADD COLUMN purchase_number_separator VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
ADD COLUMN purchase_digit INT NOT NULL;

ALTER TABLE purchase_orders
ADD COLUMN purchase_generate_id VARCHAR(255) NULL AFTER id;

-- GRN
ALTER TABLE invoice_settings
ADD COLUMN grn_prefix VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
ADD COLUMN grn_number_separator VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
ADD COLUMN grn_digit INT NOT NULL;

ALTER TABLE grn
ADD COLUMN grn_generate_id VARCHAR(255) NULL AFTER id;

-- Inventory
ALTER TABLE invoice_settings
ADD COLUMN inventory_prefix VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
ADD COLUMN inventory_number_separator VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
ADD COLUMN inventory_digit INT NOT NULL;

ALTER TABLE inventory
ADD COLUMN inventory_generate_id VARCHAR(255) NULL AFTER id;


-- 