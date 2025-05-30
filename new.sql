-- 23/05/2025
ALTER TABLE item_master 
DROP INDEX item_code,
MODIFY COLUMN item_code VARCHAR(50) NULL;

-- 20/05/2025
ALTER TABLE purchase_orders
ADD COLUMN billing_address TEXT
AFTER supplier_name;

ALTER TABLE purchase_orders
CHANGE COLUMN supplier_address shipping_address TEXT;


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

-- 14/05/25
ALTER TABLE purchase_order_returns_items MODIFY id INT(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE item_master
MODIFY COLUMN item_type ENUM(
  'reels', 
  'pins', 
  'semi-finished-goods',
  'finished-goods', 
  'raw-materials',
  'corrugation-glue',
  'pasting-glue'
) NOT NULL DEFAULT 'raw-materials';
-- 