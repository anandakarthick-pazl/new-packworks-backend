'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`ALTER TABLE invoice_settings
  ADD COLUMN purchase_return_prefix VARCHAR(191) NULL,
  ADD COLUMN purchase_return_number_separator VARCHAR(191) NULL,
  ADD COLUMN purchase_return_digit INT NULL;`);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  }
};


