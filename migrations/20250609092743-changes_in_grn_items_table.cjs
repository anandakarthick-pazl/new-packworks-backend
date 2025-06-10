'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE grn_items
      ADD COLUMN cgst DECIMAL(5,2) NULL AFTER notes,
      ADD COLUMN cgst_amount DECIMAL(12,2) NULL AFTER cgst,
      ADD COLUMN sgst DECIMAL(5,2) NULL AFTER cgst_amount,
      ADD COLUMN sgst_amount DECIMAL(12,2) NULL AFTER sgst,
      ADD COLUMN amount DECIMAL(15,2) NULL AFTER sgst_amount,
      ADD COLUMN tax_amount DECIMAL(15,2) NULL AFTER amount,
      ADD COLUMN total_amount DECIMAL(15,2) NULL AFTER tax_amount;

    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};
