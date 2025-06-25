'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        ALTER TABLE work_order_invoice ADD invoice_pdf_url LONGTEXT NULL DEFAULT NULL AFTER invoice_pdf;
      `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};