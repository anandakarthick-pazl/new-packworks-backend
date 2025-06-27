'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        ALTER TABLE production_schedule
        DROP COLUMN status,
        ADD COLUMN production_status ENUM('Scheduled', 'In Progress', 'Completed') DEFAULT 'Scheduled',
        ADD COLUMN status ENUM("active", "inactive") DEFAULT 'active'
      `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};