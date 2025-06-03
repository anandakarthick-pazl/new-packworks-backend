'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('work_order', 'excess_qty', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });

    await queryInterface.addColumn('work_order', 'pending_qty', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });

    await queryInterface.addColumn('work_order', 'manufactured_qty', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });

    await queryInterface.addColumn('work_order', 'stage', {
      type: Sequelize.STRING(200),
      allowNull: true,
      defaultValue: 'Production',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('work_order', 'excess_qty');
    await queryInterface.removeColumn('work_order', 'pending_qty');
    await queryInterface.removeColumn('work_order', 'manufactured_qty');
    await queryInterface.removeColumn('work_order', 'stage');
  }
};
