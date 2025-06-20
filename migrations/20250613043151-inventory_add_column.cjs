'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE inventory
      ADD COLUMN quantity_blocked DECIMAL(15, 2) DEFAULT 0 AFTER quantity_available;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};