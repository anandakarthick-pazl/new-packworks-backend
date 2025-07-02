'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE production_schedule
      DROP COLUMN start_time,
      DROP COLUMN end_time;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE production_schedule
      ADD COLUMN start_time DATETIME NULL,
      ADD COLUMN end_time DATETIME NULL;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};