'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('production_group', 'manufactured_qty', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });

    await queryInterface.addColumn('production_group', 'balance_manufacture_qty', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('production_group', 'manufactured_qty');
    await queryInterface.removeColumn('production_group', 'balance_manufacture_qty');
  },
};
