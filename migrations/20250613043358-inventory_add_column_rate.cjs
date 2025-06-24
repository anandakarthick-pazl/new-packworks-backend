'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
     ALTER TABLE inventory
     ADD COLUMN rate DECIMAL(15, 2) DEFAULT 0 AFTER quantity_blocked;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};