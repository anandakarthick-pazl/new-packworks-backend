'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn('production_group', 'group_status', {
      type: DataTypes.ENUM('Pending', 'Progress', 'Completed', 'Cancelled'),
      allowNull: false,
      defaultValue: 'Pending'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('production_group', 'group_status');

    // Optionally drop ENUM type if using PostgreSQL
    // await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_production_group_group_status";');
  }
};
