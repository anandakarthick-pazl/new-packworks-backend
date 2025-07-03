'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE production_schedule
      ADD COLUMN group_manufactured_quantity INTEGER NULL DEFAULT 0
    `);

    
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};