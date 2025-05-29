'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE work_order_invoice 
      ADD sku_version_id INT NULL DEFAULT NULL AFTER sku_id;
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE work_order_invoice 
      DROP COLUMN sku_version_id;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE addresses 
      DROP COLUMN company_id;
    `);
  }
};
