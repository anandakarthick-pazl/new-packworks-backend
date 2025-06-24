'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        CREATE TABLE purchase_order_payments (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          po_id INT UNSIGNED NOT NULL,
          reference_no VARCHAR(100),
          payment_date DATE NOT NULL,
          amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
          payment_mode VARCHAR(50), 
          status ENUM('paid', 'pending', 'failed') DEFAULT 'paid',
          remark TEXT,
          company_id INT UNSIGNED NOT NULL,
          created_by INT UNSIGNED,
          updated_by INT UNSIGNED,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

          CONSTRAINT fk_payment_po FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT fk_payment_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE ON UPDATE CASCADE
        );
      `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};