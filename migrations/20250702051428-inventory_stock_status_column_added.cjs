'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`
      ALTER TABLE inventory
      ADD COLUMN stock_status ENUM('in_stock', 'low_stock','out_of_stock') DEFAULT 'out_of_stock'
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};