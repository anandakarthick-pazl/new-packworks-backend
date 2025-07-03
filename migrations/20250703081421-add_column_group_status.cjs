'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        ALTER TABLE group_history
        ADD COLUMN group_status ENUM('in_progress','completed')
      `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};