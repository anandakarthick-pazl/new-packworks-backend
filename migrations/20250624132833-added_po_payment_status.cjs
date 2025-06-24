'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        ALTER TABLE purchase_order_payments
        DROP COLUMN status,
        ADD COLUMN status ENUM('partial', 'paid', 'unpaid') NOT NULL DEFAULT 'unpaid' AFTER payment_mode;
      `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};