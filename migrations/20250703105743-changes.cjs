'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE group_history
      DROP COLUMN total_quantity,
      DROP COLUMN group_id,
      DROP COLUMN group_status
    `);

    // Add the new column (should be INT for FK)
    await queryInterface.addColumn('group_history', 'production_schedule_id', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'production_schedule',
        key: 'id'
      },
      onDelete: 'CASCADE'
    });
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};