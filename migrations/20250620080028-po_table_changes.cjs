'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        ALTER TABLE purchase_orders
        ADD COLUMN use_this BOOLEAN DEFAULT false,
        ADD COLUMN debit_amount DECIMAL(10, 2) DEFAULT 0.00;
      `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};