'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE TABLE purchaseordertemplate (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        company_id INT UNSIGNED NOT NULL,
        po_template_id INT NULL,
        html_template TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
        status ENUM('active', 'inactive') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};
