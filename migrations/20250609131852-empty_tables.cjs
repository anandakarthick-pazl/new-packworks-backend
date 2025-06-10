'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`SET FOREIGN_KEY_CHECKS = 0;`);

    await queryInterface.sequelize.query(`TRUNCATE TABLE purchase_order_returns_items;`);
    await queryInterface.sequelize.query(`TRUNCATE TABLE grn_items;`);
    await queryInterface.sequelize.query(`TRUNCATE TABLE purchase_order_items;`);
    await queryInterface.sequelize.query(`TRUNCATE TABLE stock_adjustment_items;`);
    await queryInterface.sequelize.query(`TRUNCATE TABLE inventory;`);
    await queryInterface.sequelize.query(`TRUNCATE TABLE credit_notes;`);
    await queryInterface.sequelize.query(`TRUNCATE TABLE debit_notes;`);
    await queryInterface.sequelize.query(`TRUNCATE TABLE purchase_order_returns;`);
    await queryInterface.sequelize.query(`TRUNCATE TABLE grn;`);
    await queryInterface.sequelize.query(`TRUNCATE TABLE purchase_orders;`);
    await queryInterface.sequelize.query(`TRUNCATE TABLE stock_adjustments;`);
    await queryInterface.sequelize.query(`TRUNCATE TABLE item_master;`);

        await queryInterface.sequelize.query(`SET FOREIGN_KEY_CHECKS = 1;`);

    },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  }
};

