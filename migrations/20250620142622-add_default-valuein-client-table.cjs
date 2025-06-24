'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Insert module
    await queryInterface.sequelize.query(`
      ALTER TABLE clients CHANGE credit_balance credit_balance DECIMAL(10,2) NULL DEFAULT '0.00', CHANGE debit_balance debit_balance DECIMAL(10,2) NULL DEFAULT '0.00';
    `);

  }
};
