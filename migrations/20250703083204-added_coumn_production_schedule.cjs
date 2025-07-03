'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        ALTER TABLE production_schedule
        ADD COLUMN group_total_quantity DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN group_manufactured_quantity DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN group_balanced_quantity DECIMAL(10,2) DEFAULT 0
      `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};