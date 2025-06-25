'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        ALTER TABLE work_order_invoice CHANGE client_phone client_phone VARCHAR(15) NULL DEFAULT NULL;
      `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};