'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
     await queryInterface.sequelize.query(`
       ALTER TABLE smtp_settings
        ADD COLUMN company_id INTEGER DEFAULT 0 AFTER id,
        ADD COLUMN created_by INTEGER DEFAULT 0 AFTER updated_at,
        ADD COLUMN updated_by INTEGER DEFAULT 0 AFTER created_by;
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
