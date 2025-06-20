'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        ALTER TABLE work_order_invoice
        DROP COLUMN sku_id,
        DROP COLUMN work_id,
        DROP COLUMN sale_id,
        ADD COLUMN work_id BIGINT NULL,
        ADD COLUMN sale_id BIGINT NULL,
        ADD COLUMN quantity INT NULL,
        ADD COLUMN sku_details JSON NULL,
        ADD COLUMN client_name VARCHAR(255) NULL;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};