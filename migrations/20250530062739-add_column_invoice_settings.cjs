'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`ALTER TABLE invoice_settings
    ADD COLUMN category_prefix VARCHAR(191) DEFAULT 'CAT',
    ADD COLUMN category_number_separator VARCHAR(191) DEFAULT '-',
    ADD COLUMN category_digit INT DEFAULT 3,
    ADD COLUMN sub_category_prefix VARCHAR(191) DEFAULT 'SUBCAT',
    ADD COLUMN sub_category_number_separator VARCHAR(191) DEFAULT '-',
    ADD COLUMN sub_category_digit INT DEFAULT 3;`);
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

