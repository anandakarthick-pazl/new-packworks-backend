'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE grn_items
      ADD COLUMN unit_price DECIMAL(15,2) NULL AFTER notes;

    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};
