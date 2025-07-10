'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`
      ALTER TABLE group_history 
      ADD COLUMN employee_id INTEGER(11) NULL,
      ADD COLUMN machine_id INTEGER(11) NULL 
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};