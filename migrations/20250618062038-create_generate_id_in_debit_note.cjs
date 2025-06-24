'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        ALTER TABLE invoice_settings 
        ADD COLUMN debit_note_prefix VARCHAR(191) NOT NULL DEFAULT 'DN',
        ADD COLUMN debit_note_number_separator VARCHAR(191) NOT NULL DEFAULT '#',
        ADD COLUMN debit_note_digit INT UNSIGNED NOT NULL DEFAULT 3;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};