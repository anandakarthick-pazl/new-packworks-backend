'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        ALTER TABLE invoice_settings 
        ADD COLUMN production_schedule_prefix VARCHAR(191) NOT NULL DEFAULT 'PROD_SCHED',
        ADD COLUMN production_schedule_number_separator VARCHAR(191) NOT NULL DEFAULT '#',
        ADD COLUMN production_schedule_digit INT UNSIGNED NOT NULL DEFAULT 3;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};