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



