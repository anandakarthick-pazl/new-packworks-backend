'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE stock_adjustments
      ADD COLUMN reference_number VARCHAR(100) AFTER id,
      ADD COLUMN mode_of_adjustment VARCHAR(100) AFTER reference_number,
      ADD COLUMN date DATE AFTER mode_of_adjustment,
      ADD COLUMN description TEXT AFTER date;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};