'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        ALTER TABLE purchase_orders
        ADD COLUMN payment_status VARCHAR(100) NOT NULL DEFAULT 'pending' AFTER po_status
      `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};