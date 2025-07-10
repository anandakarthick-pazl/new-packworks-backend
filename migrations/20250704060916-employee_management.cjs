'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`
      ALTER TABLE employee_details 
      ADD COLUMN user_source ENUM('web', 'mobile', 'both') DEFAULT 'both';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};