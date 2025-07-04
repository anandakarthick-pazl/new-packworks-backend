--28/05/25
ALTER TABLE purchase_order_returns_items
CHANGE por_id po_return_id INT(10) UNSIGNED NOT NULL;

ALTER TABLE debit_notes
CHANGE purchase_order_return_id po_return_id INT(10) UNSIGNED NOT NULL;



-- 23/05/2025
ALTER TABLE item_master 
DROP INDEX item_code,
MODIFY COLUMN item_code VARCHAR(50) NULL;

-- 21/05/2025

--purchase_order_return
ALTER TABLE invoice_settings
ADD COLUMN purchase_return_prefix VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
ADD COLUMN purchase_return_number_separator VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
ADD COLUMN purchase_return_digit INT NOT NULL;

ALTER TABLE purchase_order_returns
ADD COLUMN purchase_return_generate_id VARCHAR(255) NULL AFTER id;

--stock_adjustment
ALTER TABLE invoice_settings
ADD COLUMN stock_adjustment_prefix VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
ADD COLUMN stock_adjustment_number_separator VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
ADD COLUMN stock_adjustment_digit INT NOT NULL;

ALTER TABLE stock_adjustments
ADD COLUMN stock_adjustment_generate_id VARCHAR(255) NULL AFTER id;

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


-- dummy


CREATE TABLE `production_group` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `company_id` INT UNSIGNED NOT NULL,
  `group_name` VARCHAR(100) NULL,
  `group_value` JSON NULL,
  `group_Qty` INT NULL,  
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `created_by` INT UNSIGNED DEFAULT NULL,
  `updated_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE `credit_notes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `company_id` INT UNSIGNED NOT NULL,
  `client_id` INT UNSIGNED NOT NULL,
  `client_name` VARCHAR(255) NULL,
  `work_order_invoice_id` INT UNSIGNED NOT NULL,
  `work_order_invoice_number` VARCHAR(255) NULL,
  `credit_generate_id` VARCHAR(255) NULL,
  `credit_reference_id` VARCHAR(255) NULL,
  `subject` VARCHAR(255) NULL,
  `invoice_total_amout` TEXT NULL,
  `credit_total_amount` TEXT NULL,
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `created_by` INT UNSIGNED DEFAULT NULL,
  `updated_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

 