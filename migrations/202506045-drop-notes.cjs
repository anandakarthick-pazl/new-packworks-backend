'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.dropTable('credit_notes');
    await queryInterface.dropTable('debit_notes');
  },

  async down(queryInterface, Sequelize) {
    // Optional: You can leave this empty or recreate the tables if needed
  }
};
