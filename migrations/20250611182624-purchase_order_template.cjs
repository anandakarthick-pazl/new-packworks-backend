'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
     CREATE TABLE purchaseordertemplate (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        company_id INT UNSIGNED NOT NULL,
        po_template_id INT NULL,
        html_template LONGTEXT NOT NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};
