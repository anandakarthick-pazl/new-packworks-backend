'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE machines
      ADD COLUMN unit VARCHAR(255) NULL,
      ADD COLUMN board_length FLOAT NULL,
      ADD COLUMN board_width FLOAT NULL;
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE machines
      DROP COLUMN unit,
      DROP COLUMN board_length,
      DROP COLUMN board_width;
    `);
  }
};
