'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        ALTER TABLE debit_notes
        DROP COLUMN sub_total,
        DROP COLUMN adjustment,
        DROP COLUMN rate;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};