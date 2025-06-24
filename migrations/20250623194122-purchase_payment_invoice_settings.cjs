'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        ALTER TABLE invoice_settings
        ADD COLUMN purchase_order_payment_prefix VARCHAR(191) NOT NULL DEFAULT 'POP',
        ADD COLUMN purchase_order_payment_number_separator VARCHAR(191) NOT NULL DEFAULT '#',
        ADD COLUMN purchase_order_payment_digit INT UNSIGNED NOT NULL DEFAULT 3;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};