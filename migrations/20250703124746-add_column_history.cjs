'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE group_history
      DROP COLUMN used_quantity,
      DROP COLUMN balanced_quantity,
      DROP COLUMN status,
      ADD COLUMN group_manufactured_quantity INTEGER NULL DEFAULT 0;
    `);

    
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};


