'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

       // Drop the foreign key first
    await queryInterface.sequelize.query(`
      ALTER TABLE stock_adjustments 
      DROP FOREIGN KEY stock_adjustments_ibfk_2;
    `);

    // Modify the column to allow NULL
    await queryInterface.sequelize.query(`
      ALTER TABLE stock_adjustments 
      MODIFY COLUMN inventory_id INT NULL;
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

