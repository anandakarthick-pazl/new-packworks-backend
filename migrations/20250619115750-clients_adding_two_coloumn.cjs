'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
     ALTER TABLE clients ADD credit_balance VARCHAR(255) NULL DEFAULT NULL AFTER client_ui_id, ADD debit_balance VARCHAR(255) NULL DEFAULT NULL AFTER credit_balance;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};