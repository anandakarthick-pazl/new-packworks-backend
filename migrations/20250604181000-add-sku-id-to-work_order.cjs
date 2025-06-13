'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE sales_sku_details
      ADD COLUMN sku_id INT UNSIGNED NULL AFTER sales_order_id;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};
