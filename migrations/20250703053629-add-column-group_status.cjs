'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('production_group', 'group_status', {
      type: Sequelize.ENUM('pending', 'allocation_completed', 'production_completed', 'cancelled'),
      defaultValue: 'pending',
      allowNull: false,
      after: 'status'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('production_group', 'group_status');

    // Optional: Drop ENUM type (if needed for cleanup in PostgreSQL)
    // await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_your_table_name_group_status";');
  }
};
