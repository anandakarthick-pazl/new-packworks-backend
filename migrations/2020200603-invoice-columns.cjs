'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await Promise.all([
      queryInterface.addColumn('work_order_invoice', 'client_email', {
        type: Sequelize.STRING(100),
        allowNull: true,
      }),
      queryInterface.addColumn('work_order_invoice', 'client_phone', {
        type: Sequelize.INTEGER,
        allowNull: true,
      }),
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await Promise.all([
      queryInterface.removeColumn('work_order_invoice', 'client_email'),
      queryInterface.removeColumn('work_order_invoice', 'client_phone'),
    ]);
  },
};
