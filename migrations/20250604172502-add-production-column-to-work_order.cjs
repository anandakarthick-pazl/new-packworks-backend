'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE work_order
      ADD COLUMN production ENUM('created', 'in_production', 'removed_from_production') 
      NULL DEFAULT 'created';
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE work_order
      DROP COLUMN production;
    `);
  }
};
