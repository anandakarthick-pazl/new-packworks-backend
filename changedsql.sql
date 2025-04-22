-- 22/04/2025

ALTER TABLE sku
ADD COLUMN route JSON NULL;

CREATE TABLE route (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id INT UNSIGNED NOT NULL,
    route_name VARCHAR(255) NOT NULL,
    route_process JSON NOT NULL,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active';
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT UNSIGNED NOT NULL,
    updated_by INT UNSIGNED NOT NULL
 );


-- 15/04/2025
CREATE TABLE machine_flow (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id INT UNSIGNED NOT NULL,
    machine_id INT UNSIGNED NOT NULL,
    machine_name VARCHAR(255) NOT NULL,
    process_id INT UNSIGNED NOT NULL,
    process_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT UNSIGNED NOT NULL,
    updated_by INT UNSIGNED NOT NULL
 );
--11/04/2025

ALTER TABLE work_order
ADD COLUMN `priority` ENUM('High', 'Medium', 'Low') NOT NULL DEFAULT 'Low',
ADD COLUMN `progress` ENUM('Pending','Product Planning', 'Procurement Sourcing', 'Production Planning', 'Production', 'Quality Control', 'Packaging', 'Shipping') NOT NULL DEFAULT 'Pending';

-- 09/04/2025
DROP TABLE machine_process_name;
DROP TABLE machine_process_values;
DROP TABLE machine_process_fields;

CREATE TABLE process_name (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  process_name VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_by INT UNSIGNED NOT NULL,
  updated_by INT UNSIGNED NOT NULL
);

CREATE TABLE machine_process_values (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  process_name_id INT UNSIGNED NOT NULL,
  process_value JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_by INT UNSIGNED NOT NULL,
  updated_by INT UNSIGNED NOT NULL
);


CREATE TABLE machine_process_fields (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  process_name_id INT UNSIGNED NOT NULL,
  label VARCHAR(255) NOT NULL,
  field_type VARCHAR(255) NOT NULL,
  required TINYINT(1) NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NOT NULL,
  updated_by INT UNSIGNED NOT NULL
);

ALTER TABLE sku
ADD COLUMN estimate_composite_item VARCHAR(255),
ADD COLUMN description VARCHAR(255),
ADD COLUMN default_sku_details VARCHAR(255),
ADD COLUMN tags VARCHAR(255);

-- add above to db

ALTER TABLE sales_order
ADD COLUMN confirmation_email VARCHAR(255);

ALTER TABLE sales_order
ADD COLUMN confirmation_name VARCHAR(255);

ALTER TABLE sales_order
ADD COLUMN confirmation_mobile BIGINT;


ALTER TABLE sales_order
ADD COLUMN sales_ui_id VARCHAR(150) NULL;

CREATE TABLE sku_invoice_history (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,  
  company_id INT UNSIGNED NOT NULL,
  client_id INT UNSIGNED NOT NULL,
  sku_id INT UNSIGNED NOT NULL,
  invoice_number VARCHAR(255) NOT NULL UNIQUE,
  date DATE NOT NULL,
  quantity INT NOT NULL,
  rate_per_sku DECIMAL(10, 2) NOT NULL,
  cost DECIMAL(10, 2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_by INT UNSIGNED NOT NULL,
  updated_by INT UNSIGNED NOT NULL
);
INSERT INTO sku_invoice_history (
  company_id,
  client_id,
  sku_id,
  invoice_number,
  date,
  quantity,
  rate_per_sku,
  cost,
  created_at,
  updated_at,
  status,
  created_by,
  updated_by
) VALUES (
  8,                         -- company_id
  1,                         -- client_id
  1,                         -- sku_id
  'INV-1001',                -- invoice_number
  '2025-04-09',              -- date
  100,                       -- quantity
  25.50,                     -- rate_per_sku
  2550.00,                   -- cost (quantity * rate)
  NOW(),                     -- created_at
  NOW(),                     -- updated_at
  'active',                  -- status
  3,                         -- created_by
  3                          -- updated_by
);




-- 07/04/2025

ALTER TABLE sales_order
ADD COLUMN total_qty INT,
ADD COLUMN total_amount DECIMAL(10,2),
ADD COLUMN sgst DECIMAL(10,2),
ADD COLUMN cgst DECIMAL(10,2),
ADD COLUMN total_incl_gst DECIMAL(12,2);


ALTER TABLE sales_order
DROP COLUMN sku_details;

ALTER TABLE sales_order 
ADD COLUMN sales_status ENUM('Approved', 'Pending','Rejected') DEFAULT 'Pending';

CREATE TABLE sales_sku_details (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, 
    company_id INT(11) NOT NULL,
    client_id INT(11) NOT NULL,
    sales_order_id INT,    
    sku VARCHAR(100),
    quantity_required INT,
    rate_per_sku DECIMAL(10,2),
    acceptable_sku_units VARCHAR(100),
    total_amount DECIMAL(12,2),
    sgst DECIMAL(5,2),
    sgst_amount DECIMAL(12,2),
    cgst DECIMAL(5,2),
    cgst_amount DECIMAL(12,2),
    total_incl__gst DECIMAL(14,2),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT(11) DEFAULT NULL,
    updated_by INT(11) DEFAULT NULL
);

ALTER TABLE sales_sku_details  
ADD COLUMN status ENUM('active', 'inactive') DEFAULT 'active';

INSERT INTO sales_sku_details (
    company_id, client_id, sales_order_id,
    sku, quantity_required, rate_per_sku, acceptable_sku_units,
    total_amount, sgst, sgst_amount, cgst, cgst_amount, total_incl__gst,
    created_by, updated_by
) VALUES (
    1, 101, 5001,
    'BOX-XL', 100, 250.00, 'pcs',
    25000.00, 9.00, 2250.00, 9.00, 2250.00, 29500.00,
    1, 1
);

CREATE TABLE sku_version (
  id int(11) NOT NULL,
  company_id int(11) NOT NULL,
  sku_id int(11) NOT NULL,
  sku_version varchar(100) DEFAULT NULL,
  client_id int(11) NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  sku_values longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(sku_values)),
  status varchar(50) NOT NULL DEFAULT 'active',
  created_by int(11) DEFAULT NULL,
  updated_by int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table sku_version
--
ALTER TABLE sku_version
  ADD PRIMARY KEY (id);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table sku_version
--
ALTER TABLE sku_version
  MODIFY id int(11) NOT NULL AUTO_INCREMENT;
COMMIT;



