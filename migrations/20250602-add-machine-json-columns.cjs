'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('machines', 'machine_process', {
      type: Sequelize.JSON,
      allowNull: true,
    });

    await queryInterface.addColumn('machines', 'machine_route', {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('machines', 'machine_process');
    await queryInterface.removeColumn('machines', 'machine_route');
  }
};
