'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE invoice_settings ADD sales_returns_prefix VARCHAR(255) NULL DEFAULT NULL AFTER billings_digit, ADD sales_returns_number_separator VARCHAR(255) NULL DEFAULT NULL AFTER sales_returns_prefix, ADD sales_returns_digit VARCHAR(255) NULL DEFAULT NULL AFTER sales_returns_number_separator;
    `);
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  }
};
