'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        ALTER TABLE purchase_order_payments
        DROP COLUMN reference_no,
        ADD COLUMN purchase_payment_generate_id VARCHAR(100) NULL AFTER id
      `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};