'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
     // Drop old DATETIME columns
    await queryInterface.sequelize.query(`
      ALTER TABLE production_schedule
        DROP COLUMN start_time,
        DROP COLUMN end_time;
    `);

    // Add new VARCHAR columns
    await queryInterface.sequelize.query(`
      ALTER TABLE production_schedule
        ADD COLUMN start_time VARCHAR(100),
        ADD COLUMN end_time VARCHAR(100);
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};