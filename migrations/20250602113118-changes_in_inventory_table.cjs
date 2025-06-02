'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE inventory SET work_order_no = NULL;
    `);
    await queryInterface.sequelize.query(`ALTER TABLE inventory
    CHANGE work_order_no work_order_id INT DEFAULT NULL,
    ADD po_item_id INT DEFAULT NULL,
    ADD po_return_id INT DEFAULT NULL,
    ADD credit_note_id INT DEFAULT NULL,
    ADD debit_note_id INT DEFAULT NULL,
    ADD adjustment_id INT DEFAULT NULL;`);
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

