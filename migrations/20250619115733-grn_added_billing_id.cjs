'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE grn
      ADD COLUMN po_bill_id VARCHAR(100) AFTER po_id;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};