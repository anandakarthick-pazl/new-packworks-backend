'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE group_history
      ADD COLUMN status ENUM('active', 'inactive') DEFAULT 'active' NOT NULL
    `);

    
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};


