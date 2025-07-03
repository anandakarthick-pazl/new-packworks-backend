'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE production_schedule
      DROP COLUMN group_total_quantity,
      DROP COLUMN group_manufactured_quantity,
      DROP COLUMN group_balanced_quantity
    `);

    
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};