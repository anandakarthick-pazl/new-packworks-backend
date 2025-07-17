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

 'allocation_history',
  'attendances',
  'clients',
  'color',
  'company_payment_bill',
  'contact_messages',
  'country',
  'credit_notes',
  'currencies',
  'data_transfers',
  'debit_notes',
  'demo_requests',
  'departments',
  'designations',
  'die',
  'dropdown_names',
  'dropdown_values',
  'email_notification_settings',
  'employee_details',
  'faq_categories',
  'faqs',
  'features',
  'fields',
  'file_storage',
  'file_storage_settings',
  'flutes',
  'footer_menu',
  'front_clients',
  'front_details',
  'front_faqs',
  'front_features',
  'front_menu_buttons',
  'front_widgets',
  'global_currencies',
  'global_invoice_settings',
  'global_invoices',
  'global_payment_gateway_credentials',
  'global_settings',
  'global_subscriptions',
  'grn',
  'grn_items',
  'group_history',
  'html_templates',
  'inventory',
  'invoice_settings',
  'item_master',
  'language_settings',
  'machine_flow',
  'machine_process_fields',
  'machine_process_values',
  'machine_route_process',
  'machines',
  'module_settings',
  'modules',
  'notifications',
  'offline_request',
  'package_settings',
  'package_update_notifies',
  'packages',
  'partial_payment',
  'password_resets',
  'payment_gateway_credentials',
  'payments',
  'permission_role',
  'permission_types',
  'permissions',
  'process_name',
  'product_categories',
  'product_sub_categories',
  'production_group',
  'production_schedule',
  'purchase_order_billings',
  'purchase_order_items',
  'purchase_order_payments',
  'purchase_order_returns',
  'purchase_order_returns_items',
  'purchase_orders',
  'razorpay_invoices',
  'razorpay_subscriptions',
  'role_user',
  'roles',
  'route',
  'sales_order',
  'sales_return_items',
  'sales_returns',
  'sales_sku_details',
  'seo_details',
  'sku',
  'sku_options',
  'sku_type',
  'sku_version',
  'smtp_settings',
  'states',
  'stock_adjustment_items',
  'stock_adjustments',
  'subscription_items',
  'subscriptions',
  'taxes',
  'testimonials',
  'tr_front_details',
  'wallet_history',
  'work_order',
  'work_order_invoice',
  'work_order_status',
  'work_type',