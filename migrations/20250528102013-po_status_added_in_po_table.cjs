'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`ALTER TABLE purchase_orders 
ADD COLUMN po_status ENUM('created', 'partialy-recieved', 'received', 'amended', 'returned') 
NOT NULL DEFAULT 'created' 
AFTER status;

`);
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


