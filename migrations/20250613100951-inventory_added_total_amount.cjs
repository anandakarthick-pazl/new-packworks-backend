'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
     ALTER TABLE inventory
     ADD COLUMN total_amount DECIMAL(15, 2) DEFAULT 0 AFTER rate;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};