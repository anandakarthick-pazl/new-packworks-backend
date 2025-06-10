'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE grn
      ADD COLUMN total_qty INT NULL AFTER notes,
      ADD COLUMN cgst_amount DECIMAL(10,2) NULL AFTER total_qty,
      ADD COLUMN sgst_amount DECIMAL(10,2) NULL AFTER cgst_amount,
      ADD COLUMN amount DECIMAL(10,2) NULL AFTER sgst_amount,
      ADD COLUMN tax_amount DECIMAL(12,2) NULL AFTER amount,
      ADD COLUMN total_amount DECIMAL(10,2) NULL AFTER tax_amount;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};
