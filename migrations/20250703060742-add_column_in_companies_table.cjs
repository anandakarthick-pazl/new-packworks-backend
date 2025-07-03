'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
ALTER TABLE companies
ADD COLUMN package_start_date DATE AFTER package_type,
ADD COLUMN package_end_date DATE AFTER package_start_date;     
 `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};