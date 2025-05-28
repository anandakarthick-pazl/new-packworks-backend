'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await sequelize.query(`
      ALTER TABLE purchase_order_returns
      ADD COLUMN purchase_return_generate_id VARCHAR(200) NULL;
    `);
  },

  async down(queryInterface) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  }
};
