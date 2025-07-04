'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`
      ALTER TABLE users 
      DROP COLUMN user_source;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};