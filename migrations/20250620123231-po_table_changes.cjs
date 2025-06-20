'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        ALTER TABLE purchase_orders
        DROP COLUMN debit_amount,
        ADD COLUMN debit_balance_amount DECIMAL(10, 2) DEFAULT 0.00,
        ADD COLUMN debit_used_amount DECIMAL(10, 2) DEFAULT 0.00;
      `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};