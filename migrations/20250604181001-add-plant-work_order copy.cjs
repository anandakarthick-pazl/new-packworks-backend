'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE work_order
      ADD COLUMN select_plant VARCHAR(100) NULL;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Optional rollback
    await queryInterface.sequelize.query(`
      ALTER TABLE work_order
      DROP COLUMN select_plant;
    `);
  }
};
