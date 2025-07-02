'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        ALTER TABLE production_schedule
        DROP COLUMN production_status,
        ADD COLUMN production_status ENUM('in_progress', 'completed') DEFAULT 'in_progress',
        ADD COLUMN user_id INT NOT NULL after company_id
      `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};